import { isSystemActor, type CanvasContents } from "./model.ts";
import type { NewVersion, Operation } from "./ops.ts";
import {
  DESIGN_PARTNER_DECISION_PROPERTY, DesignPartnerContractError,
  parseDesignBrief, parseDesignDecision, parseDesignQuestionSet, parseDesignResponse,
  type DesignActorKind, type DesignArtifactRef, type DesignBrief, type DesignDecision,
  type DesignQuestionSet, type DesignQuestionSource, type DesignResponse,
} from "./design-partner.ts";

/** Ports supply these after existing custody/grant/join resolution. They are not credentials. */
interface DesignWriterActor { actorId: string; kind: DesignActorKind }
/** The current brief bytes and their source identity, read together by the calling writer. */
interface ActiveDesignRequest { brief: DesignBrief; ref: DesignArtifactRef }
/** Published question provenance plus current request state; retained bytes alone do not make a question current. */
export interface DesignQuestionContext {
  request: ActiveDesignRequest;
  questions: DesignQuestionSet;
  source: DesignQuestionSource;
  /** The current source was removed or superseded, even if a reader retained its bytes. */
  sourceStatus: "current" | "removed" | "superseded";
}
function refuse(code: DesignPartnerContractError["code"], reason: string): never { throw new DesignPartnerContractError(code, reason); }
/** Full authority and version equality; identical blob bytes on another canvas are a different source. */
function sameDesignArtifact(a: DesignArtifactRef, b: DesignArtifactRef): boolean {
  return a.home === b.home && a.canvasId === b.canvasId && a.itemId === b.itemId && a.versionId === b.versionId && a.blobHash === b.blobHash;
}
function sameQuestion(a: DesignQuestionSource, b: DesignQuestionSource): boolean {
  return a.threadId === b.threadId && a.commentId === b.commentId && a.payloadId === b.payloadId && a.revision === b.revision;
}
function currentRequest(request: ActiveDesignRequest, record: { requestId: string; epoch: number }, basis: DesignArtifactRef): void {
  const brief = parseDesignBrief(request.brief);
  if (brief.requestId !== record.requestId) refuse("association", "This record belongs to another request.");
  if (brief.epoch !== record.epoch || brief.progress !== "active") refuse("stale", "The design request has changed or is no longer active.");
  if (!sameDesignArtifact(request.ref, basis) || brief.context.canvasId !== request.ref.canvasId) refuse("stale", "The record was based on a different brief version.");
}

/** Shape plus explicit association. Calling this does not prove server authorization. */
export function validateDesignResponseAssociation(input: unknown, context: DesignQuestionContext, actor: DesignWriterActor): DesignResponse {
  const response = parseDesignResponse(input), questions = parseDesignQuestionSet(context.questions);
  currentRequest(context.request, questions, questions.brief);
  currentRequest(context.request, response, questions.brief);
  if (context.sourceStatus !== "current") refuse("stale", "The question was removed or superseded.");
  if (questions.id !== context.source.payloadId || questions.revision !== context.source.revision || !sameQuestion(response.question, context.source)) refuse("association", "The answer does not name this exact question version.");
  if (isSystemActor(actor.actorId) || actor.kind !== "human" || actor.actorId !== response.respondentActorId || actor.actorId !== questions.respondentActorId) refuse("actor", "Only the intended human respondent can resolve this question.");
  for (const answer of response.resolutions) {
    const q = questions.questions.find((one) => one.id === answer.questionId);
    if (!q) refuse("association", "The answer names an unknown question.");
    if (answer.state === "skipped" && !q.skippable) refuse("invalid", "This question cannot be skipped.");
    if (answer.state === "delegated" && (!q.delegatable || answer.agentActorId === actor.actorId || isSystemActor(answer.agentActorId))) refuse("actor", "This question cannot be delegated to that actor.");
    if (answer.state !== "answered") continue;
    const value = answer.value;
    if (value.kind === "options") {
      if (q.renderer !== "choice-list" && q.renderer !== "visual-cards") refuse("invalid", "This question does not accept option answers.");
      if (!q.multiple && value.optionIds.length !== 1) refuse("invalid", "This question accepts one option.");
      if (value.optionIds.some((id) => !q.options.some((o) => o.id === id))) refuse("association", "The answer names a removed or unknown option.");
    } else if (value.kind === "references") {
      if (q.renderer !== "upload" && q.renderer !== "url-collection") refuse("invalid", "This question does not accept reference answers.");
      if (q.renderer === "upload" && value.references.some((r) => r.state !== "fetched" || !r.artifact)) refuse("invalid", "An upload answer requires retrievable uploaded versions.");
    } else if (q.renderer === "upload" || q.renderer === "url-collection") refuse("invalid", "Reference questions require identified references.");
    // Text is the explicit Other/freeform escape hatch for choice questions.
  }
  return response;
}

/** Stable serialization allows equal retries regardless of object key order. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value);
}
/** Describes the single reply effect and required guards; it is deliberately not a sendable wire act. */
interface DesignAnswerMaterializationPlan {
  kind: "answer-materialization";
  /** NOT a sendable operation: old daemons drop typed metadata. Phase 1 owns its refusing wire act. */
  reply: Extract<Operation, { type: "thread.reply" }>;
  design: DesignResponse;
  opId: string;
  guard: { requestId: string; epoch: number; brief: DesignArtifactRef; question: DesignQuestionSource };
}
/** An accepted identical retry is an observation and must not create another comment or undo step. */
type DesignAnswerPlan = DesignAnswerMaterializationPlan | { kind: "already-recorded"; responseId: string };
/** This projection is for people. Readers use typed data, never parse these sentences. */
function designResponseMarkdown(response: DesignResponse, questions: DesignQuestionSet): string {
  return ["Design answers", ...response.resolutions.map((answer) => {
    const q = questions.questions.find((one) => one.id === answer.questionId)!;
    let value: string;
    if (answer.state === "answered") {
      const result = answer.value;
      value = result.kind === "text" ? result.text : result.kind === "options" ? result.optionIds.map((id) => q.options.find((o) => o.id === id)!.title).join(", ") : result.references.map((r) => `${r.url ?? r.artifact!.itemId} (${r.state})`).join(", ");
    } else value = answer.state === "delegated" ? `Delegated to ${answer.agentActorId}` : answer.state === "skipped" ? "Skipped" : "Dismissed";
    return `- ${q.title}: ${value}`;
  })].join("\n");
}
/** Associates outcomes and supersession with one source; the future serialized writer must enforce its guards. */
export function planDesignAnswer(input: {
  response: unknown; context: DesignQuestionContext; actor: DesignWriterActor;
  commentId: string; opId: string; previousResponses?: readonly DesignResponse[];
}): DesignAnswerPlan {
  const response = parseDesignResponse(input.response);
  if (!input.commentId.trim() || !input.opId.trim()) refuse("invalid", "Retry identities must be generated before submitting.");
  const previous = (input.previousResponses ?? []).map(parseDesignResponse);
  const retry = previous.find((r) => r.id === response.id);
  if (retry) {
    if (canonical(retry) !== canonical(response)) refuse("conflict", "The response identity was reused with different content.");
    if (input.context.request.brief.requestId !== response.requestId) refuse("association", "The accepted answer belongs to another request.");
    if (input.actor.actorId !== retry.respondentActorId || isSystemActor(input.actor.actorId)) refuse("actor", "Only the original respondent may retry this answer.");
    return { kind: "already-recorded", responseId: response.id };
  }
  validateDesignResponseAssociation(response, input.context, input.actor);
  if (response.supersedesResponseId !== null) {
    const replaced = previous.find((r) => r.id === response.supersedesResponseId);
    if (!replaced || replaced.respondentActorId !== response.respondentActorId || !sameQuestion(replaced.question, response.question) || replaced.requestId !== response.requestId || replaced.epoch !== response.epoch) refuse("association", "The superseded response does not belong to this respondent and question.");
    if (previous.some((r) => r.supersedesResponseId === replaced.id)) refuse("stale", "This answer has already been superseded.");
    if (replaced.resolutions.some((prior) => !response.resolutions.some((next) => next.questionId === prior.questionId))) refuse("invalid", "A replacement must retain an explicit resolution for every previously answered question.");
  }
  const live = previous.filter((r) => r.requestId === response.requestId && r.epoch === response.epoch && sameQuestion(r.question, response.question) && !previous.some((other) => other.supersedesResponseId === r.id) && r.id !== response.supersedesResponseId);
  if (live.some((r) => r.resolutions.some((a) => response.resolutions.some((b) => a.questionId === b.questionId)))) refuse("conflict", "This question already has an answer; supersede it explicitly.");
  return { kind: "answer-materialization", reply: { type: "thread.reply", threadId: response.question.threadId, comment: { id: input.commentId, body: designResponseMarkdown(response, input.context.questions) } }, design: response, opId: input.opId, guard: { requestId: response.requestId, epoch: response.epoch, brief: structuredClone(input.context.request.ref), question: structuredClone(response.question) } };
}

/** One existing conditional edit preserves target content and decision metadata under the same undo. */
interface DesignDecisionPlan {
  kind: "decision-edit";
  operation: Extract<Operation, { type: "item.edit" }>;
  opId: string;
  /** Existing item.edit only enforces target conditions. The future writer also enforces these. */
  guard: { requestId: string; epoch: number; brief: DesignArtifactRef; alternatives: DesignArtifactRef[] };
}
/** Plans faithful adoption only into the brief's target or greenfield winner; it does not enforce concurrency. */
export function planDesignDecision(input: {
  decision: unknown; request: ActiveDesignRequest; actor: DesignWriterActor;
  canvas: CanvasContents; home: string; opId: string;
  /** A writer-validated, currently effective delegation, not a quoted human sentence. */
  delegation?: DesignResponse;
}): DesignDecisionPlan {
  const decision: DesignDecision = parseDesignDecision(input.decision);
  currentRequest(input.request, decision, decision.brief);
  if (!input.request.brief.outstandingDecisionIds.includes(decision.questionId)) refuse("association", "This decision is not outstanding in the current brief.");
  if (input.actor.actorId !== decision.decidingActorId || isSystemActor(input.actor.actorId)) refuse("actor", "A decision must be attributed to its authenticated actor.");
  if (!input.opId.trim()) refuse("invalid", "A decision requires a retry identity.");
  if (decision.attribution === "human-choice") {
    if (input.actor.kind !== "human") refuse("actor", "Only a known human actor can supply a human preference.");
  } else {
    const delegation = input.delegation && parseDesignResponse(input.delegation);
    if (input.actor.kind !== "agent" || !delegation || delegation.id !== decision.delegationResponseId || delegation.requestId !== decision.requestId || delegation.epoch !== decision.epoch || !delegation.resolutions.some((r) => r.questionId === decision.questionId && r.state === "delegated" && r.agentActorId === input.actor.actorId)) refuse("actor", "An agent decision requires the effective delegation for this question.");
  }
  const target = input.canvas.items[decision.adoption.targetItemId];
  if (!target || target.currentVersionId !== decision.adoption.expectedVersionId) refuse("stale", "The adoption target changed.");
  if (target.id === input.request.ref.itemId) refuse("invalid", "A design cannot replace its brief.");
  const chosen = decision.alternatives.find((a) => a.id === decision.chosenAlternativeId)!;
  if (input.request.brief.targetItemId !== null ? target.id !== input.request.brief.targetItemId : target.id !== chosen.artifact.itemId) refuse("association", "Adoption must use the brief's target, or the selected candidate for a greenfield request.");
  if (target.versions.some((v) => v.id === decision.adoption.versionId)) refuse("conflict", "The adoption version already exists.");
  const priorRaw = target.properties[DESIGN_PARTNER_DECISION_PROPERTY];
  let prior: DesignDecision | undefined;
  if (priorRaw !== undefined) { try { prior = parseDesignDecision(JSON.parse(priorRaw)); } catch { refuse("conflict", "The target has an unreadable decision; reconcile it first."); } }
  if ((prior?.id ?? null) !== decision.supersedesDecisionId) refuse("stale", "The target's accepted decision changed.");
  for (const alternative of decision.alternatives) {
    const ref = alternative.artifact, item = input.canvas.items[ref.itemId], version = item?.versions.find((v) => v.id === ref.versionId);
    if (ref.home !== input.home || ref.canvasId !== input.request.ref.canvasId || !item || item.currentVersionId !== ref.versionId || version?.blobHash !== ref.blobHash) refuse("stale", "An alternative is unavailable or changed; refresh the comparison.");
  }
  const source = input.canvas.items[chosen.artifact.itemId]!.versions.find((v) => v.id === chosen.artifact.versionId)!;
  const current = target.versions.find((v) => v.id === target.currentVersionId);
  if (!current || current.mimeType !== source.mimeType) refuse("invalid", "The selected content type cannot replace this target.");
  const version: NewVersion = { id: decision.adoption.versionId, blobHash: source.blobHash, mimeType: source.mimeType, filename: current.filename, size: source.size, ...(source.visual === undefined ? {} : { visual: structuredClone(source.visual) }) };
  return { kind: "decision-edit", opId: input.opId, operation: { type: "item.edit", itemId: target.id, expectedVersionId: target.currentVersionId, expectedMetadata: { title: target.title, properties: structuredClone(target.properties) }, version, patch: { properties: { [DESIGN_PARTNER_DECISION_PROPERTY]: JSON.stringify(decision) } } }, guard: { requestId: decision.requestId, epoch: decision.epoch, brief: structuredClone(decision.brief), alternatives: decision.alternatives.map((a) => structuredClone(a.artifact)) } };
}
