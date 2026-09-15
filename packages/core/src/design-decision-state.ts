import type { CanvasContents, Comment, Item, CanvasState } from "./model.ts";
import type { Operation, OpEnvelope } from "./ops.ts";
import type { DesignApprovalBasis, DesignComparison, DesignComparisonState, DesignDecisionRecord, DesignScopeBasis } from "./design-decision.ts";
import { parseDesignComparison, parseDesignComparisonResponse, parseDesignDecisionInput } from "./design-decision-parse.ts";
import { parseDesignArtifactRef } from "./design-partner.ts";
import { object, text, hash } from "./design-partner-values.ts";
import { OpValidationError } from "./errors.ts";
import { validateDesignRetainedReferences } from "./design-retention.ts";
import type { DesignRepairTransition } from "./design-repair-state.ts";
import { canvasScopes } from "./canvas-scope.ts";

/** A paired history conflict must retain its candidate; neither half may be silently skipped. */
export class DesignRestoreConflict extends OpValidationError { constructor(message: string) { super("edit-conflict", message); this.name = "DesignRestoreConflict"; } }
/** Key-order-independent equality is shared by canonical replay and exact metadata fences. */
export function sameDesignValue(a: unknown, b: unknown): boolean { const stable = (v: unknown): string => Array.isArray(v) ? `[${v.map(stable).join(",")}]` : v !== null && typeof v === "object" ? "{" + Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`).join(",") + "}" : JSON.stringify(v); return stable(a) === stable(b); }
/** Both clients and the writer compare current membership rather than an older supplied item copy. */
export function currentDesignScope(canvas: CanvasContents, item: Item): DesignScopeBasis { return { containerId: item.containerId ?? null, scopeIds: canvasScopes(canvas, item).map((scope) => scope.id) }; }
/** Full approval fencing includes description and scope, beyond the older item.edit metadata guard. */
export function designTargetMatches(canvas: CanvasContents, basis: DesignApprovalBasis["target"]): boolean {
  const item = canvas.items[basis.artifact.itemId], version = item?.versions.find((v) => v.id === item.currentVersionId);
  return !!item && !!version && version.id === basis.artifact.versionId && version.blobHash === basis.artifact.blobHash && item.title === basis.title && item.description === basis.description && sameDesignValue(item.properties, basis.properties) && sameDesignValue(currentDesignScope(canvas, item), basis.scope);
}
/** Generated prose is a view; typed authority is read from the immutable canonical comment metadata. */
export function designDecisionMarkdown(record: NonNullable<Comment["designDecision"]>["record"]): string {
  if (record.kind === "comparison") return [`${record.uncertainty === "structure" ? "Workflow" : "Visual"} directions: ${record.scenario}`, ...record.alternatives.map((a) => `${a.title}: ${a.hypothesis}\nTradeoff: ${a.tradeoff}`), `Recommendation: ${record.recommendation}`].join("\n\n");
  if (record.kind === "comparison-response") return `Design response: ${record.outcome.kind}`;
  const a = record.input.authority, words = a.kind === "human-choice" ? a.reason : a.rationale;
  return `Adopted ${record.comparison.alternatives.find((o) => o.id === record.input.chosenAlternativeId)?.title ?? record.input.chosenAlternativeId}\n\n${a.kind}${words ? `: ${words}` : ""}`;
}
/** Canonical comments validate on replay and snapshot admission without rereading pruned live source versions. */
export function validateDesignDecisionComment(comment: Comment, canvasId: string): void {
  const meta = comment.designDecision; if (meta === undefined) return;
  object(meta, ["schemaVersion", "opId", "intentHash", "record"]); if (meta.schemaVersion !== 1 || comment.design !== undefined || comment.designLegacySource !== undefined) throw new OpValidationError("bad-op", "invalid canonical design decision comment");
  text(meta.opId); hash(meta.intentHash); text(comment.author.id); text(comment.author.name);
  const record = meta.record;
  let required: import("./design-partner.ts").DesignArtifactRef[] = [];
  if (record.kind === "comparison") { parseDesignComparison(record); required = [record.brief, ...record.alternatives.map((o) => o.artifact)]; }
  else if (record.kind === "comparison-response") parseDesignComparisonResponse(record);
  else {
    object(record, ["schemaVersion", "kind", "input", "comparison", "recommendationAuthor", "adopted"]);
    if (record.kind !== "adoption-decision" || record.schemaVersion !== 1) throw new OpValidationError("bad-op", "unknown design decision record");
    parseDesignDecisionInput(record.input); parseDesignComparison(record.comparison); parseDesignArtifactRef(record.adopted); object(record.recommendationAuthor, ["id", "name"]); text(record.recommendationAuthor.id); text(record.recommendationAuthor.name);
    const d = record.input, comparison = record.comparison, chosen = comparison.alternatives.find((o) => o.id === d.chosenAlternativeId);
    if (d.requestId !== comparison.requestId || d.decisionKey !== comparison.decisionKey || d.basis.epoch !== comparison.epoch || !sameDesignValue(d.basis.brief, comparison.brief) || !sameDesignValue(d.basis.alternatives, comparison.alternatives.map((o) => o.artifact)) || d.source.kind === "direct" && !sameDesignValue(d.source.proposal, comparison) || d.source.kind === "comparison" && (d.source.source.payloadId !== comparison.id || d.source.source.revision !== comparison.revision) || record.adopted.versionId !== d.versionId || record.adopted.itemId !== d.basis.target.artifact.itemId || record.adopted.home !== d.basis.target.artifact.home || record.adopted.canvasId !== d.basis.target.artifact.canvasId || record.adopted.itemId !== (comparison.target.itemId ?? chosen?.artifact.itemId) || !chosen || chosen.artifact.blobHash !== record.adopted.blobHash || d.supersedesDecisionId !== comparison.correctsDecisionId) throw new OpValidationError("bad-op", "canonical adoption association disagrees");
    required = [comparison.brief, ...comparison.alternatives.map((o) => o.artifact), d.basis.target.artifact, record.adopted];
  }
  validateDesignRetainedReferences(comment.designReferences, canvasId, required, 4096);
  if (record.kind === "adoption-decision") {
    const find = (artifact: import("./design-partner.ts").DesignArtifactRef) => comment.designReferences!.find((r) => sameDesignValue(r.artifact, artifact))!.version;
    const chosen = find(record.comparison.alternatives.find((o) => o.id === record.input.chosenAlternativeId)!.artifact), target = find(record.input.basis.target.artifact), adopted = find(record.adopted);
    if (!["text/html", "image/svg+xml"].includes(target.mimeType) || chosen.mimeType !== target.mimeType || adopted.mimeType !== target.mimeType || adopted.filename !== target.filename || adopted.size !== chosen.size || !sameDesignValue(adopted.visual, chosen.visual) || !sameDesignValue(adopted.createdBy, comment.author) || adopted.createdAt !== comment.createdAt) throw new OpValidationError("bad-op", "canonical adopted version disagrees with retained source and target");
  }
}
/** Ordinary writes cannot forge new typed comments; only internal canonical restoration may carry them. */
export function rejectDesignDecisionMetadata(op: Operation): void {
  if (op.type === "thread.create" || op.type === "thread.reply") { if ("designDecision" in op.comment) throw new OpValidationError("bad-op", "design decision metadata is writer-owned"); }
  if (op.type === "comment.update" && "designDecision" in op) throw new OpValidationError("bad-op", "design decision metadata is immutable");
}
/** Source identity and exact generated text, not unrelated replies, establish comparison eligibility. */
export function designComparisonStates(canvas: CanvasContents): DesignComparisonState[] {
  const all = Object.values(canvas.threads).flatMap((t) => t.comments.map((comment) => ({ threadId: t.id, comment })));
  return all.flatMap(({ threadId, comment }) => {
    const comparison = comment.designDecision?.record; if (comparison?.kind !== "comparison") return [];
    const source = { threadId, commentId: comment.id, payloadId: comparison.id, revision: comparison.revision };
    const responses = all.flatMap((row) => { const response = row.comment.designDecision?.record; return response?.kind === "comparison-response" && sameDesignValue(response.comparison, source) ? [{ source: { threadId: row.threadId, commentId: row.comment.id, payloadId: response.id, revision: 1 }, response, author: row.comment.author }] : []; });
    const superseded = all.some((row) => { const next = row.comment.designDecision?.record; return next?.kind === "comparison" && sameDesignValue(next.supersedes, source); });
    const effectiveResponses = responses.filter((r) => !responses.some((later) => later.response.supersedesResponseId === r.response.id));
    const brief = canvas.items[comparison.brief.itemId], reasons = comment.body !== designDecisionMarkdown(comparison) ? ["The comparison source text changed."] : [];
    if (!brief || brief.currentVersionId !== comparison.brief.versionId || brief.versions.find((v) => v.id === comparison.brief.versionId)?.blobHash !== comparison.brief.blobHash) reasons.push("The comparison brief changed.");
    const decided = all.flatMap((row) => { const r = row.comment.designDecision?.record; return r?.kind === "adoption-decision" && r.input.source.kind === "comparison" && sameDesignValue(r.input.source.source, source) ? [r] : []; })[0];
    return [{ source, comparison, author: comment.author, responses, currentReporterActorId: null, adoptedDecisionId: decided?.input.id ?? null, effectiveResponse: effectiveResponses.length === 1 ? effectiveResponses[0]! : null, status: superseded ? "superseded" : reasons.length ? "stale" : decided || responses.length ? "settled" : "open", reasons, references: comment.designReferences ?? [] } satisfies DesignComparisonState];
  });
}
/** Exact still-present adoption edges may bridge a captured input; arbitrary later edits never do. */
export function designInputTransition(canvas: CanvasContents, briefItemId: string, requestId: string, epoch: number, input: import("./design-partner.ts").DesignArtifactRef, repairs: readonly DesignRepairTransition[] = []): boolean {
  const adoptions = Object.values(canvas.threads).flatMap((t) => t.comments.flatMap((c) => { const r = c.designDecision?.record; return r?.kind === "adoption-decision" && c.body === designDecisionMarkdown(r) && r.input.requestId === requestId && r.input.basis.brief.itemId === briefItemId && r.input.basis.epoch === epoch && r.adopted.itemId === input.itemId ? [{ target: r.input.basis.target, adopted: r.adopted, decision: r }] : []; }));
  const records: Array<{ target: DesignApprovalBasis["target"]; adopted: import("./design-partner.ts").DesignArtifactRef; decision?: DesignDecisionRecord }> = [...adoptions, ...repairs.filter((r) => r.request.brief.itemId === briefItemId && r.request.requestId === requestId && r.request.epoch === epoch && r.adopted.itemId === input.itemId)];
  let current = input, previous: typeof records[number] | undefined; const visited = new Set<string>();
  for (let i = 0; i <= records.length; i++) {
    const edges = records.filter((r) => sameDesignValue(r.target.artifact, current));
    if (edges.length !== 1 || visited.has(current.versionId)) return false;
    visited.add(current.versionId); const edge = edges[0]!;
    if (previous && (!sameDesignValue({ ...previous.target, artifact: previous.adopted }, edge.target) || previous.decision && edge.decision && previous.decision.input.decisionKey === edge.decision.input.decisionKey && edge.decision.input.supersedesDecisionId !== previous.decision.input.id)) return false;
    if (designTargetMatches(canvas, { ...edge.target, artifact: edge.adopted })) return true;
    current = edge.adopted; previous = edge;
  }
  return false;
}
