import { designRequestBasisCurrent } from "@isocan/core/design-request";
import { OpValidationError, isSystemActor, resolveActor, type Actor, type ActorRegistry, type CanvasState, type LogEntry, type Operation } from "@isocan/core";
import { DesignPartnerContractError } from "@isocan/core/design-partner";
import { parseDesignRepairOperation, designRepairIntentHash, type DesignRepairOperation, type DesignRepairsResponse } from "@isocan/core/design-repair";
import { activeDesignRepairEntries, validateDesignRepairCanonical } from "../../core/src/design-repair-state.ts";
import { designTargetMatches, sameDesignValue } from "../../core/src/design-decision-state.ts";
import { designDecisionRequest, governingReasons, retainReferences, readDesignRequests } from "./design-request.ts";
import { contextBlobAvailable } from "./canvas-group-context.ts";
import type { Store } from "./store.ts";
const bad = (message: string): never => { throw new OpValidationError("bad-op", message); };
/** Narrow dispatch keeps ordinary content edits outside automatic review and task authority. */
export const isDesignRepairOperation = (op: Operation): op is DesignRepairOperation => op.type === "design.repair";
/** Strict public parsing refuses canonical effect and retained-authority injection before retry lookup. */
export function rejectPublicDesignRepair(op: Operation): void { if (isDesignRepairOperation(op)) { try { parseDesignRepairOperation(op); } catch (error) { if (error instanceof DesignPartnerContractError) bad(error.message); throw error; } } }
/** Canonical identity remains reserved after Undo and archive; only exact original intent and current actor custody can observe it. */
export async function designRepairRetry(history: readonly LogEntry[], op: DesignRepairOperation, opId: string | undefined, actorId: string, registry: ActorRegistry): Promise<LogEntry | null> {
  const found = history.find((r) => opId && r.envelope.id === opId) ?? history.find((r) => r.envelope.op.type === "design.repair" && (r.envelope.op.repair.id === op.repair.id || r.envelope.op.repair.version.id === op.repair.version.id));
  if (!found) return null;
  if (found.envelope.op.type !== "design.repair" || resolveActor(registry.joined, found.envelope.actor.id) !== resolveActor(registry.joined, actorId) || await designRepairIntentHash(found.envelope.op, found.envelope.actor.id) !== await designRepairIntentHash(op, found.envelope.actor.id)) throw new OpValidationError("design-intent-conflict", "This repair identity already belongs to a different canonical intent or actor.");
  return found;
}
/** One writer-serialized repair checks local scope and request facts; foreign policy remains a permission-bearing client read. */
export async function materializeDesignRepair(store: Store, state: CanvasState, home: string, operation: DesignRepairOperation, actor: Actor, registry: ActorRegistry, history: readonly LogEntry[]): Promise<DesignRepairOperation> {
  try {
    const op = parseDesignRepairOperation(operation), r = op.repair, ref = r.target.artifact;
    if (isSystemActor(actor.id) || ref.home !== home || ref.canvasId !== state.project.id || !designTargetMatches(state.canvas, r.target)) bad("The captured repair target content, metadata or scope changed.");
    const target = state.canvas.items[ref.itemId]!, before = target.versions.find((v) => v.id === ref.versionId)!;
    if (before.mimeType !== "text/html" || target.properties.kind === "group" || target.versions.some((v) => v.designRecord)) bad("A repair requires an ordinary HTML source target.");
    if (target.versions.some((v) => v.id === r.version.id)) bad("The repair version identity already exists.");
    const { DESIGN_AUDIT_VERSION } = await import("@isocan/core/design-audit");
    if (r.ruleVersion !== DESIGN_AUDIT_VERSION) bad("The captured source rule version changed.");
    if (r.request) {
      const brief = await designDecisionRequest(store, state, home, r.request.brief, r.request.epoch, registry, history);
      if (brief.requestId !== r.request.requestId || ref.itemId !== brief.targetItemId && !brief.outputIds.includes(ref.itemId)) bad("A task repair must target its declared output or original target.");
    }
    const policy = governingReasons(state, home, r); if (policy.length) bad(policy.join(" "));
    const blob = await store.blobMeta(state.project.id, r.version.blobHash);
    if (!blob || blob.size !== r.version.size || !(await contextBlobAvailable(store, state.project.id, r.version.blobHash))) bad("Replacement bytes are unavailable or differ from the prepared size.");
    const refs = [ref, ...(r.request ? [r.request.brief] : []), ...(r.review ? [r.review.run] : []), ...(r.governing.artifact ? [r.governing.artifact] : [])];
    const retainedReferences = await retainReferences(store, state, home, refs);
    return { ...op, effect: { type: "item.edit", itemId: ref.itemId, expectedVersionId: ref.versionId, expectedMetadata: { title: r.target.title, properties: r.target.properties }, patch: {}, version: { ...r.version, mimeType: "text/html", filename: before.filename } }, canonical: { intentHash: await designRepairIntentHash(op, actor.id), retainedReferences } };
  } catch (error) { if (error instanceof DesignPartnerContractError) bad(error.message); throw error; }
}
/** Read acceptance and active causes without claiming that a repair or an authored review proved task success. */
export async function readDesignRepairs(store: Store, state: CanvasState, home: string, registry: ActorRegistry, history: readonly LogEntry[]): Promise<DesignRepairsResponse> {
  const repairs: DesignRepairsResponse["repairs"] = [], unavailable: DesignRepairsResponse["unavailable"] = [];
  const active = new Set(activeDesignRepairEntries(history).map((r) => r.seq));
  const requests = history.some((row) => row.envelope.op.type === "design.repair" && row.envelope.op.repair.request) ? await readDesignRequests(store, state, home, registry, history) : null;
  for (const row of [...history].sort((a, b) => a.seq - b.seq)) {
    const op = row.envelope.op; if (op.type !== "design.repair") continue;
    try {
      validateDesignRepairCanonical(row.envelope); const r = op.repair, adopted = { ...r.target.artifact, versionId: r.version.id, blobHash: r.version.blobHash }, reasons: string[] = [];
      if (!designTargetMatches(state.canvas, { ...r.target, artifact: adopted })) reasons.push("The repaired output content, metadata or scope changed.");
      reasons.push(...governingReasons(state, home, r));
      if (r.request) {
        const current = requests?.requests.find((one) => one.ref.itemId === r.request!.brief.itemId);
        if (!current || !designRequestBasisCurrent(current, r.request)) reasons.push(...(current?.reasons.length ? current.reasons : ["The captured repair request changed or is unavailable."]));
      }
      let missing = !(await contextBlobAvailable(store, state.project.id, adopted.blobHash));
      for (const ref of op.canonical!.retainedReferences) if (!(await contextBlobAvailable(store, state.project.id, ref.version.blobHash)) || ref.version.visual && !(await contextBlobAvailable(store, state.project.id, ref.version.visual.blobHash))) missing = true;
      if (missing) reasons.push("Some exact repair evidence is unavailable.");
      repairs.push({ opId: row.envelope.id, intentHash: op.canonical!.intentHash, repair: r, author: { id: row.envelope.actor.id, name: row.envelope.actor.name }, adopted, before: op.canonical!.retainedReferences.find((ref) => sameDesignValue(ref.artifact, r.target.artifact))!.version, standing: active.has(row.seq) ? "active" : "undone", status: missing ? "unavailable" : reasons.length ? "stale" : "current", reasons, references: op.canonical!.retainedReferences });
    } catch (error) { unavailable.push({ opId: row.envelope.id, reason: error instanceof Error ? error.message : String(error) }); }
  }
  return { repairs, unavailable };
}
