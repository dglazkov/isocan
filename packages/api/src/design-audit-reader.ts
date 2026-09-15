import {
  designSystem, inCanvasScope, itemKind, newVersionId, parseDesign, sourceFaceOf,
  type CanvasContents, type CanvasSnapshotResponse, type LinkedCanvas, type Operation, type SourceClassificationRequest,
} from "@isocan/core";
import type { ScreenAudit } from "@isocan/core/design-audit";
import { readInheritedCanvases, type ContextReadPort } from "./context-reader.ts";
import { readGoverningDesign } from "./design-governing.ts";

/** Both transports enforce automatic-source policy on the actual inherited blob read. */
export interface DesignAuditReadPort extends Pick<ContextReadPort, "classifySource" | "sourceSnapshot"> {
  blobText(canvasId: string, hash: string, signal?: AbortSignal): Promise<string>;
  sourceBlobText(source: SourceClassificationRequest, hash: string, signal?: AbortSignal): Promise<string>;
}

/** Select current HTML sources by exact identity, optionally within one canvas scope. */
export interface DesignAuditOptions {
  /** Exact ids; reference resolution belongs to the caller. Omission selects all screens. */
  itemIds?: string[];
  scopeId?: string;
  /** The editor supplies its actual base; a fresh current version must never replace that identity. */
  draft?: { itemId: string; text: string; baseVersionId: string; label?: string };
  signal?: AbortSignal;
}

/** The governing document's immutable source identity, including its original canvas. */
export interface DesignAuditProvenance {
  canvasId: string;
  itemId: string;
  versionId: string;
  blobHash: string;
  title: string;
  name: string;
  inherited: boolean;
}

/** A digest of the decoded UTF-8 source actually supplied to the analyzer, independent of storage. */
export interface DesignAuditInput {
  kind: "stored" | "draft" | "file";
  sha256: string;
  size: number;
  label: string;
  baseVersionId?: string;
}

interface ItemAuditIdentity {
  canvasId: string;
  itemId: string;
  title: string;
  /** Stored current version, or the explicitly captured editor base when input.kind is draft. */
  versionId: string;
  blobHash: string | null;
  input: DesignAuditInput | null;
}

/** Unavailable source or policy reads remain explicit instead of yielding a conforming audit. */
export type ItemDesignAudit = ItemAuditIdentity & (
  | (ScreenAudit & { status: "audited"; governing: DesignAuditProvenance })
  | { status: "unavailable"; reason: string; governing: DesignAuditProvenance | null }
);

/** Per-screen findings and read failures, with compatibility totals for existing audit consumers. */
export interface CanvasDesignAudit {
  canvasId: string;
  ruleVersion: string;
  /** Compatibility label: the single effective system's name, else "Multiple design systems". */
  system: string | null;
  screens: number;
  offSystem: number;
  audited: number;
  unavailable: number;
  items: ItemDesignAudit[];
  /** A refused inheritance edge is visible even when another source can supply a system. */
  refusedSources: { canvasId: string; itemId: string; reason: string }[];
}

/** Browser-safe orchestration. Reports are derived from the supplied snapshot and immutable blobs. */
export async function readCanvasDesignAudit(
  io: DesignAuditReadPort,
  options: DesignAuditOptions & { canvasId: string; home: string; canvas: CanvasContents },
): Promise<CanvasDesignAudit> {
  const { canvas, canvasId, signal } = options;
  signal?.throwIfAborted();
  const scope = options.scopeId === undefined ? null : canvas.items[options.scopeId];
  if (options.scopeId !== undefined && !scope) throw new Error(`No scope ${options.scopeId} on this canvas.`);
  if (options.draft && (!options.draft.baseVersionId || (options.itemIds && (options.itemIds.length !== 1 || options.itemIds[0] !== options.draft.itemId)))) throw new Error("A draft needs its captured base version and exactly its own item selection.");
  const selectedIds = options.draft ? [options.draft.itemId] : options.itemIds;
  const chosen = selectedIds === undefined ? Object.values(canvas.items).filter(item => itemKind(item) === "screen") : selectedIds.map(id => {
    const item = canvas.items[id];
    if (!item) throw new Error(`No item ${id} on this canvas.`);
    if (itemKind(item) !== "screen") throw new Error(`${item.title} is not an HTML screen.`);
    return item;
  });
  const screens = [...new Map(chosen.filter(item => !scope || inCanvasScope(canvas, scope, item)).map(item => [item.id, item])).values()];
  const linked: LinkedCanvas[] = screens.some(item => !designSystem(canvas, { at: item }))
    ? await readInheritedCanvases(io, canvas, options.home, signal) : [];
  signal?.throwIfAborted();
  // An explicit lazy entry keeps HTML/CSS parsers out of the browser's initial graph.
  const { auditScreen, DESIGN_AUDIT_VERSION, offSystemTotal } = await import("@isocan/core/design-audit");
  const documents = new Map<string, Promise<{ text: string; document: ReturnType<typeof parseDesign> }>>();
  const items: ItemDesignAudit[] = [];
  const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);
  for (const item of screens) {
    signal?.throwIfAborted();
    const version = item.versions.find(one => one.id === item.currentVersionId);
    const draft = options.draft;
    const identity: ItemAuditIdentity = { canvasId, itemId: item.id, title: item.title, versionId: draft?.baseVersionId ?? item.currentVersionId, blobHash: draft ? null : version?.blobHash ?? null, input: draft ? await designAuditInput(draft.text, { kind: "draft", label: draft.label ?? item.title, baseVersionId: draft.baseVersionId }) : null };
    let provenance: DesignAuditProvenance | null = null;
    try {
      if (!version) throw new Error("The screen's current version is unavailable.");
      if (sourceFaceOf(version).mimeType !== "text/html") throw new Error("Only an HTML source face can be audited.");
      const governing = await readGoverningDesign(io, { canvasId, canvas, home: options.home, atId: item.id, linked, documents, ...(signal ? { signal } : {}) });
      if (governing.artifact) provenance = { canvasId: governing.artifact.canvasId, itemId: governing.artifact.itemId, versionId: governing.artifact.versionId, blobHash: governing.artifact.blobHash, title: governing.title ?? "Unavailable design system", name: governing.title ?? "Unavailable design system", inherited: governing.artifact.canvasId !== canvasId };
      if (governing.status !== "available") throw new Error(!governing.artifact && !governing.title ? "No readable design system governs this screen." : governing.reason);
      const doc = governing.document;
      signal?.throwIfAborted();
      if (doc.problems.length) throw new Error(`The governing design document could not be parsed: ${doc.problems.join("; ")}`);
      provenance!.name = doc.tokens.name ?? governing.title;
      const source = draft?.text ?? await io.blobText(canvasId, version.blobHash, signal);
      signal?.throwIfAborted();
      identity.input ??= await designAuditInput(source, { kind: "stored", label: version.filename });
      items.push({ ...identity, status: "audited", governing: provenance!, ...auditScreen(source, doc.tokens) });
    } catch (error) {
      signal?.throwIfAborted();
      items.push({ ...identity, status: "unavailable", governing: provenance, reason: errorText(error) });
    }
  }
  const audited = items.filter((item): item is Extract<ItemDesignAudit, { status: "audited" }> => item.status === "audited");
  const systems = new Map(audited.map(item => [JSON.stringify([item.governing.canvasId, item.governing.itemId]), item.governing.name]));
  return {
    canvasId, ruleVersion: DESIGN_AUDIT_VERSION,
    system: systems.size > 1 ? "Multiple design systems" : [...systems.values()][0] ?? null,
    screens: items.length, offSystem: offSystemTotal(audited), audited: audited.length,
    unavailable: items.length - audited.length, items,
    refusedSources: linked.filter(link => link.refused).map(link => ({ canvasId: link.canvasId, itemId: link.item.id, reason: link.refused! })),
  };
}

/** Hash exact source text so a changed editor buffer cannot reuse earlier source selections or repairs. */
export async function designAuditInput(text: string, options: Pick<DesignAuditInput, "kind" | "label" | "baseVersionId">): Promise<DesignAuditInput> {
  const bytes = new TextEncoder().encode(text);
  const hash = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return { ...options, size: bytes.byteLength, sha256: [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, "0")).join("") };
}

/** A saved write's subsequent audit is advisory; an unavailable read cannot reverse its receipt. */
export type DesignAuditEvidence = { status: "available"; report: CanvasDesignAudit } | { status: "unavailable"; reason: string };

/** Convert a later analysis/read failure into evidence without misreporting an already stored write. */
export async function readDesignAuditAdvisory(read: () => Promise<CanvasDesignAudit>): Promise<DesignAuditEvidence> {
  try { return { status: "available", report: await read() }; }
  catch (error) { return { status: "unavailable", reason: error instanceof Error ? error.message : String(error) }; }
}

/** A local or contextual file is analyzed as its own input, without invented stored item identity. */
export type SourceDesignAudit = { input: DesignAuditInput; governing: DesignAuditProvenance | { kind: "file"; input: DesignAuditInput } | null } & (
  | (ScreenAudit & { status: "audited" })
  | { status: "unavailable"; reason: string; ruleVersion: string }
);

/** Analyze supplied HTML and DESIGN.md bytes without a canvas or any transport reads. */
export async function auditDesignSource(text: string, designText: string, options: { label: string; designLabel: string }): Promise<SourceDesignAudit> {
  const { auditScreen, DESIGN_AUDIT_VERSION } = await import("@isocan/core/design-audit");
  const input = await designAuditInput(text, { kind: "file", label: options.label });
  const governing = { kind: "file" as const, input: await designAuditInput(designText, { kind: "file", label: options.designLabel }) };
  try {
    const doc = parseDesign(designText);
    if (doc.problems.length) throw new Error(`The governing design document could not be parsed: ${doc.problems.join("; ")}`);
    return { input, governing, status: "audited", ...auditScreen(text, doc.tokens) };
  } catch (error) { return { input, governing, status: "unavailable", ruleVersion: DESIGN_AUDIT_VERSION, reason: error instanceof Error ? error.message : String(error) }; }
}

/** Read a file against an item's/group's effective context without pretending the file is stored there. */
export async function readDesignSourceAudit(io: DesignAuditReadPort, options: { canvasId: string; canvas: CanvasContents; home: string; text: string; label: string; atId?: string; signal?: AbortSignal }): Promise<SourceDesignAudit> {
  const { DESIGN_AUDIT_VERSION } = await import("@isocan/core/design-audit");
  const input = await designAuditInput(options.text, { kind: "file", label: options.label });
  let provenance: DesignAuditProvenance | null = null;
  try {
    options.signal?.throwIfAborted();
    const governing = await readGoverningDesign(io, options);
    if (governing.status !== "available") throw new Error(governing.reason);
    const ref = governing.artifact;
    provenance = { canvasId: ref.canvasId, itemId: ref.itemId, versionId: ref.versionId, blobHash: ref.blobHash, title: governing.title, name: governing.document.tokens.name ?? governing.title, inherited: governing.inherited };
    options.signal?.throwIfAborted();
    const report = await auditDesignSource(options.text, governing.text, { label: options.label, designLabel: governing.title });
    return { ...report, governing: provenance };
  } catch (error) {
    options.signal?.throwIfAborted();
    return { input, governing: provenance, status: "unavailable", ruleVersion: DESIGN_AUDIT_VERSION, reason: error instanceof Error ? error.message : String(error) };
  }
}

/** Opt-in automation failure includes unknown/empty coverage; it is never a visual approval signal. */
export function designAuditFails(report: CanvasDesignAudit | SourceDesignAudit): boolean {
  const failed = (one: ItemDesignAudit | SourceDesignAudit) => one.status !== "audited" || one.diagnostics.length > 0 || !one.coverage.complete || one.coverage.checkedValues === 0 || one.coverage.omittedCategories.length > 0;
  return "items" in report ? report.items.length === 0 || report.refusedSources.length > 0 || report.items.some(failed) : failed(report);
}

/** Explicit repair transport distinguishes an accepted edit from an offline queue or refused write. */
export interface DesignRepairPort extends DesignAuditReadPort {
  snapshot(canvasId: string, signal?: AbortSignal): Promise<CanvasSnapshotResponse>;
  home(canvasId: string, signal?: AbortSignal): Promise<string>;
  upload(canvasId: string, text: string, filename: string, signal?: AbortSignal): Promise<{ blobHash: string; size: number }>;
  edit(canvasId: string, operation: Extract<Operation, { type: "item.edit" }>, signal?: AbortSignal): Promise<{ accepted: true } | { accepted: false; status: "refused" | "pending"; reason: string }>;
}

/** Captured policy and source versions accompany an authored replacement; no token policy edit is implicit. */
export interface DesignRepairRequest {
  canvasId: string;
  itemId: string;
  text: string;
  expectedVersionId: string;
  expectedGoverning: DesignAuditProvenance;
  expectedRuleVersion: string;
  filename?: string;
  signal?: AbortSignal;
}

/** Accepted content remains saved even when its post-save audit is unavailable or superseded. */
export type DesignRepairResult =
  | { status: "saved"; itemId: string; versionId: string; blobHash: string; before: ItemDesignAudit; proposed: ItemDesignAudit; after: DesignAuditEvidence; governingChanged: boolean | null; superseded: boolean | null }
  | { status: "pending"; itemId: string; versionId: string; blobHash: string; reason: string; before: ItemDesignAudit; proposed: ItemDesignAudit }
  | { status: "refused"; code: "stale-version" | "governing-changed" | "rule-version-changed" | "audit-unavailable" | "write-refused"; reason: string; before?: ItemDesignAudit };

function sameGoverning(a: DesignAuditProvenance | null, b: DesignAuditProvenance | null): boolean {
  return !!a && !!b && a.canvasId === b.canvasId && a.itemId === b.itemId && a.versionId === b.versionId && a.blobHash === b.blobHash;
}

/** Refresh policy before conditional item.edit, then report current evidence without claiming a cross-canvas lock. */
export async function repairDesignScreen(io: DesignRepairPort, request: DesignRepairRequest): Promise<DesignRepairResult> {
  const { canvasId, itemId, signal } = request;
  const { DESIGN_AUDIT_VERSION } = await import("@isocan/core/design-audit");
  signal?.throwIfAborted();
  if (request.expectedRuleVersion !== DESIGN_AUDIT_VERSION) return { status: "refused", code: "rule-version-changed", reason: "The audit rules changed; capture a fresh report before repairing." };
  const read = async (draft?: DesignAuditOptions["draft"]) => {
    const snapshot = await io.snapshot(canvasId, signal);
    const home = await io.home(canvasId, signal);
    const report = await readCanvasDesignAudit(io, { canvasId, canvas: snapshot.canvas, home, itemIds: [itemId], ...(draft ? { draft } : {}), ...(signal ? { signal } : {}) });
    return { snapshot, report, item: report.items[0]! };
  };
  const initial = await read();
  const before = initial.item;
  const refusal = (item: ItemDesignAudit): Extract<DesignRepairResult, { status: "refused" }> | null => {
    if (item.versionId !== request.expectedVersionId) return { status: "refused", code: "stale-version", reason: "The screen changed after this draft was based on it. Read the newer version before repairing.", before: item };
    if (item.status !== "audited") return { status: "refused", code: "audit-unavailable", reason: item.reason, before: item };
    if (!sameGoverning(item.governing, request.expectedGoverning)) return { status: "refused", code: "governing-changed", reason: "The governing design changed. Review a fresh audit before repairing.", before: item };
    return null;
  };
  const refused = refusal(before);
  if (refused) return refused;
  const original = initial.snapshot.canvas.items[itemId]!;
  const version = original.versions.find(one => one.id === original.currentVersionId)!;
  const filename = request.filename ?? version.filename;
  const proposedRead = await read({ itemId, text: request.text, baseVersionId: request.expectedVersionId, label: filename });
  if (proposedRead.snapshot.canvas.items[itemId]?.currentVersionId !== request.expectedVersionId) return { status: "refused", code: "stale-version", reason: "The screen changed while auditing the replacement.", before };
  const proposed = proposedRead.item;
  const proposalRefused = refusal(proposed);
  if (proposalRefused) return proposalRefused;
  signal?.throwIfAborted();
  const upload = await io.upload(canvasId, request.text, filename, signal);
  if (upload.blobHash !== proposed.input?.sha256) throw new Error("The uploaded blob does not match the audited replacement text; no edit was submitted.");
  // Uploading bytes is not a content mutation. Repeat the version/policy check after that I/O.
  const latest = await read();
  const lateRefusal = refusal(latest.item);
  if (lateRefusal) return lateRefusal;
  const versionId = newVersionId();
  signal?.throwIfAborted();
  let accepted: Awaited<ReturnType<DesignRepairPort["edit"]>>;
  try { accepted = await io.edit(canvasId, { type: "item.edit", itemId, expectedVersionId: request.expectedVersionId, patch: {}, version: { id: versionId, blobHash: upload.blobHash, mimeType: "text/html", filename, size: upload.size } }, signal); }
  catch (error) { accepted = { accepted: false, status: "pending", reason: error instanceof Error ? error.message : String(error) }; }
  if (!accepted || accepted.accepted !== true) {
    if (accepted?.status === "refused") return { status: "refused", code: "write-refused", reason: accepted.reason, before };
    return { status: "pending", itemId, versionId, blobHash: upload.blobHash, before, proposed, reason: accepted?.reason ?? "The repair has no accepted write receipt. Check this version before retrying." };
  }
  // All errors after this confirmed write are advisory, including cancellation and source refusal.
  const after = await readDesignAuditAdvisory(async () => (await read()).report);
  const current = after.status === "available" ? after.report.items[0] : undefined;
  return { status: "saved", itemId, versionId, blobHash: upload.blobHash, before, proposed, after,
    governingChanged: current?.status === "audited" ? !sameGoverning(current.governing, request.expectedGoverning) : null,
    superseded: current ? current.versionId !== versionId : null };
}
