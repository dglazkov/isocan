import type { Actor, CanvasContents, Comment, Item } from "./model.ts";
import { currentDesignScope } from "./design-decision-state.ts";
import { sameActor, type ActorJoins } from "./identity.ts";
import type { Operation } from "./ops.ts";
import type { DesignArtifactRef, DesignQuestionSource } from "./design-partner.ts";
import type { DesignGoverningBinding } from "./design-request.ts";
import type { QuestionnaireRetainedReference } from "./questionnaire.ts";
export { parseDesignTarget, parseDesignApprovalBasis, parseDesignComparison, parseDesignComparisonResponse, parseDesignDecisionInput, parseDesignCompareOperation, parseDesignRespondOperation, parseDesignDecideOperation, parseDesignDecisionOperation, designDecisionIntentHash } from "./design-decision-parse.ts";

/** Scope facts are captured before approval; current membership cannot be silently substituted at save. */
export interface DesignScopeBasis { containerId: string | null; scopeIds: string[] }
/** A comparison identifies actual alternatives and its audience without inventing a canvas human for native dialogue. */
export interface DesignComparison {
  schemaVersion: 1; kind: "comparison"; id: string; revision: number;
  requestId: string; epoch: number; brief: DesignArtifactRef; decisionKey: string;
  audience: { kind: "human"; respondentActorId: string } | { kind: "external-agent"; externalRequestId: string; reporterActorId: string };
  mode: "comparison" | "direct" | "delegated";
  uncertainty: "structure" | "visual"; scenario: string;
  fidelity: "wireframe" | "designed" | "implementation";
  alternatives: Array<{ id: string; title: string; hypothesis: string; tradeoff: string; artifact: DesignArtifactRef }>;
  recommendedAlternativeId: string; recommendation: string;
  target: { itemId: string | null; groupId: string | null };
  governing: DesignGoverningBinding;
  supersedes: DesignQuestionSource | null;
  correctsDecisionId: string | null;
  followsResponseId: string | null;
}
/** Non-adopting instructions remain typed and distinguish a real human act from native dialogue reporting. */
export interface DesignComparisonResponse {
  schemaVersion: 1; kind: "comparison-response"; id: string;
  requestId: string; epoch: number; comparison: DesignQuestionSource;
  authority: { kind: "human" } | { kind: "external-report"; externalRequestId: string; statement: string };
  outcome:
    | { kind: "delegate"; agentActorId: string }
    | { kind: "more"; count: number | null; instruction: string | null }
    | { kind: "combine"; parts: Array<{ optionId: string; part: string }>; instruction: string }
    | { kind: "skip" | "dismiss" };
  supersedesResponseId: string | null;
}
/** Approval binds content, human-visible metadata and scope, separately from an option's authored recommendation. */
export interface DesignApprovalBasis {
  brief: DesignArtifactRef; epoch: number;
  alternatives: DesignArtifactRef[];
  target: { artifact: DesignArtifactRef; title: string; description: string; properties: Record<string, string>; scope: DesignScopeBasis };
  governing: DesignGoverningBinding;
}
/** Closed adoption intent: caller names evidence and authority branch; only the writer supplies authorship and effects. */
export interface DesignDecisionInput {
  id: string; requestId: string; decisionKey: string;
  source: { kind: "comparison"; source: DesignQuestionSource } | { kind: "direct"; proposal: DesignComparison };
  basis: DesignApprovalBasis;
  chosenAlternativeId: string; versionId: string; supersedesDecisionId: string | null;
  authority:
    | { kind: "human-choice"; reason: string | null }
    | { kind: "canvas-delegation"; responseId: string; rationale: string }
    | { kind: "external-report"; externalRequestId: string; reportedOutcome: "choice" | "delegation"; statement: string; reportedReason: string | null; rationale: string }
    | { kind: "agent-judgment"; rationale: string };
}
/** The canonical immutable decision preserves the full comparison, original recommendation author and adopted identity. */
export interface DesignDecisionRecord {
  schemaVersion: 1; kind: "adoption-decision";
  input: DesignDecisionInput; comparison: DesignComparison; recommendationAuthor: Actor;
  adopted: DesignArtifactRef;
}
/** Canonical comment metadata cannot be supplied by ordinary comment or public design writes. */
export interface DesignDecisionComment {
  schemaVersion: 1; opId: string; intentHash: string;
  record: DesignComparison | DesignComparisonResponse | DesignDecisionRecord;
}
/** Exactly one target edit and one comment form an adoption; this is not an arbitrary transaction API. */
export interface DesignDecisionEffect { edit: Extract<Operation, { type: "item.edit" }>; threadId: string; comment: Comment }
/** Internal restoration owns only a target version and its associated immutable decision comment. */
export interface DesignRestoreEffect {
  target: DesignApprovalBasis["target"];
  item: Extract<Operation, { type: "item.removeVersion" | "item.restoreVersion" }>;
  threadId: string; commentId: string;
  expectedComment: Comment | null; comment: Comment | null;
}
/** Direct aliases preserve the enumerable public operation vocabulary and the explicit internal inverse. */
export type DesignDecisionOperation = Extract<Operation, { type: "design.compare" | "design.respond" | "design.decide" }>;
/** Exact source records and their effective responses are shared by both clients, including honest local stale reasons. */
export interface DesignComparisonState {
  source: DesignQuestionSource; comparison: DesignComparison; author: Actor;
  responses: Array<{ source: DesignQuestionSource; response: DesignComparisonResponse; author: Actor }>;
  /** Current admitted external request custody, resolved by the writer; null is never inferred as a reporter. */
  currentReporterActorId: string | null;
  /** A present adoption settles this source; corrections require a newly reviewed comparison. */
  adoptedDecisionId: string | null;
  effectiveResponse: { source: DesignQuestionSource; response: DesignComparisonResponse; author: Actor } | null;
  status: "open" | "settled" | "superseded" | "stale";
  reasons: string[]; references: QuestionnaireRetainedReference[];
}
/** Historical acceptance is distinct from whether the original artifacts remain current and readable. */
export interface DesignDecisionState {
  source: DesignQuestionSource; decision: DesignDecisionRecord; author: Actor;
  opId: string; intentHash: string;
  standing: "effective" | "superseded" | "undone" | "removed";
  status: "current" | "stale" | "unavailable"; reasons: string[];
  references: QuestionnaireRetainedReference[];
}
/** The authoritative read combines comments with existing log history; no browser-only decision ledger is needed. */
export interface DesignDecisionsResponse { comparisons: DesignComparisonState[]; decisions: DesignDecisionState[]; unavailable: Array<{ id: string; reason: string }> }
/** Both entrances use the same permission-bearing read endpoint. */
export const designDecisionsRoute = (canvasId: string): string => `/api/projects/${encodeURIComponent(canvasId)}/design/decisions`;
/** Both preparation clients capture identical current membership and legacy scope order. */
export function designDecisionScope(canvas: CanvasContents, item: Item): DesignScopeBasis { const current = canvas.items[item.id]; if (!current) throw new Error("The adoption target is unavailable."); return currentDesignScope(canvas, current); }
/** Display eligibility follows canonical audience/outcomes; the serialized writer still rechecks actual custody. */
export function designComparisonActions(state: DesignComparisonState, actor: { id: string; kind: "human" | "agent" | "unknown" }, joined?: ActorJoins): { respond: boolean; authorities: Array<DesignDecisionInput["authority"]["kind"]> } {
  if (state.status === "stale" || state.status === "superseded" || state.adoptedDecisionId !== null) return { respond: false, authorities: [] };
  const a = state.comparison.audience, outcome = state.effectiveResponse?.response.outcome;
  const human = a.kind === "human" && actor.kind === "human" && sameActor(joined, a.respondentActorId, actor.id);
  const native = a.kind === "external-agent" && actor.kind === "agent" && state.currentReporterActorId !== null && sameActor(joined, state.currentReporterActorId, actor.id);
  const delegated = actor.kind === "agent" && state.effectiveResponse?.response.authority.kind === "human" && outcome?.kind === "delegate" && sameActor(joined, outcome.agentActorId, actor.id);
  const revision = outcome?.kind === "more" || outcome?.kind === "combine";
  return { respond: human || native, authorities: revision ? [] : human ? ["human-choice"] : native ? ["external-report"] : delegated ? ["canvas-delegation"] : [] };
}

/** Authored outstanding keys remain unchanged; only effective adoptions of this admitted epoch settle their read projection. */
export function effectiveOutstandingDecisionIds(brief: Pick<import("./design-partner.ts").DesignBrief, "requestId" | "epoch" | "outstandingDecisionIds">, briefItemId: string, decisions: readonly DesignDecisionState[]): string[] {
  const settled = new Set(decisions.filter((row) => row.standing === "effective" && row.decision.input.requestId === brief.requestId && row.decision.input.basis.brief.itemId === briefItemId && row.decision.input.basis.epoch === brief.epoch).map((row) => row.decision.input.decisionKey));
  return brief.outstandingDecisionIds.filter((id) => !settled.has(id));
}
