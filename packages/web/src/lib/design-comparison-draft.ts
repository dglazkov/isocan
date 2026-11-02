import { isOpId } from "@isocan/core";
import type { DesignQuestionSource } from "@isocan/core";
import { parseDesignApprovalBasis, parseDesignComparison, parseDesignDecisionOperation, type DesignApprovalBasis, type DesignComparison } from "@isocan/core/design-decision";
import type { DesignComparisonView, DesignDecideRequest, DesignRespondRequest, DesignDecisionSubmission } from "@isocan/api/design-decision";

/** A choice begins with the versions and metadata on screen, before a person presses Use. */
export interface DesignComparisonDraft {
  schemaVersion: 1; canvasId: string; actorId: string; source: DesignQuestionSource; comparison: DesignComparison;
  bases: Array<{ alternativeId: string; basis: DesignApprovalBasis | null }>;
  choice: string; reason: string;
  responseMode: "choose" | "delegate" | "more" | "combine" | "skip" | "dismiss";
  agentId: string; count: string; instruction: string; parts: Array<{ optionId: string; part: string }>;
  supersedesResponseId: string | null;
  pending: { kind: "decide"; request: DesignDecideRequest; refused: boolean } | { kind: "respond"; request: DesignRespondRequest; refused: boolean } | null;
  accepted: Pick<DesignDecisionSubmission, "payloadId" | "opId" | "submittedOpId" | "confirmedBy" | "consistency"> & { kind: "decide" | "respond" } | null;
}
const stable = (value: unknown): string => Array.isArray(value) ? `[${value.map(stable).join(",")}]` : value !== null && typeof value === "object" ? `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, one]) => `${JSON.stringify(key)}:${stable(one)}`).join(",")}}` : JSON.stringify(value);
/** The key contains the full respondent and source scope; one canvas cannot resume another canvas's intent. */
export function designComparisonDraftKey(canvasId: string, actorId: string, source: DesignQuestionSource): string {
  return `isocan.design.comparison.v1:${JSON.stringify([canvasId, actorId, source.threadId, source.commentId, source.payloadId, source.revision])}`;
}
/** All targets are captured together so changing the selected radio never silently refreshes its approval. */
export function newDesignComparisonDraft(canvasId: string, actorId: string, row: Pick<DesignComparisonView, "source" | "comparison" | "approvalBases">): DesignComparisonDraft {
  return { schemaVersion: 1, canvasId, actorId, source: structuredClone(row.source), comparison: structuredClone(row.comparison), bases: structuredClone(row.approvalBases.map(({ alternativeId, basis }) => ({ alternativeId, basis }))), choice: "", reason: "", responseMode: "choose", agentId: "", count: "", instruction: "", parts: row.comparison.alternatives.map((option) => ({ optionId: option.id, part: "" })), supersedesResponseId: null, pending: null, accepted: null };
}
/** Polling updates eligibility, not captured approval; only an explicit reviewed refresh replaces this basis. */
export function designComparisonDraftChanged(draft: DesignComparisonDraft, row: Pick<DesignComparisonView, "source" | "comparison" | "approvalBases">): boolean {
  return stable(draft.source) !== stable(row.source) || stable(draft.comparison) !== stable(row.comparison) || stable(draft.bases) !== stable(row.approvalBases.map(({ alternativeId, basis }) => ({ alternativeId, basis })));
}
/** Nested draft data must be valid before rendering; incomplete human prose remains editable. */
export function readDesignComparisonDraft(raw: string, canvasId: string, actorId: string): DesignComparisonDraft {
  const value = JSON.parse(raw) as DesignComparisonDraft;
  const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
  const words = (v: unknown): v is string => typeof v === "string" && v.length <= 32000;
  if (!object(value) || value.schemaVersion !== 1 || value.canvasId !== canvasId || value.actorId !== actorId || !object(value.source) || ![value.source.threadId, value.source.commentId, value.source.payloadId].every(words) || !Number.isSafeInteger(value.source.revision) || value.source.revision < 1) throw new Error("The saved comparison belongs to a different person/source or is malformed.");
  const comparison = parseDesignComparison(value.comparison);
  if (comparison.id !== value.source.payloadId || comparison.revision !== value.source.revision || ![value.choice, value.reason, value.agentId, value.count, value.instruction].every(words) || !["choose", "delegate", "more", "combine", "skip", "dismiss"].includes(value.responseMode) || value.supersedesResponseId !== null && !words(value.supersedesResponseId)) throw new Error("The saved comparison fields are malformed.");
  if (!Array.isArray(value.bases) || value.bases.length !== comparison.alternatives.length || new Set(value.bases.map((one) => one?.alternativeId)).size !== value.bases.length) throw new Error("The saved approval bases are incomplete.");
  const bases = value.bases.map((one) => {
    if (!object(one) || !comparison.alternatives.some((option) => option.id === one.alternativeId)) throw new Error("The saved approval names an unknown option.");
    return { alternativeId: one.alternativeId, basis: one.basis === null ? null : parseDesignApprovalBasis(one.basis) };
  });
  if (!Array.isArray(value.parts) || value.parts.length > 3 || value.parts.some((one) => !object(one) || !words(one.part) || !comparison.alternatives.some((option) => option.id === one.optionId))) throw new Error("The saved combination parts are malformed.");
  const pending = value.pending;
  if (pending !== null) {
    if (!object(pending) || !["decide", "respond"].includes(pending.kind) || typeof pending.refused !== "boolean" || !object(pending.request) || !isOpId(pending.request.opId) || pending.request.canvasId !== canvasId || pending.request.threadId !== value.source.threadId || !words(pending.request.commentId)) throw new Error("The saved comparison retry is malformed.");
    const operation = parseDesignDecisionOperation(pending.kind === "decide" ? { type: "design.decide", threadId: pending.request.threadId, commentId: pending.request.commentId, decision: (pending.request as DesignDecideRequest).decision } : { type: "design.respond", threadId: pending.request.threadId, commentId: pending.request.commentId, response: (pending.request as DesignRespondRequest).response });
    const requestSource = operation.type === "design.decide" && operation.decision.source.kind === "comparison" ? operation.decision.source.source : operation.type === "design.respond" ? operation.response.comparison : null;
    if (!requestSource || stable(requestSource) !== stable(value.source) || operation.type === "design.decide" && operation.decision.requestId !== comparison.requestId || operation.type === "design.respond" && operation.response.requestId !== comparison.requestId) throw new Error("The saved retry belongs to another comparison.");
  }
  const accepted = value.accepted;
  if (accepted !== null && (!object(accepted) || !["decide", "respond"].includes(accepted.kind) || !words(accepted.payloadId) || !isOpId(accepted.submittedOpId) || accepted.opId !== null && !isOpId(accepted.opId) || accepted.confirmedBy !== undefined && !["receipt", "snapshot"].includes(accepted.confirmedBy))) throw new Error("The saved comparison confirmation is malformed.");
  if (accepted?.consistency !== undefined && (!["current", "stale", "unavailable"].includes(accepted.consistency.status) || !Array.isArray(accepted.consistency.reasons) || !accepted.consistency.reasons.every(words))) throw new Error("The saved acknowledgement consistency is malformed.");
  if (accepted && pending) throw new Error("A confirmed action cannot also be pending.");
  return { ...value, comparison, bases };
}
