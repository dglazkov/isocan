import { parseDesignArtifactRef } from "./design-partner.ts";
import { parseDesignGoverning } from "./design-request-parse.ts";
import { base, bad, bool, choice, fidelity, integer, list, nullableText, object, text, unique } from "./design-partner-values.ts";
import type { DesignApprovalBasis, DesignComparison, DesignComparisonResponse, DesignDecisionInput, DesignDecisionOperation } from "./design-decision.ts";
import type { DesignQuestionSource } from "./design-partner.ts";
const keys = ["schemaVersion", "kind", "id", "requestId", "epoch"];
const source = (value: unknown): DesignQuestionSource => { const v = object(value, ["threadId", "commentId", "payloadId", "revision"]); return { threadId: text(v.threadId), commentId: text(v.commentId), payloadId: text(v.payloadId), revision: integer(v.revision, 1) }; };
const optionalWords = (value: unknown): string => typeof value === "string" && value.length <= 32000 ? value : bad("Expected bounded text.");
/** Comparison parsing validates explicit fidelity and bounded hypotheses, never claims their rendered quality. */
export function parseDesignComparison(value: unknown): DesignComparison {
  const v = object(value, [...keys, "revision", "brief", "decisionKey", "audience", "mode", "uncertainty", "scenario", "fidelity", "alternatives", "recommendedAlternativeId", "recommendation", "target", "governing", "supersedes", "correctsDecisionId", "followsResponseId"]);
  if (v.kind !== "comparison") bad("Expected a comparison.");
  const a = object(v.audience), kind = choice(a.kind, ["human", "external-agent"]);
  object(a, kind === "human" ? ["kind", "respondentActorId"] : ["kind", "externalRequestId", "reporterActorId"]);
  const audience: DesignComparison["audience"] = kind === "human" ? { kind, respondentActorId: text(a.respondentActorId) } : { kind, externalRequestId: text(a.externalRequestId), reporterActorId: text(a.reporterActorId) };
  const target = object(v.target, ["itemId", "groupId"]), mode = choice(v.mode, ["comparison", "direct", "delegated"]);
  const alternatives = unique(list(v.alternatives, (entry) => { const o = object(entry, ["id", "title", "hypothesis", "tradeoff", "artifact"]); return { id: text(o.id), title: text(o.title), hypothesis: text(o.hypothesis), tradeoff: text(o.tradeoff), artifact: parseDesignArtifactRef(o.artifact) }; }, 3), (o) => o.id);
  if (!alternatives.length || mode === "comparison" && alternatives.length < 2) bad("A comparison needs two or three options; a single option requires an explicit direct/delegated mode.");
  if (!alternatives.some((a) => a.id === v.recommendedAlternativeId)) bad("Recommendation names an unknown alternative.");
  return { ...base(v), kind: "comparison", id: text(v.id), revision: integer(v.revision, 1), brief: parseDesignArtifactRef(v.brief), decisionKey: text(v.decisionKey), audience, mode, uncertainty: choice(v.uncertainty, ["structure", "visual"]), scenario: text(v.scenario), fidelity: fidelity(v.fidelity), alternatives, recommendedAlternativeId: text(v.recommendedAlternativeId), recommendation: text(v.recommendation), target: { itemId: nullableText(target.itemId), groupId: nullableText(target.groupId) }, governing: parseDesignGoverning(v.governing), supersedes: v.supersedes === null ? null : source(v.supersedes), correctsDecisionId: nullableText(v.correctsDecisionId), followsResponseId: nullableText(v.followsResponseId) };
}
/** Revision/delegation outcomes are closed typed instructions; option adoption cannot be represented by a response. */
export function parseDesignComparisonResponse(value: unknown): DesignComparisonResponse {
  const v = object(value, [...keys, "comparison", "authority", "outcome", "supersedesResponseId"]); if (v.kind !== "comparison-response") bad("Expected a comparison response.");
  const a = object(v.authority), authorityKind = choice(a.kind, ["human", "external-report"]);
  object(a, authorityKind === "human" ? ["kind"] : ["kind", "externalRequestId", "statement"]);
  const authority: DesignComparisonResponse["authority"] = authorityKind === "human" ? { kind: authorityKind } : { kind: authorityKind, externalRequestId: text(a.externalRequestId), statement: text(a.statement) };
  const o = object(v.outcome), kind = choice(o.kind, ["delegate", "more", "combine", "skip", "dismiss"]);
  object(o, kind === "delegate" ? ["kind", "agentActorId"] : kind === "more" ? ["kind", "count", "instruction"] : kind === "combine" ? ["kind", "parts", "instruction"] : ["kind"]);
  let outcome: DesignComparisonResponse["outcome"];
  if (kind === "delegate") outcome = { kind, agentActorId: text(o.agentActorId) };
  else if (kind === "more") { const count = o.count === null ? null : integer(o.count, 1); if (count !== null && count > 100) bad("Requested exploration count exceeds the protocol bound."); outcome = { kind, count, instruction: nullableText(o.instruction) }; }
  else if (kind === "combine") { const parts = list(o.parts, (entry) => { const p = object(entry, ["optionId", "part"]); return { optionId: text(p.optionId), part: text(p.part) }; }, 32); if (parts.length < 2) bad("A combination identifies at least two parts."); outcome = { kind, parts, instruction: text(o.instruction) }; }
  else outcome = { kind };
  return { ...base(v), kind: "comparison-response", id: text(v.id), comparison: source(v.comparison), authority, outcome, supersedesResponseId: nullableText(v.supersedesResponseId) };
}
/** Full target captures are shared by approval and repair without fabricating another semantic record. */
export function parseDesignTarget(value: unknown): DesignApprovalBasis["target"] {
  const t = object(value, ["artifact", "title", "description", "properties", "scope"]), s = object(t.scope, ["containerId", "scopeIds"]), p = object(t.properties);
  return { artifact: parseDesignArtifactRef(t.artifact), title: optionalWords(t.title), description: optionalWords(t.description), properties: Object.fromEntries(Object.entries(p).map(([key, value]) => [text(key), optionalWords(value)])), scope: { containerId: nullableText(s.containerId), scopeIds: unique(list(s.scopeIds, text, 128), (id) => id) } };
}
/** Validates a persisted approval draft without fabricating a complete decision intent. */
export function parseDesignApprovalBasis(value: unknown): DesignApprovalBasis {
  const v = object(value, ["brief", "epoch", "alternatives", "target", "governing"]);
  return { brief: parseDesignArtifactRef(v.brief), epoch: integer(v.epoch, 1), alternatives: list(v.alternatives, parseDesignArtifactRef, 3), target: parseDesignTarget(v.target), governing: parseDesignGoverning(v.governing) };
}
/** Human words remain nullable; every agent authority branch requires its own explicit rationale. */
export function parseDesignDecisionInput(value: unknown): DesignDecisionInput {
  const v = object(value, ["id", "requestId", "decisionKey", "source", "basis", "chosenAlternativeId", "versionId", "supersedesDecisionId", "authority"]), s = object(v.source), sourceKind = choice(s.kind, ["comparison", "direct"]);
  object(s, sourceKind === "comparison" ? ["kind", "source"] : ["kind", "proposal"]);
  const a = object(v.authority), kind = choice(a.kind, ["human-choice", "canvas-delegation", "external-report", "agent-judgment"]);
  object(a, kind === "human-choice" ? ["kind", "reason"] : kind === "canvas-delegation" ? ["kind", "responseId", "rationale"] : kind === "external-report" ? ["kind", "externalRequestId", "reportedOutcome", "statement", "reportedReason", "rationale"] : ["kind", "rationale"]);
  const authority: DesignDecisionInput["authority"] = kind === "human-choice" ? { kind, reason: nullableText(a.reason) } : kind === "canvas-delegation" ? { kind, responseId: text(a.responseId), rationale: text(a.rationale) } : kind === "external-report" ? { kind, externalRequestId: text(a.externalRequestId), reportedOutcome: choice(a.reportedOutcome, ["choice", "delegation"]), statement: text(a.statement), reportedReason: nullableText(a.reportedReason), rationale: text(a.rationale) } : { kind, rationale: text(a.rationale) };
  return { id: text(v.id), requestId: text(v.requestId), decisionKey: text(v.decisionKey), source: sourceKind === "comparison" ? { kind: sourceKind, source: source(s.source) } : { kind: sourceKind, proposal: parseDesignComparison(s.proposal) }, basis: parseDesignApprovalBasis(v.basis), chosenAlternativeId: text(v.chosenAlternativeId), versionId: text(v.versionId), supersedesDecisionId: nullableText(v.supersedesDecisionId), authority };
}
/** Public comparison writes cannot carry a canonical comment, retained versions or a forged author. */
export function parseDesignCompareOperation(value: unknown): Extract<DesignDecisionOperation, { type: "design.compare" }> { const v = object(value, ["type", "threadId", "commentId", "comparison"]); if (v.type !== "design.compare") bad("Expected design.compare."); return { type: "design.compare", threadId: text(v.threadId), commentId: text(v.commentId), comparison: parseDesignComparison(v.comparison) }; }
/** Public response writes retain explicit typed outcome semantics without modifying adoption. */
export function parseDesignRespondOperation(value: unknown): Extract<DesignDecisionOperation, { type: "design.respond" }> { const v = object(value, ["type", "threadId", "commentId", "response"]); if (v.type !== "design.respond") bad("Expected design.respond."); return { type: "design.respond", threadId: text(v.threadId), commentId: text(v.commentId), response: parseDesignComparisonResponse(v.response) }; }
/** The writer, never public input, constructs the fixed adoption pair. */
export function parseDesignDecideOperation(value: unknown): Extract<DesignDecisionOperation, { type: "design.decide" }> { const v = object(value, ["type", "threadId", "commentId", "decision"]); if (v.type !== "design.decide") bad("Expected design.decide."); return { type: "design.decide", threadId: text(v.threadId), commentId: text(v.commentId), decision: parseDesignDecisionInput(v.decision) }; }
/** Explicit dispatch refuses unknown and internal acts before receipt lookup. */
export function parseDesignDecisionOperation(value: unknown): DesignDecisionOperation { const v = object(value); return v.type === "design.compare" ? parseDesignCompareOperation(v) : v.type === "design.respond" ? parseDesignRespondOperation(v) : parseDesignDecideOperation(v); }
function canonical(value: unknown): string { if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`; if (value !== null && typeof value === "object") return "{" + Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",") + "}"; return JSON.stringify(value); }
/** Exact accepted intent remains confirmable after joins, cancellation and history compaction. */
export async function designDecisionIntentHash(op: DesignDecisionOperation, actorId: string): Promise<string> { const { effect: _effect, canonicalComment: _comment, ...intent } = op as DesignDecisionOperation & { canonicalComment?: unknown; effect?: unknown }; const bytes = new TextEncoder().encode(canonical({ operation: parseDesignDecisionOperation(intent), actorId: text(actorId) })); return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((n) => n.toString(16).padStart(2, "0")).join(""); }
