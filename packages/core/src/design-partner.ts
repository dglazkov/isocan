import { validateContextManifest, type ContextManifest } from "./canvas-group-context.ts";

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
interface DesignReference {
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
interface DesignQuestion {
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
type DesignResolution =
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

export class DesignPartnerContractError extends Error {
  constructor(readonly code: "invalid" | "association" | "actor" | "stale" | "conflict", message: string) {
    super(message); this.name = "DesignPartnerContractError";
  }
}
const bad = (message: string): never => { throw new DesignPartnerContractError("invalid", message); };
const object = (v: unknown, fields?: readonly string[]): Record<string, unknown> => {
  if (v === null || typeof v !== "object" || Array.isArray(v)) return bad("Expected an object.");
  if (fields && Object.keys(v).some((key) => !fields.includes(key))) bad("Unknown field in design-partner record.");
  return v as Record<string, unknown>;
};
const recordFields = ["schemaVersion", "requestId", "epoch", "kind"];
const text = (v: unknown): string => typeof v === "string" && v.trim().length > 0 && v.length <= 32000 ? v : bad("Expected nonempty bounded text.");
const bool = (v: unknown): boolean => typeof v === "boolean" ? v : bad("Expected a boolean.");
const integer = (v: unknown, min = 0): number => Number.isSafeInteger(v) && (v as number) >= min ? v as number : bad("Expected an integer in range.");
const choice = <T extends string>(v: unknown, values: readonly T[]): T => values.includes(v as T) ? v as T : bad(`Expected one of ${values.join(", ")}.`);
const list = <T>(v: unknown, parse: (entry: unknown) => T, max = 1000): T[] => Array.isArray(v) && v.length <= max ? v.map(parse) : bad("Expected a bounded array.");
const nonempty = <T>(items: T[]): T[] => items.length ? items : bad("Expected at least one entry.");
const unique = <T>(items: T[], key: (item: T) => string): T[] => new Set(items.map(key)).size === items.length ? items : bad("Repeated identity.");
const ids = (v: unknown): string[] => unique(list(v, text), (x) => x);
const nullableText = (v: unknown): string | null => v === null ? null : text(v);
const url = (v: unknown): string => {
  const value = text(v);
  let parsed: URL; try { parsed = new URL(value); } catch { return bad("Expected an absolute HTTP(S) URL."); }
  if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password) bad("Expected an HTTP(S) URL without credentials.");
  return value;
};
const fidelity = (v: unknown): DesignFidelity => choice(v, ["wireframe", "designed", "implementation"]);
const hash = (v: unknown): string => typeof v === "string" && /^[a-f0-9]{64}$/.test(v) ? v : bad("Expected a lowercase SHA-256 blob identity.");
function base(v: Record<string, unknown>): DesignRecordBase {
  if (v.schemaVersion !== 1) bad("Unsupported design-partner schema version.");
  return { schemaVersion: 1, requestId: text(v.requestId), epoch: integer(v.epoch, 1) };
}
/** Checks source/version/hash shape without claiming the caller can access or has inspected its bytes. */
function parseDesignArtifactRef(value: unknown): DesignArtifactRef {
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
/** Reuses the retained-context validator and preserves known facts separately from stated assumptions. */
export function parseDesignBrief(value: unknown): DesignBrief {
  const v = object(value, [...recordFields, "requestingActorId", "source", "progress", "intent", "fidelity", "delivery", "targetItemId", "groupId", "audience", "primaryTask", "constraints", "facts", "context", "references", "outstandingDecisionIds", "outputIds"]); if (v.kind !== "brief") bad("Expected a brief.");
  const rawSource = object(v.source);
  const entrance = choice(rawSource.entrance, ["canvas-chat", "external-agent"]);
  object(rawSource, entrance === "canvas-chat" ? ["entrance", "threadId", "commentId"] : ["entrance", "externalRequestId"]);
  const source: DesignBrief["source"] = entrance === "canvas-chat" ? { entrance, threadId: text(rawSource.threadId), commentId: text(rawSource.commentId) } : { entrance, externalRequestId: text(rawSource.externalRequestId) };
  const rawContext = object(v.context);
  validateContextManifest(rawContext as unknown as ContextManifest, text(rawContext.canvasId));
  return { ...base(v), kind: "brief", requestingActorId: text(v.requestingActorId), source,
    progress: choice(v.progress, ["active", "cancelled", "completed"]), intent: choice(v.intent, ["create", "extend", "refine"]), fidelity: fidelity(v.fidelity), delivery: choice(v.delivery, ["html-node", "connected-app", "wireframe", "exploration"]), targetItemId: nullableText(v.targetItemId), groupId: nullableText(v.groupId), audience: nullableText(v.audience), primaryTask: nullableText(v.primaryTask), constraints: list(v.constraints, text),
    facts: unique(list(v.facts, (entry) => { const f = object(entry, ["id", "name", "value", "origin", "sources"]); return { id: text(f.id), name: text(f.name), value: text(f.value), origin: choice(f.origin, ["supplied", "context", "assumed"]), sources: list(f.sources, parseDesignArtifactRef) }; }), (f) => f.id),
    context: structuredClone(rawContext) as unknown as ContextManifest, references: unique(list(v.references, parseDesignReference), (r) => r.id), outstandingDecisionIds: ids(v.outstandingDecisionIds), outputIds: ids(v.outputIds),
  };
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
