import { normalizeHomeUrl, resolveActor, sourceFaceOf, type CanvasSnapshotResponse, type PostOpResponse } from "@isocan/core";
import { designDecisionScope } from "@isocan/core/design-decision";
import { parseDesignRepairBasis as parseCoreRepairBasis, parseDesignRepairInput, designRepairIntentHash, type DesignRepairInput, type DesignRepairOperation, type DesignRepairsResponse } from "@isocan/core/design-repair";
import { sameDesignArtifact } from "@isocan/core/design-partner-plan";
import { readGoverningDesign } from "./design-governing.ts";
import { designAuditInput, readCanvasDesignAudit, type DesignAuditReadPort, type CanvasDesignAudit } from "./design-audit-reader.ts";
import { questionnaireFailureStatus } from "./questionnaire-reader.ts";

/** Capture precedes editing and includes metadata/scope; preparing source never silently refreshes it. */
export interface DesignRepairBasis { canvasId: string; repair: Omit<DesignRepairInput, "id" | "version">; filename: string }
/** The exact actor, bytes and stable operation/version identities form the immutable retry journal. */
export interface PreparedDesignRepair { schemaVersion: 1; canvasId: string; actorId: string; opId: string; text: string; filename: string; operation: DesignRepairOperation }
/** Existing authenticated transports provide canonical repair history, not optimistic version-presence proof. */
export interface PreparedDesignRepairPort extends DesignAuditReadPort {
  actorId?: string | undefined;
  snapshot(canvasId: string, signal?: AbortSignal): Promise<CanvasSnapshotResponse>;
  home(canvasId: string, signal?: AbortSignal): Promise<string>;
  repairs(canvasId: string, signal?: AbortSignal): Promise<DesignRepairsResponse>;
  upload(canvasId: string, text: string, filename: string, signal?: AbortSignal): Promise<{ blobHash: string; size: number }>;
  sendRepair(canvasId: string, operation: DesignRepairOperation, options: { opId: string; signal?: AbortSignal }): Promise<{ status: "accepted"; receipt: PostOpResponse } | { status: "pending" | "refused"; reason: string; code?: string }>;
}
/** Accepted identity remains saved even when current policy, output or the follow-up read changes. */
export interface DesignRepairSubmission {
  status: "accepted" | "pending" | "refused"; submittedOpId: string; opId: string | null;
  itemId: string; versionId: string; blobHash: string; seq?: number; reason?: string;
  consistency?: { status: "current" | "stale" | "unavailable"; reasons: string[] };
  audit?: CanvasDesignAudit;
}
const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);
const same = (a: unknown, b: unknown): boolean => {
  const stable = (v: unknown): string => Array.isArray(v) ? `[${v.map(stable).join(",")}]` : v && typeof v === "object" ? "{" + Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`).join(",") + "}" : JSON.stringify(v);
  return stable(a) === stable(b);
};

/** Restore the captured editor basis without inventing operation or replacement version identities. */
export function parseDesignRepairBasis(value: unknown): DesignRepairBasis {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid repair capture.");
  const v = value as Record<string, unknown>;
  if (Object.keys(v).some(k => !["canvasId", "repair", "filename"].includes(k)) || typeof v.canvasId !== "string" || typeof v.filename !== "string" || !v.filename) throw new Error("Invalid repair capture fields.");
  const repair = parseCoreRepairBasis(v.repair);
  if (repair.target.artifact.canvasId !== v.canvasId) throw new Error("Repair capture destination disagrees with its target.");
  return { canvasId: v.canvasId, filename: v.filename, repair };
}

/** Validate restored full retry intent, including exact source hash, before any persistence or transport action. */
export async function validatePreparedDesignRepair(value: unknown): Promise<PreparedDesignRepair> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid saved repair.");
  const p = value as PreparedDesignRepair;
  if (Object.keys(p).some(k => !["schemaVersion", "canvasId", "actorId", "opId", "text", "filename", "operation"].includes(k)) || p.schemaVersion !== 1 || p.operation?.type !== "design.repair" || Object.keys(p.operation).some(k => !["type", "repair"].includes(k))) throw new Error("Invalid saved repair fields.");
  const repair = parseDesignRepairInput(p.operation.repair);
  const basis = parseDesignRepairBasis({ canvasId: p.canvasId, filename: p.filename, repair: { request: repair.request, review: repair.review, target: repair.target, governing: repair.governing, ruleVersion: repair.ruleVersion } });
  const rebuilt = await prepareDesignRepair({ basis, text: p.text, actorId: p.actorId, opId: p.opId, versionId: repair.version.id, repairId: repair.id });
  if (!same(rebuilt, p)) throw new Error("Saved repair bytes or semantic intent changed.");
  return rebuilt;
}

/** Read one exact target and its governing identity, including an explicit known absence. */
export async function captureDesignRepair(io: Pick<PreparedDesignRepairPort, "snapshot" | "home" | "classifySource" | "sourceSnapshot" | "blobText" | "sourceBlobText">, options: { canvasId: string; itemId: string; request?: DesignRepairInput["request"]; review?: DesignRepairInput["review"]; signal?: AbortSignal }): Promise<DesignRepairBasis> {
  const { canvasId, itemId, signal } = options;
  const [snapshot, home] = await Promise.all([io.snapshot(canvasId, signal), io.home(canvasId, signal)]);
  if (snapshot.project.id !== canvasId) throw new Error("Repair capture returned a different canvas.");
  const item = snapshot.canvas.items[itemId], version = item?.versions.find(one => one.id === item.currentVersionId);
  if (!item || !version || sourceFaceOf(version).mimeType !== "text/html") throw new Error("Repair needs an available HTML target.");
  const governing = await readGoverningDesign(io, { canvasId, canvas: snapshot.canvas, project: snapshot.project, home, atId: itemId, ...(signal ? { signal } : {}) });
  if (governing.status === "unavailable") throw new Error(governing.reason);
  const { DESIGN_AUDIT_VERSION } = await import("@isocan/core/design-audit");
  return { canvasId, filename: version.filename, repair: { request: options.request ?? null, review: options.review ?? null, target: { artifact: { home: normalizeHomeUrl(home), canvasId, itemId, versionId: version.id, blobHash: version.blobHash }, title: item.title, description: item.description, properties: structuredClone(item.properties), scope: designDecisionScope(snapshot.canvas, item) }, governing: { atItemId: itemId, artifact: governing.artifact, explicitNone: governing.exempt }, ruleVersion: DESIGN_AUDIT_VERSION } };
}

/** Validate and hash authored HTML before the caller persists an immutable intent; no read or upload occurs here. */
export async function prepareDesignRepair(options: { basis: DesignRepairBasis; text: string; actorId: string; opId: string; versionId: string; repairId: string }): Promise<PreparedDesignRepair> {
  if (!options.actorId || !/^op_[A-Za-z0-9_-]{1,32}$/.test(options.opId)) throw new Error("A repair requires its actual actor and a valid stable operation ID.");
  if (typeof options.text !== "string" || !options.text.trim()) throw Object.assign(new Error("A repair needs authored HTML source. HTML fragments are supported."), { code: "candidate-rejected" });
  const input = await designAuditInput(options.text, { kind: "file", label: options.basis.filename });
  if (input.sha256 === options.basis.repair.target.artifact.blobHash) throw Object.assign(new Error("The proposed repair does not change the source. Its reserved attempt still counts."), { code: "candidate-rejected" });
  const repair = parseDesignRepairInput({ ...options.basis.repair, id: options.repairId, version: { id: options.versionId, blobHash: input.sha256, size: input.size } });
  if (repair.target.artifact.canvasId !== options.basis.canvasId) throw new Error("Repair destination disagrees with its captured target.");
  return { schemaVersion: 1, canvasId: options.basis.canvasId, actorId: options.actorId, opId: options.opId, text: options.text, filename: options.basis.filename, operation: { type: "design.repair", repair } };
}

/** Retry reaches canonical history before any stale source preflight; unrelated receipts never confirm this content. */
export async function submitDesignRepair(io: PreparedDesignRepairPort, prepared: PreparedDesignRepair, options: { retry?: boolean; signal?: AbortSignal } = {}): Promise<DesignRepairSubmission> {
  const { signal } = options, repair = parseDesignRepairInput(prepared.operation.repair);
  const result: DesignRepairSubmission = { status: "pending", submittedOpId: prepared.opId, opId: null, itemId: repair.target.artifact.itemId, versionId: repair.version.id, blobHash: repair.version.blobHash };
  await validatePreparedDesignRepair(prepared);
  let snapshot: CanvasSnapshotResponse | undefined;
  try { snapshot = await io.snapshot(prepared.canvasId, signal); } catch { /* Exact pending retry must still reach receipt lookup. */ }
  const sameActor = (id: string) => id === prepared.actorId || !!snapshot?.joined && resolveActor(snapshot.joined, id) === resolveActor(snapshot.joined, prepared.actorId);
  if (!io.actorId || !sameActor(io.actorId)) return { ...result, status: options.retry ? "pending" : "refused", reason: "This saved repair belongs to another acting identity. Keep that actor's journal unchanged." };
  const verifyCurrent = async () => {
      const current = await captureDesignRepair(io, { canvasId: prepared.canvasId, itemId: result.itemId, request: repair.request, review: repair.review, ...(signal ? { signal } : {}) });
      if (!same(current.repair, { request: repair.request, review: repair.review, target: repair.target, governing: repair.governing, ruleVersion: repair.ruleVersion }) || current.filename !== prepared.filename) throw new Error("The captured target, metadata, scope or governing design changed; review the draft before saving.");
  };
  if (!options.retry) {
    try { await verifyCurrent(); } catch (error) { return { ...result, status: "refused", reason: errorText(error) }; }
  }
  // A previous accepted attempt may have lost its response and had its source removed.
  // Ask the writer first on retry. If that did not confirm acceptance, exact
  // re-upload may recover a persisted-but-unsent intent; its failure stays pending.
  let delivered: Awaited<ReturnType<PreparedDesignRepairPort["sendRepair"]>>;
  try {
    if (!options.retry) {
      const upload = await io.upload(prepared.canvasId, prepared.text, prepared.filename, signal);
      if (upload.blobHash !== repair.version.blobHash || upload.size !== repair.version.size) throw new Error("Uploaded repair bytes disagree with the saved intent.");
      try { await verifyCurrent(); } catch (error) { return { ...result, status: "refused", reason: errorText(error) }; }
    }
    delivered = await io.sendRepair(prepared.canvasId, prepared.operation, { opId: prepared.opId, ...(signal ? { signal } : {}) });
  } catch (error) { delivered = { status: questionnaireFailureStatus(error), reason: errorText(error), ...(error && typeof error === "object" && "code" in error && typeof error.code === "string" ? { code: error.code } : {}) }; }
  if (options.retry && delivered.status !== "accepted" && delivered.code !== "design-intent-conflict") {
    try {
      const upload = await io.upload(prepared.canvasId, prepared.text, prepared.filename, signal);
      if (upload.blobHash !== repair.version.blobHash || upload.size !== repair.version.size) throw new Error("Uploaded repair bytes disagree with the saved intent.");
      delivered = await io.sendRepair(prepared.canvasId, prepared.operation, { opId: prepared.opId, ...(signal ? { signal } : {}) });
    } catch (error) { delivered = { status: "pending", reason: errorText(error) }; }
  }
  let accepted: DesignRepairSubmission | undefined;
  if (delivered.status === "accepted") {
    const e = delivered.receipt.envelope;
    if (e.canvasId === prepared.canvasId && sameActor(e.actor.id) && e.op.type === "design.repair") {
      try { if (await designRepairIntentHash(e.op, e.actor.id) === await designRepairIntentHash(prepared.operation, e.actor.id)) accepted = { ...result, status: "accepted", opId: e.id, seq: delivered.receipt.seq }; } catch { /* Canonical mismatch remains pending. */ }
    }
  }
  let history: DesignRepairsResponse | undefined;
  try { history = await io.repairs(prepared.canvasId, signal); } catch { /* Acceptance and the read's availability are independent. */ }
  if (!accepted && history) for (const entry of history.repairs) {
    if (sameActor(entry.author.id) && entry.intentHash === await designRepairIntentHash(prepared.operation, entry.author.id)) { accepted = { ...result, status: "accepted", opId: entry.opId }; break; }
  }
  if (!accepted) return { ...result, status: delivered.status === "refused" && (!options.retry || delivered.code === "design-intent-conflict") ? "refused" : "pending", reason: delivered.status === "accepted" ? "The writer receipt did not match the saved actor and full repair intent." : delivered.reason };
  const saved = history?.repairs.find(one => one.opId === accepted!.opId);
  accepted.consistency = saved ? { status: saved.status, reasons: saved.reasons } : { status: "unavailable", reasons: ["Accepted repair; its current consistency could not be read."] };
  try {
    const fresh = await io.snapshot(prepared.canvasId, signal), home = await io.home(prepared.canvasId, signal);
    const governing = await readGoverningDesign(io, { canvasId: prepared.canvasId, canvas: fresh.canvas, project: fresh.project, home, atId: result.itemId, ...(signal ? { signal } : {}) });
    if (governing.status === "unavailable") accepted.consistency = { status: "unavailable", reasons: [governing.reason] };
    else if (governing.exempt !== repair.governing.explicitNone || (governing.artifact === null ? repair.governing.artifact !== null : !repair.governing.artifact || !sameDesignArtifact(governing.artifact, repair.governing.artifact))) accepted.consistency = { status: "stale", reasons: ["The governing design changed after this accepted repair."] };
    accepted.audit = await readCanvasDesignAudit(io, { canvasId: prepared.canvasId, canvas: fresh.canvas, home, itemIds: [result.itemId], ...(signal ? { signal } : {}) });
  } catch (error) { accepted.consistency = { status: "unavailable", reasons: [errorText(error)] }; }
  return accepted;
}
