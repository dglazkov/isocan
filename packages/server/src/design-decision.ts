import { resolveActor, isSystemActor, OpValidationError, type Actor, type ActorRegistry, type CanvasState, type Comment, type LogEntry, type Operation } from "@isocan/core";
import { DesignPartnerContractError, type DesignArtifactRef } from "@isocan/core/design-partner";
import { designDecisionIntentHash, parseDesignDecisionOperation, type DesignComparison, type DesignComparisonResponse, type DesignDecisionOperation, type DesignDecisionRecord, type DesignDecisionsResponse, type DesignDecisionState } from "@isocan/core/design-decision";
import { designComparisonStates, designInputTransition, designDecisionMarkdown, designTargetMatches, sameDesignValue, validateDesignDecisionComment } from "../../core/src/design-decision-state.ts";
import { retainedDesignVersion } from "@isocan/core/design-record";
import { designDecisionRequest, retainReferences, governingReasons } from "./design-request.ts";
import { questionnaireActorKind } from "./questionnaire.ts";
import { contextBlobAvailable } from "./canvas-group-context.ts";
import type { Store } from "./store.ts";

const bad = (message: string): never => { throw new OpValidationError("bad-op", message); };
const sameActor = (registry: ActorRegistry, a: string, b: string) => resolveActor(registry.joined, a) === resolveActor(registry.joined, b);
const recordId = (op: DesignDecisionOperation) => op.type === "design.compare" ? op.comparison.id : op.type === "design.respond" ? op.response.id : op.decision.id;
/** The three public specialized acts all require writer-owned materialization. */
export const isDesignDecisionOperation = (op: Operation): op is DesignDecisionOperation => ["design.compare", "design.respond", "design.decide"].includes(op.type);
/** Public input cannot mint canonical comments, operation receipts or paired restoration. */
export function rejectPublicDesignDecision(op: Operation): void {
  const visit = (value: unknown): void => { if (!value || typeof value !== "object") return; if ("designDecision" in value) bad("design decision metadata is writer-owned"); for (const v of Object.values(value)) visit(v); }; visit(op);
  if (isDesignDecisionOperation(op)) { try { parseDesignDecisionOperation(op); } catch (error) { if (error instanceof DesignPartnerContractError) bad(error.message); throw error; } }
}
/** Only an existing canonical receipt can establish this definitive changed-intent refusal. */
export async function designDecisionRetry(entries: readonly LogEntry[], op: DesignDecisionOperation, opId: string | undefined, actorId: string, registry: ActorRegistry): Promise<LogEntry | null> {
  const found = entries.find((e) => opId && e.envelope.id === opId) ?? entries.find((e) => isDesignDecisionOperation(e.envelope.op) && (recordId(e.envelope.op) === recordId(op) || e.envelope.op.commentId === op.commentId || e.envelope.op.type === "design.decide" && op.type === "design.decide" && e.envelope.op.decision.versionId === op.decision.versionId));
  if (!found) return null;
  if (!isDesignDecisionOperation(found.envelope.op) || !sameActor(registry, found.envelope.actor.id, actorId) || await designDecisionIntentHash(found.envelope.op, found.envelope.actor.id) !== await designDecisionIntentHash(op, found.envelope.actor.id)) throw new OpValidationError("design-intent-conflict", "This stable design identity already belongs to another canonical intent or actor.");
  return found;
}
function comments(state: CanvasState) { return Object.values(state.canvas.threads).flatMap((t) => t.comments.map((comment) => ({ threadId: t.id, comment }))); }
function decisions(state: CanvasState): Array<{ record: DesignDecisionRecord; comment: Comment; threadId: string }> { return comments(state).flatMap((row) => { const record = row.comment.designDecision?.record; return record?.kind === "adoption-decision" ? [{ ...row, record }] : []; }); }
function effective(state: CanvasState) { const all = decisions(state); return all.filter((r) => !all.some((next) => next.record.input.supersedesDecisionId === r.record.input.id)); }
function currentRef(state: CanvasState, home: string, ref: DesignArtifactRef) {
  const item = state.canvas.items[ref.itemId], version = item?.versions.find((v) => v.id === ref.versionId);
  if (ref.home !== home || ref.canvasId !== state.project.id || !item || item.currentVersionId !== ref.versionId || !version || version.blobHash !== ref.blobHash) bad("An approved alternative or target changed or is unavailable.");
  return { item: item!, version: version! };
}
function external(brief: import("@isocan/core/design-partner").DesignBrief, registry: ActorRegistry, actor: Actor, id: string): void {
  const owner = brief.continuation?.resumedBy?.actorId ?? brief.requestingActorId;
  if (brief.source.entrance !== "external-agent" || brief.source.externalRequestId !== id || questionnaireActorKind(registry, actor.id) !== "agent" || !sameActor(registry, owner, actor.id)) bad("Native reports require the original reporter or an explicitly resumed current worker.");
}
function audience(comparison: DesignComparison, brief: import("@isocan/core/design-partner").DesignBrief, registry: ActorRegistry): void {
  const a = comparison.audience;
  if (a.kind === "human") { if (questionnaireActorKind(registry, a.respondentActorId) !== "human") bad("The intended respondent is not a known human."); }
  else external(brief, registry, { id: a.reporterActorId, name: "Reporter" }, a.externalRequestId);
}
function human(comparison: DesignComparison, registry: ActorRegistry, actor: Actor): void { if (comparison.audience.kind !== "human" || questionnaireActorKind(registry, actor.id) !== "human" || !sameActor(registry, comparison.audience.respondentActorId, actor.id)) bad("Only the named known human can supply this response or preference."); }
/** Current comparisons use exact sources; a reissued source cannot be refreshed implicitly during adoption. */
function sourceComparison(state: CanvasState, source: import("@isocan/core/design-partner").DesignQuestionSource, allowOldBrief = false) {
  const row = designComparisonStates(state.canvas).find((c) => sameDesignValue(c.source, source));
  if (!row || row.status === "superseded" || row.status === "stale" && !allowOldBrief || row && state.canvas.threads[source.threadId]?.comments.find((c) => c.id === source.commentId)?.body !== designDecisionMarkdown(row.comparison)) bad("The comparison source changed or was superseded; review a refreshed comparison.");
  return row!;
}
/** Resolves a closed comparison/response or the exact target/comment adoption pair within Engine's writer queue. */
export async function materializeDesignDecision(store: Store, state: CanvasState, home: string, op: DesignDecisionOperation, actor: Actor, registry: ActorRegistry, opId: string, ts: string, history: readonly LogEntry[] = []): Promise<DesignDecisionOperation> {
  try { return await materialize(store, state, home, parseDesignDecisionOperation(op), actor, registry, opId, ts, history); }
  catch (error) { if (error instanceof DesignPartnerContractError) bad(error.message); throw error; }
}
async function materialize(store: Store, state: CanvasState, home: string, op: DesignDecisionOperation, actor: Actor, registry: ActorRegistry, opId: string, ts: string, history: readonly LogEntry[] = []): Promise<DesignDecisionOperation> {
  if (isSystemActor(actor.id) || !state.canvas.threads[op.threadId]) bad("Design acts require an actual actor and existing thread.");
  if (comments(state).some((row) => row.comment.id === op.commentId)) bad("The design comment identity already exists.");
  const selected = op.type === "design.respond" ? sourceComparison(state, op.response.comparison) : op.type === "design.decide" && op.decision.source.kind === "comparison" ? sourceComparison(state, op.decision.source.source) : undefined;
  const comparison = op.type === "design.compare" ? op.comparison : selected?.comparison ?? (op.type === "design.decide" && op.decision.source.kind === "direct" ? op.decision.source.proposal : bad("Missing comparison source."));
  if (selected && selected.source.threadId !== op.threadId) bad("A design outcome belongs in its comparison thread.");
  const briefRef = op.type === "design.decide" ? op.decision.basis.brief : comparison.brief;
  const brief = await designDecisionRequest(store, state, home, briefRef, comparison.epoch, registry, history);
  if (brief.requestId !== comparison.requestId || !sameDesignValue(briefRef, comparison.brief) || comparison.target.itemId !== brief.targetItemId || comparison.target.groupId !== brief.groupId) bad("Comparison belongs to another request or target.");
  audience(comparison, brief, registry);
  const previous = effective(state).find((r) => r.record.input.requestId === brief.requestId && r.record.input.basis.brief.itemId === briefRef.itemId && r.record.input.basis.epoch === brief.epoch && r.record.input.decisionKey === comparison.decisionKey);
  if (comparison.correctsDecisionId !== null ? previous?.record.input.id !== comparison.correctsDecisionId : !brief.outstandingDecisionIds.includes(comparison.decisionKey) || previous) bad("Comparison requires an outstanding decision or explicit correction of the current decision.");
  for (const option of comparison.alternatives) currentRef(state, home, option.artifact);
  const policy = governingReasons(state, home, { governing: comparison.governing }); if (policy.length) bad(policy.join(" "));
  let record: NonNullable<Comment["designDecision"]>["record"] = comparison;
  let references = [comparison.brief, ...comparison.alternatives.map((a) => a.artifact)];
  let edit: Extract<Operation, { type: "item.edit" }> | undefined;
  if (op.type === "design.compare") {
    if (comparison.supersedes) { const prior = sourceComparison(state, comparison.supersedes, true); if (!sameActor(registry, prior.author.id, actor.id) || prior.comparison.requestId !== comparison.requestId || prior.comparison.brief.itemId !== comparison.brief.itemId || prior.comparison.epoch !== comparison.epoch || prior.comparison.decisionKey !== comparison.decisionKey || comparison.revision !== prior.comparison.revision + 1) bad("Reissue requires this author's current exact comparison."); }
    if (comparison.followsResponseId) {
      const states = designComparisonStates(state.canvas), visited = new Set<string>();
      let predecessor = comparison.supersedes, found = false;
      while (predecessor) {
        const prior = states.find((r) => sameDesignValue(r.source, predecessor)) ?? bad("Follow-on predecessor is missing.");
        if (!prior || visited.has(prior.comparison.id) || !sameActor(registry, prior.author.id, actor.id) || prior.comparison.requestId !== comparison.requestId || prior.comparison.brief.itemId !== comparison.brief.itemId || prior.comparison.epoch !== comparison.epoch || prior.comparison.decisionKey !== comparison.decisionKey || state.canvas.threads[prior.source.threadId]?.comments.find((c) => c.id === prior.source.commentId)?.body !== designDecisionMarkdown(prior.comparison) || states.filter((r) => sameDesignValue(r.comparison.supersedes, prior.source)).length > 1) bad("Follow-on comparison requires an exact authored predecessor chain.");
        visited.add(prior.comparison.id);
        const response = prior.effectiveResponse?.response;
        if (response?.id === comparison.followsResponseId) {
          if (response.requestId !== brief.requestId || response.epoch !== brief.epoch || !sameDesignValue(response.comparison, prior.source) || response.outcome.kind !== "more" && response.outcome.kind !== "combine") bad("Follow-on comparison requires the effective original revision response.");
          found = true; break;
        }
        if (prior.comparison.followsResponseId !== comparison.followsResponseId || !prior.comparison.supersedes) break;
        const before = states.find((r) => sameDesignValue(r.source, prior.comparison.supersedes));
        if (!before || prior.comparison.revision !== before.comparison.revision + 1) bad("Follow-on comparison predecessor is missing or nonconsecutive.");
        predecessor = prior.comparison.supersedes;
      }
      if (!found) bad("Follow-on comparison must name an effective revision request in its own predecessor chain.");
    }
  } else if (op.type === "design.respond") {
    const response = op.response; if (response.requestId !== brief.requestId || response.epoch !== brief.epoch) bad("Response belongs to another request or epoch.");
    if (response.authority.kind === "human") human(comparison, registry, actor); else { external(brief, registry, actor, response.authority.externalRequestId); if (comparison.audience.kind !== "external-agent" || !sameActor(registry, comparison.audience.reporterActorId, actor.id)) bad("Native response does not belong to this comparison reporter."); }
    const live = selected!.responses.filter((r) => !selected!.responses.some((next) => next.response.supersedesResponseId === r.response.id));
    if (live.length ? live.length !== 1 || response.supersedesResponseId !== live[0]!.response.id || !sameActor(registry, live[0]!.author.id, actor.id) : response.supersedesResponseId !== null) bad("A response must explicitly supersede this actor's current response.");
    if (response.outcome.kind === "delegate" && questionnaireActorKind(registry, response.outcome.agentActorId) !== "agent") bad("Delegation requires a known actual agent.");
    if (response.outcome.kind === "combine" && response.outcome.parts.some((p) => !comparison.alternatives.some((a) => a.id === p.optionId))) bad("Combination names an unknown option.");
    record = response;
  } else {
    const d = op.decision, a = d.authority;
    if (selected?.effectiveResponse && ["more", "combine"].includes(selected.effectiveResponse.response.outcome.kind)) bad("This comparison has a pending revision request; publish and review the new result before adoption.");
    if (d.requestId !== brief.requestId || d.decisionKey !== comparison.decisionKey || d.basis.epoch !== brief.epoch || !sameDesignValue(d.basis.alternatives, comparison.alternatives.map((o) => o.artifact))) bad("Approval no longer matches the complete comparison.");
    if (d.supersedesDecisionId !== (previous?.record.input.id ?? null)) bad("The accepted decision changed.");
    if (a.kind === "human-choice") human(comparison, registry, actor);
    else if (a.kind === "external-report") { external(brief, registry, actor, a.externalRequestId); if (comparison.audience.kind !== "external-agent" || !sameActor(registry, comparison.audience.reporterActorId, actor.id)) bad("Native decision does not belong to this comparison reporter."); }
    else if (a.kind === "canvas-delegation") {
      const r = selected?.responses.find((r) => r.response.id === a.responseId && !selected.responses.some((next) => next.response.supersedesResponseId === r.response.id));
      if (questionnaireActorKind(registry, actor.id) !== "agent" || !r || r.response.authority.kind !== "human" || r.response.outcome.kind !== "delegate" || !sameActor(registry, r.response.outcome.agentActorId, actor.id)) bad("A delegated choice requires the exact effective human delegation to this agent.");
    } else if (questionnaireActorKind(registry, actor.id) !== "agent" || d.source.kind !== "direct" || comparison.mode !== "direct" || comparison.alternatives.length !== 1 || designComparisonStates(state.canvas).some((r) => r.comparison.requestId === brief.requestId && r.comparison.brief.itemId === briefRef.itemId && r.comparison.epoch === brief.epoch && r.comparison.decisionKey === d.decisionKey && r.comparison.audience.kind === "human" && r.status !== "superseded")) bad("Agent judgment is an explicit direct path and cannot settle a named-human comparison.");
    const chosen = comparison.alternatives.find((o) => o.id === d.chosenAlternativeId); if (!chosen) bad("Unknown chosen option.");
    const target = currentRef(state, home, d.basis.target.artifact), source = currentRef(state, home, chosen!.artifact);
    if (!designTargetMatches(state.canvas, d.basis.target) || target.item.id !== (brief.targetItemId ?? chosen!.artifact.itemId)) bad("The approved target metadata or scope changed.");
    if (target.item.properties.kind === "group" || target.item.versions.some((v) => v.designRecord) || target.version.mimeType !== source.version.mimeType || !["text/html", "image/svg+xml"].includes(target.version.mimeType)) bad("The selected MIME cannot replace this screen target.");
    if (d.basis.governing.atItemId !== target.item.id) bad("Approval governing scope must name its actual target.");
    const drift = governingReasons(state, home, { governing: d.basis.governing }); if (drift.length) bad(drift.join(" "));
    if (target.item.versions.some((v) => v.id === d.versionId)) bad("The adoption version already exists.");
    const adopted = { ...d.basis.target.artifact, versionId: d.versionId, blobHash: source.version.blobHash };
    record = { schemaVersion: 1, kind: "adoption-decision", input: d, comparison, recommendationAuthor: selected?.author ?? { id: actor.id, name: actor.name }, adopted };
    references.push(d.basis.target.artifact);
    edit = { type: "item.edit", itemId: target.item.id, expectedVersionId: target.version.id, expectedMetadata: { title: d.basis.target.title, properties: d.basis.target.properties }, patch: {}, version: { id: d.versionId, blobHash: source.version.blobHash, mimeType: source.version.mimeType, filename: target.version.filename, size: source.version.size, ...(source.version.visual ? { visual: structuredClone(source.version.visual) } : {}) } };
  }
  const retained = await retainReferences(store, state, home, references, selected?.references);
  if (edit && record.kind === "adoption-decision") retained.push({ artifact: record.adopted, version: { ...edit.version, createdBy: { id: actor.id, name: actor.name }, createdAt: ts } });
  const comment: Comment = { id: op.commentId, author: { id: actor.id, name: actor.name }, createdAt: ts, body: designDecisionMarkdown(record), designDecision: { schemaVersion: 1, opId, intentHash: await designDecisionIntentHash(op, actor.id), record }, designReferences: retained };
  validateDesignDecisionComment(comment, state.project.id);
  return op.type === "design.decide" ? { ...op, effect: { edit: edit!, threadId: op.threadId, comment } } : { ...op, canonicalComment: comment };
}
/** Read history remains attributed after Undo/removal; artifact freshness never rewrites the original acceptance. */
export async function readDesignDecisions(store: Store, state: CanvasState, home: string, registry: ActorRegistry, history: readonly LogEntry[]): Promise<DesignDecisionsResponse> {
  const comparisons = designComparisonStates(state.canvas), all = decisions(state), current = effective(state), records: DesignDecisionState[] = [];
  for (const entry of [...history].sort((a, b) => a.seq - b.seq)) {
    const op = entry.envelope.op; if (op.type !== "design.decide" || !op.effect) continue;
    const comment = op.effect.comment, decision = comment.designDecision?.record; if (decision?.kind !== "adoption-decision") continue;
    const live = all.find((r) => r.record.input.id === decision.input.id), causes = history.filter((h) => h.cause?.targetSeq === entry.seq).sort((a, b) => a.seq - b.seq), undone = causes.at(-1)?.cause?.kind === "undo";
    const standing = live ? current.some((r) => r.record.input.id === decision.input.id) ? "effective" : "superseded" : undone ? "undone" : "removed";
    const reasons: string[] = [];
    if (!designTargetMatches(state.canvas, { ...decision.input.basis.target, artifact: decision.adopted })) reasons.push("The adopted output content, metadata or scope changed.");
    const comparison = decision.comparison;
    try { await designDecisionRequest(store, state, home, comparison.brief, comparison.epoch, registry, history); } catch (error) { reasons.push(error instanceof Error ? error.message : String(error)); }
    for (const option of comparison.alternatives) { try { currentRef(state, home, option.artifact); } catch { if (!designInputTransition(state.canvas, comparison.brief.itemId, comparison.requestId, comparison.epoch, option.artifact)) reasons.push(`Alternative ${option.id} changed or is unavailable.`); } }
    if (decision.input.source.kind === "comparison") { const source = decision.input.source.source, saved = state.canvas.threads[source.threadId]?.comments.find((c) => c.id === source.commentId); if (!saved || saved.body !== designDecisionMarkdown(comparison) || !sameDesignValue(saved.designDecision?.record, comparison)) reasons.push("The original comparison source changed or is unavailable."); }
    reasons.push(...governingReasons(state, home, { governing: decision.input.basis.governing }));
    let missing = false; for (const ref of comment.designReferences ?? []) if (!(await contextBlobAvailable(store, state.project.id, ref.version.blobHash)) || ref.version.visual && !(await contextBlobAvailable(store, state.project.id, ref.version.visual.blobHash))) missing = true;
    if (missing) reasons.push("Some retained decision evidence is unavailable.");
    records.push({ source: { threadId: op.threadId, commentId: op.commentId, payloadId: decision.input.id, revision: 1 }, decision, author: comment.author, opId: entry.envelope.id, intentHash: comment.designDecision!.intentHash, standing, status: missing ? "unavailable" : reasons.length ? "stale" : "current", reasons, references: comment.designReferences ?? [] });
  }
  for (const row of comparisons) {
    const comparison = row.comparison;
    try {
      const brief = await designDecisionRequest(store, state, home, comparison.brief, comparison.epoch, registry, history);
      if (brief.source.entrance === "external-agent") row.currentReporterActorId = brief.continuation?.resumedBy?.actorId ?? brief.requestingActorId;
      for (const option of comparison.alternatives) { try { currentRef(state, home, option.artifact); } catch (error) { if (!designInputTransition(state.canvas, comparison.brief.itemId, comparison.requestId, comparison.epoch, option.artifact)) throw error; } }
      row.reasons.push(...governingReasons(state, home, { governing: comparison.governing }));
    } catch (error) { row.reasons.push(error instanceof Error ? error.message : String(error)); }
    if (row.reasons.length && row.status !== "superseded") row.status = "stale";
  }
  return { comparisons, decisions: records, unavailable: [] };
}
