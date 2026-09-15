import { bad, object, recordFields, text, bool, integer, choice, list, nonempty, unique, ids, nullableText, url, fidelity, hash, base } from "./design-partner-values.ts";
import { parseDesignBrief } from "./design-brief.ts";
export { parseDesignBrief } from "./design-brief.ts";
import type { ContextManifest } from "./canvas-group-context.ts";

/** Phase-0 data contract. Parsing proves shape, never custody, grants or inspection. */
const DESIGN_PARTNER_SCHEMA_VERSION = 1;
/** Workflow default is adaptive; explicit interviews may exceed it within the protocol bound. */
const DESIGN_PARTNER_INITIAL_QUESTION_BUDGET = 3;
/** Maximum published batch size; explicit interviews may exceed the initial workflow budget. */
const DESIGN_PARTNER_MAX_QUESTIONS = 32;
/** Decision metadata travels with the adopted target's conditional content edit and inverse. */
export const DESIGN_PARTNER_DECISION_PROPERTY = "designPartner.decision";
/** Canvas-owned rollout setting, shared by the browser and external-agent entrances. */
const DESIGN_PARTNER_POLICY_PROPERTY = "design.workflow";
/** Unsupported values remain visible and cannot accidentally enable automatic enrollment. */
type DesignPartnerPolicy = "off" | "adaptive-v1" | "unsupported";
/** Writer-resolved classification; a missing agent-map entry does not establish a human. */
export type DesignActorKind = "human" | "agent" | "unknown";
/** Presentation intent, independent of request progress and verification status. */
type DesignFidelity = "wireframe" | "designed" | "implementation";

/** A hash alone cannot identify which permitted source supplied an artifact. */
export interface DesignArtifactRef {
  home: string;
  canvasId: string;
  itemId: string;
  versionId: string;
  blobHash: string;
}
interface DesignRecordBase { schemaVersion: 1; requestId: string; epoch: number }
/** Supplied locations and inspected bytes are distinct states; unavailable sources retain a reason. */
export interface DesignReference {
  id: string;
  state: "supplied" | "fetched" | "inaccessible" | "superseded";
  url?: string;
  artifact?: DesignArtifactRef;
  reason?: string;
}
/** Versioned request facts owned by the canvas; projections must preserve provenance and assumptions. */
export interface DesignBrief extends DesignRecordBase {
  kind: "brief";
  requestingActorId: string;
  source: { entrance: "canvas-chat"; threadId: string; commentId: string }
    | { entrance: "external-agent"; externalRequestId: string };
  progress: "active" | "cancelled" | "completed";
  intent: "create" | "extend" | "refine";
  fidelity: DesignFidelity;
  delivery: "html-node" | "connected-app" | "wireframe" | "exploration";
  targetItemId: string | null;
  groupId: string | null;
  audience: string | null;
  primaryTask: string | null;
  constraints: string[];
  facts: Array<{ id: string; name: string; value: string; origin: "supplied" | "context" | "assumed"; sources: DesignArtifactRef[] }>;
  context: ContextManifest;
  references: DesignReference[];
  outstandingDecisionIds: string[];
  outputIds: string[];
}
/** An identified answer choice explains its consequence and may point to an actual preview version. */
interface DesignQuestionOption { id: string; title: string; consequence: string; preview?: DesignArtifactRef }
/** Renderer-specific input semantics; permission to skip or delegate is explicit for each question. */
export interface DesignQuestion {
  id: string;
  title: string;
  consequence: string;
  renderer: "choice-list" | "visual-cards" | "freeform" | "url-collection" | "upload";
  options: DesignQuestionOption[];
  multiple: boolean;
  skippable: boolean;
  delegatable: boolean;
  recommendedOptionId?: string;
}
/** Reissue changes with a new payload id; never edit published typed questions. */
export interface DesignQuestionSet extends DesignRecordBase {
  kind: "questions";
  id: string;
  revision: number;
  brief: DesignArtifactRef;
  respondentActorId: string;
  headline: string;
  inferredAnswers: Array<{ questionId: string; value: string; sources: DesignArtifactRef[] }>;
  questions: DesignQuestion[];
  supersedes: DesignQuestionSource | null;
}
/** Exact immutable published source; a title or latest thread message cannot substitute for identity. */
export interface DesignQuestionSource { threadId: string; commentId: string; payloadId: string; revision: number }
/** One explicit outcome; skipped, dismissed and delegated states never imply a supplied answer. */
export type DesignResolution =
  | { questionId: string; state: "answered"; value: { kind: "options"; optionIds: string[] } | { kind: "text"; text: string } | { kind: "references"; references: DesignReference[] } }
  | { questionId: string; state: "skipped" | "dismissed" }
  | { questionId: string; state: "delegated"; agentActorId: string };
/** Published respondent outcomes linked to their exact source; changes explicitly supersede a prior response. */
export interface DesignResponse extends DesignRecordBase {
  kind: "response";
  id: string;
  question: DesignQuestionSource;
  respondentActorId: string;
  resolutions: DesignResolution[];
  supersedesResponseId: string | null;
}
/** Attributed direction choice and version adoption, retaining the comparison and its reasoning. */
export interface DesignDecision extends DesignRecordBase {
  kind: "decision";
  id: string;
  brief: DesignArtifactRef;
  questionId: string;
  uncertainty: "structure" | "visual";
  alternatives: Array<{ id: string; hypothesis: string; fidelity: DesignFidelity; artifact: DesignArtifactRef }>;
  recommendedAlternativeId: string;
  chosenAlternativeId: string;
  recommendation: string;
  tradeoff: string;
  reason: string;
  decidingActorId: string;
  attribution: "human-choice" | "delegated-agent";
  delegationResponseId: string | null;
  /** The source version and target version are different identities even in greenfield work. */
  adoption: { targetItemId: string; expectedVersionId: string; versionId: string };
  supersedesDecisionId: string | null;
}
/** Identifies the actual delivery surface; a repository result also requires its build and running address. */
type DesignOutputIdentity = { kind: "canvas"; artifact: DesignArtifactRef }
  | { kind: "repository"; repository: string; revision: string; buildId: string; runtimeUrl: string };
/** Scoped completion evidence, independent of craft preference; references make later staleness detectable. */
export interface DesignReceipt extends DesignRecordBase {
  kind: "receipt";
  id: string;
  brief: DesignArtifactRef;
  output: DesignOutputIdentity;
  context: DesignArtifactRef[];
  fidelity: DesignFidelity;
  status: "draft" | "ready";
  checks: Array<{
    id: string;
    kind: "source" | "browser-task" | "craft";
    tool: string;
    toolVersion: string;
    result: "passed" | "failed" | "unavailable";
    coverage: string;
    state: string;
    viewport: { width: number; height: number } | null;
    evidence: DesignArtifactRef[];
  }>;
  unresolved: Array<{ severity: "critical" | "noncritical"; description: string }>;
}
/** Closed persisted record family; unsupported kinds require a deliberate schema change. */
type DesignPartnerRecord = DesignBrief | DesignQuestionSet | DesignResponse | DesignDecision | DesignReceipt;

export { DesignPartnerContractError } from "./design-partner-values.ts";
/** Checks source/version/hash shape without claiming the caller can access or has inspected its bytes. */
export function parseDesignArtifactRef(value: unknown): DesignArtifactRef {
  const v = object(value, ["home", "canvasId", "itemId", "versionId", "blobHash"]);
  return { home: url(v.home), canvasId: text(v.canvasId), itemId: text(v.itemId), versionId: text(v.versionId), blobHash: hash(v.blobHash) };
}
/** Refuses filename-only uploads and fetched URLs without version identities; availability stays explicit. */
export function parseDesignReference(value: unknown): DesignReference {
  const v = object(value, ["id", "state", "url", "artifact", "reason"]);
  const state = choice(v.state, ["supplied", "fetched", "inaccessible", "superseded"]);
  const result: DesignReference = { id: text(v.id), state,
    ...(v.url === undefined ? {} : { url: url(v.url) }),
    ...(v.artifact === undefined ? {} : { artifact: parseDesignArtifactRef(v.artifact) }),
    ...(v.reason === undefined ? {} : { reason: text(v.reason) }),
  };
  if (!result.url && !result.artifact) bad("A reference requires an actual URL or artifact identity, not a filename.");
  if (state === "fetched" && !result.artifact) bad("A fetched reference requires retrievable version identity.");
  if ((state === "inaccessible" || state === "superseded") && !result.reason) bad("Unavailable references require a reason.");
  return result;
}
function questionSource(value: unknown): DesignQuestionSource {
  const v = object(value, ["threadId", "commentId", "payloadId", "revision"]); return { threadId: text(v.threadId), commentId: text(v.commentId), payloadId: text(v.payloadId), revision: integer(v.revision, 1) };
}
function question(value: unknown): DesignQuestion {
  const v = object(value, ["id", "title", "consequence", "renderer", "options", "multiple", "skippable", "delegatable", "recommendedOptionId"]);
  const renderer = choice(v.renderer, ["choice-list", "visual-cards", "freeform", "url-collection", "upload"]);
  const options = unique(list(v.options, (entry) => {
    const o = object(entry, ["id", "title", "consequence", "preview"]);
    return { id: text(o.id), title: text(o.title), consequence: text(o.consequence), ...(o.preview === undefined ? {} : { preview: parseDesignArtifactRef(o.preview) }) };
  }, 12), (o) => o.id);
  const isChoice = renderer === "choice-list" || renderer === "visual-cards";
  if (isChoice ? options.length < 2 : options.length !== 0) bad("Options must match the question renderer.");
  if (renderer === "visual-cards" && options.some((o) => !o.preview)) bad("Visual alternatives require actual version previews.");
  const result: DesignQuestion = { id: text(v.id), title: text(v.title), consequence: text(v.consequence), renderer, options, multiple: bool(v.multiple), skippable: bool(v.skippable), delegatable: bool(v.delegatable), ...(v.recommendedOptionId === undefined ? {} : { recommendedOptionId: text(v.recommendedOptionId) }) };
  if (result.recommendedOptionId && !options.some((o) => o.id === result.recommendedOptionId)) bad("Recommendation names an unknown option.");
  if (!isChoice && result.multiple) bad("Only option questions may select multiple options.");
  return result;
}
/** Validates immutable questions, unique choices and real visual-preview identities before publication. */
export function parseDesignQuestionSet(value: unknown): DesignQuestionSet {
  const v = object(value, [...recordFields, "id", "revision", "brief", "respondentActorId", "headline", "inferredAnswers", "questions", "supersedes"]); if (v.kind !== "questions") bad("Expected questions.");
  return { ...base(v), kind: "questions", id: text(v.id), revision: integer(v.revision, 1), brief: parseDesignArtifactRef(v.brief), respondentActorId: text(v.respondentActorId), headline: text(v.headline), inferredAnswers: unique(list(v.inferredAnswers, (entry) => { const a = object(entry, ["questionId", "value", "sources"]); return { questionId: text(a.questionId), value: text(a.value), sources: list(a.sources, parseDesignArtifactRef) }; }), (a) => a.questionId), questions: unique(nonempty(list(v.questions, question, DESIGN_PARTNER_MAX_QUESTIONS)), (q) => q.id), supersedes: v.supersedes === null ? null : questionSource(v.supersedes) };
}
function resolution(value: unknown): DesignResolution {
  const v = object(value, ["questionId", "state", "value", "agentActorId"]);
  const questionId = text(v.questionId), state = choice(v.state, ["answered", "skipped", "dismissed", "delegated"]);
  if (state === "skipped" || state === "dismissed") {
    if (v.value !== undefined || v.agentActorId !== undefined) bad("Skipped/dismissed is not an answer.");
    return { questionId, state };
  }
  if (state === "delegated") {
    if (v.value !== undefined) bad("Delegation is not an answer.");
    return { questionId, state, agentActorId: text(v.agentActorId) };
  }
  const answer = object(v.value), kind = choice(answer.kind, ["options", "text", "references"]);
  object(answer, ["kind", kind === "options" ? "optionIds" : kind === "text" ? "text" : "references"]);
  if (v.agentActorId !== undefined) bad("An answer cannot also carry delegation.");
  if (kind === "options") return { questionId, state, value: { kind, optionIds: nonempty(ids(answer.optionIds)) } };
  if (kind === "text") return { questionId, state, value: { kind, text: text(answer.text) } };
  return { questionId, state, value: { kind, references: unique(nonempty(list(answer.references, parseDesignReference, 20)), (r) => r.id) } };
}
/** Validates outcome shape; source freshness, respondent custody and allowed choices need association checks. */
export function parseDesignResponse(value: unknown): DesignResponse {
  const v = object(value, [...recordFields, "id", "question", "respondentActorId", "resolutions", "supersedesResponseId"]); if (v.kind !== "response") bad("Expected a response.");
  return { ...base(v), kind: "response", id: text(v.id), question: questionSource(v.question), respondentActorId: text(v.respondentActorId), resolutions: unique(nonempty(list(v.resolutions, resolution, DESIGN_PARTNER_MAX_QUESTIONS)), (r) => r.questionId), supersedesResponseId: nullableText(v.supersedesResponseId) };
}
/** Checks comparable alternatives and attribution consistency, without authorizing adoption into a target. */
export function parseDesignDecision(value: unknown): DesignDecision {
  const v = object(value, [...recordFields, "id", "brief", "questionId", "uncertainty", "alternatives", "recommendedAlternativeId", "chosenAlternativeId", "recommendation", "tradeoff", "reason", "decidingActorId", "attribution", "delegationResponseId", "adoption", "supersedesDecisionId"]); if (v.kind !== "decision") bad("Expected a decision.");
  const adoption = object(v.adoption, ["targetItemId", "expectedVersionId", "versionId"]);
  const result: DesignDecision = { ...base(v), kind: "decision", id: text(v.id), brief: parseDesignArtifactRef(v.brief), questionId: text(v.questionId), uncertainty: choice(v.uncertainty, ["structure", "visual"]), alternatives: unique(nonempty(list(v.alternatives, (entry) => {
    const a = object(entry, ["id", "hypothesis", "fidelity", "artifact"]); return { id: text(a.id), hypothesis: text(a.hypothesis), fidelity: fidelity(a.fidelity), artifact: parseDesignArtifactRef(a.artifact) };
  }, 3)), (a) => a.id), recommendedAlternativeId: text(v.recommendedAlternativeId), chosenAlternativeId: text(v.chosenAlternativeId), recommendation: text(v.recommendation), tradeoff: text(v.tradeoff), reason: text(v.reason), decidingActorId: text(v.decidingActorId), attribution: choice(v.attribution, ["human-choice", "delegated-agent"]), delegationResponseId: nullableText(v.delegationResponseId), adoption: { targetItemId: text(adoption.targetItemId), expectedVersionId: text(adoption.expectedVersionId), versionId: text(adoption.versionId) }, supersedesDecisionId: nullableText(v.supersedesDecisionId) };
  if (![result.chosenAlternativeId, result.recommendedAlternativeId].every((id) => result.alternatives.some((a) => a.id === id))) bad("Decision names an unknown alternative.");
  if (new Set(result.alternatives.map((a) => a.fidelity)).size > 1) bad("Compare alternatives at the same fidelity.");
  if (result.attribution === "human-choice" ? result.delegationResponseId !== null : result.delegationResponseId === null) bad("Decision attribution and delegation source disagree.");
  if (result.adoption.expectedVersionId === result.adoption.versionId) bad("Adoption requires a fresh target version.");
  return result;
}
/** Checks readiness and evidence shape; actual inspection requires separate proof beyond record validation. */
export function parseDesignReceipt(value: unknown): DesignReceipt {
  const v = object(value, [...recordFields, "id", "brief", "output", "context", "fidelity", "status", "checks", "unresolved"]); if (v.kind !== "receipt") bad("Expected a receipt.");
  const rawOutput = object(v.output), outputKind = choice(rawOutput.kind, ["canvas", "repository"]);
  object(rawOutput, outputKind === "canvas" ? ["kind", "artifact"] : ["kind", "repository", "revision", "buildId", "runtimeUrl"]);
  const output: DesignOutputIdentity = outputKind === "canvas" ? { kind: outputKind, artifact: parseDesignArtifactRef(rawOutput.artifact) } : { kind: outputKind, repository: text(rawOutput.repository), revision: text(rawOutput.revision), buildId: text(rawOutput.buildId), runtimeUrl: url(rawOutput.runtimeUrl) };
  const result: DesignReceipt = { ...base(v), kind: "receipt", id: text(v.id), brief: parseDesignArtifactRef(v.brief), output, context: list(v.context, parseDesignArtifactRef), fidelity: fidelity(v.fidelity), status: choice(v.status, ["draft", "ready"]),
    checks: unique(list(v.checks, (entry) => {
      const c = object(entry, ["id", "kind", "tool", "toolVersion", "result", "coverage", "state", "viewport", "evidence"]), viewport = c.viewport === null ? null : object(c.viewport, ["width", "height"]);
      return { id: text(c.id), kind: choice(c.kind, ["source", "browser-task", "craft"]), tool: text(c.tool), toolVersion: text(c.toolVersion), result: choice(c.result, ["passed", "failed", "unavailable"]), coverage: text(c.coverage), state: text(c.state), viewport: viewport === null ? null : { width: integer(viewport.width, 1), height: integer(viewport.height, 1) }, evidence: list(c.evidence, parseDesignArtifactRef) };
    }), (c) => c.id), unresolved: list(v.unresolved, (entry) => { const u = object(entry, ["severity", "description"]); return { severity: choice(u.severity, ["critical", "noncritical"]), description: text(u.description) }; }),
  };
  if (result.checks.some((c) => c.kind === "browser-task" && c.result === "passed" && (!c.viewport || !c.evidence.length))) bad("Browser evidence requires a viewport and retrievable evidence.");
  if (result.status === "ready" && (result.unresolved.some((u) => u.severity === "critical") || result.checks.some((c) => c.result === "failed") || !result.checks.some((c) => c.kind === "browser-task" && c.result === "passed"))) bad("Ready cannot be claimed without browser/task evidence or with known failures.");
  return result;
}
/** Dispatches the persisted schema explicitly; unknown kinds and future semantics are refused. */
export function parseDesignPartnerRecord(value: unknown): DesignPartnerRecord {
  switch (object(value).kind) {
    case "brief": return parseDesignBrief(value);
    case "questions": return parseDesignQuestionSet(value);
    case "response": return parseDesignResponse(value);
    case "decision": return parseDesignDecision(value);
    case "receipt": return parseDesignReceipt(value);
    default: return bad("Unknown design-partner record kind.");
  }
}
/** Unknown policy never silently enables automatic enrollment. */
export function designPartnerPolicy(properties: Readonly<Record<string, string>>): DesignPartnerPolicy {
  const value = properties[DESIGN_PARTNER_POLICY_PROPERTY];
  return value === undefined || value === "off" ? "off" : value === "adaptive-v1" ? value : "unsupported";
}
