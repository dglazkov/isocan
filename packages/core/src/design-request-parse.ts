import { object, text, integer, choice, list, unique, ids, nullableText, fidelity, bool, hash, bad } from "./design-partner-values.ts";
import { parseDesignArtifactRef, parseDesignReference, parseDesignReceipt } from "./design-partner.ts";
import type { DesignBriefFields, DesignContinuation, DesignDiscovery, DesignGoverningBinding, DesignRequestAction, DesignAcceptedResponse, DesignRecordOperation } from "./design-request.ts";
import type { ContextRequest } from "./canvas-group-context.ts";
import type { Placement } from "./ops.ts";

const fieldNames = ["intent", "fidelity", "delivery", "targetItemId", "groupId", "audience", "primaryTask", "constraints", "facts", "references", "outstandingDecisionIds", "outputIds"];
function fields(value: unknown, partial: boolean): DesignBriefFields | Partial<DesignBriefFields> {
  const v = object(value, fieldNames), result: Record<string, unknown> = {};
  const parsers: Record<string, (v: unknown) => unknown> = {
    intent: (x) => choice(x, ["create", "extend", "refine"]), fidelity,
    delivery: (x) => choice(x, ["html-node", "connected-app", "wireframe", "exploration"]),
    targetItemId: nullableText, groupId: nullableText, audience: nullableText, primaryTask: nullableText,
    constraints: (x) => list(x, text),
    facts: (x) => unique(list(x, (entry) => { const f = object(entry, ["id", "name", "value", "origin", "sources"]); return { id: text(f.id), name: text(f.name), value: text(f.value), origin: choice(f.origin, ["supplied", "context", "assumed"]), sources: list(f.sources, parseDesignArtifactRef) }; }), (f) => f.id),
    references: (x) => unique(list(x, parseDesignReference), (r) => r.id), outstandingDecisionIds: ids, outputIds: ids,
  };
  for (const key of fieldNames) if (!partial || v[key] !== undefined) result[key] = parsers[key]!(v[key]);
  return result as unknown as DesignBriefFields;
}
function source(value: unknown): import("./design-partner.ts").DesignBrief["source"] {
  const v = object(value), entrance = choice(v.entrance, ["canvas-chat", "external-agent"]);
  object(v, entrance === "canvas-chat" ? ["entrance", "threadId", "commentId"] : ["entrance", "externalRequestId"]);
  return entrance === "canvas-chat" ? { entrance, threadId: text(v.threadId), commentId: text(v.commentId) } : { entrance, externalRequestId: text(v.externalRequestId) };
}
function questionSource(value: unknown): import("./design-partner.ts").DesignQuestionSource {
  const v = object(value, ["threadId", "commentId", "payloadId", "revision"]);
  return { threadId: text(v.threadId), commentId: text(v.commentId), payloadId: text(v.payloadId), revision: integer(v.revision, 1) };
}
function responses(value: unknown): DesignAcceptedResponse[] {
  return unique(list(value, (entry) => { const v = object(entry, ["question", "responseId"]); return { question: questionSource(v.question), responseId: text(v.responseId) }; }), (v) => v.responseId);
}
/** Validates writer-stamped continuation facts without elevating native reports into human responses. */
export function parseDesignContinuation(value: unknown): DesignContinuation {
  const v = object(value, ["sourceCapture", "scopeCapture", "acceptedResponses", "factProvenance", "resumedBy"]);
  const capture = v.sourceCapture === null ? null : object(v.sourceCapture, ["bodyHash", "boundaryCommentId"]);
  const scope = object(v.scopeCapture, ["kind", "revision"]);
  const resumed = v.resumedBy === undefined ? undefined : object(v.resumedBy, ["actorId", "reason"]);
  return { sourceCapture: capture && { bodyHash: hash(capture.bodyHash), boundaryCommentId: text(capture.boundaryCommentId) }, scopeCapture: { kind: choice(scope.kind, ["source-comment", "current-selection", "current-ambient"]), revision: integer(scope.revision) }, acceptedResponses: responses(v.acceptedResponses), factProvenance: unique(list(v.factProvenance, (entry) => { const f = object(entry, ["field", "actorId", "kind", "responseId"]); const kind = choice(f.kind, ["direct", "reported", "questionnaire"]); if ((kind === "questionnaire") !== (f.responseId !== undefined)) bad("Questionnaire provenance requires its accepted response."); return { field: text(f.field), actorId: text(f.actorId), kind, ...(f.responseId === undefined ? {} : { responseId: text(f.responseId) }) }; }), (f) => f.field), ...(resumed ? { resumedBy: { actorId: text(resumed.actorId), reason: text(resumed.reason) } } : {}) };
}
/** Explicit purpose and fact bindings support a request-wide initial discovery allowance. */
export function parseDesignDiscovery(value: unknown): DesignDiscovery {
  const v = object(value, ["purpose", "reason", "source", "factBindings"]), purpose = choice(v.purpose, ["initial", "consequential", "interview"]);
  if (purpose !== "initial" && v.reason === undefined || purpose === "interview" && v.source === undefined) bad("Additional discovery needs a reason and interviews need provenance.");
  return { purpose, ...(v.reason === undefined ? {} : { reason: text(v.reason) }), ...(v.source === undefined ? {} : { source: source(v.source) }), factBindings: unique(list(v.factBindings, (entry) => { const f = object(entry, ["questionId", "factId"]); return { questionId: text(f.questionId), factId: text(f.factId) }; }, 32), (f) => f.questionId) };
}
/** The expected governing winner is separate from the list of incidental input references. */
export function parseDesignGoverning(value: unknown): DesignGoverningBinding {
  const v = object(value, ["atItemId", "artifact", "explicitNone"]);
  const result = { atItemId: nullableText(v.atItemId), artifact: v.artifact === null ? null : parseDesignArtifactRef(v.artifact), explicitNone: bool(v.explicitNone) };
  return result;
}
function contextRequest(value: unknown): ContextRequest {
  const v = object(value, ["rootIds", "includeExcluded", "expectedRevision"]);
  return { rootIds: ids(v.rootIds), ...(v.includeExcluded === undefined ? {} : { includeExcluded: bool(v.includeExcluded) }), ...(v.expectedRevision === undefined ? {} : { expectedRevision: integer(v.expectedRevision) }) };
}
function placement(value: unknown): Placement {
  const v = object(value, ["x", "y", "chosen", "anchorItemId"]);
  if (v.anchorItemId !== undefined) { if (v.x !== undefined || v.y !== undefined || v.chosen !== undefined) bad("An anchor cannot also name coordinates."); return { anchorItemId: text(v.anchorItemId) }; }
  if (typeof v.x !== "number" || !Number.isFinite(v.x) || typeof v.y !== "number" || !Number.isFinite(v.y)) bad("Placement needs finite coordinates.");
  return { x: v.x as number, y: v.y as number, ...(v.chosen === undefined ? {} : { chosen: bool(v.chosen) }) };
}
function position(v: Record<string, unknown>): { placement?: Placement; width?: number; height?: number; title?: string } {
  return { ...(v.placement === undefined ? {} : { placement: placement(v.placement) }), ...(v.width === undefined ? {} : { width: integer(v.width, 1) }), ...(v.height === undefined ? {} : { height: integer(v.height, 1) }), ...(v.title === undefined ? {} : { title: text(v.title) }) };
}
/** Rejects unsupported lifecycle fields before any writer mutation or retry lookup. */
export function parseDesignRequestAction(value: unknown): DesignRequestAction {
  const v = object(value), kind = choice(v.kind, ["start", "update", "resume", "cancel", "complete"]);
  if (kind === "start") {
    object(v, ["kind", "requestId", "itemId", "versionId", "source", "fields", "admission", "contextRequest", "placement", "width", "height", "title"]);
    return { kind, requestId: text(v.requestId), itemId: text(v.itemId), versionId: text(v.versionId), source: source(v.source), fields: fields(v.fields, false) as DesignBriefFields, admission: choice(v.admission, ["explicit", "automatic"]), ...(v.contextRequest === undefined ? {} : { contextRequest: contextRequest(v.contextRequest) }), ...position(v) };
  }
  object(v, ["kind", "brief", "epoch", "versionId", ...(kind === "cancel" ? ["reason"] : ["patch", "acceptedResponses", ...(kind === "resume" ? ["reason", "contextRequest"] : [])])]);
  const basis = { brief: parseDesignArtifactRef(v.brief), epoch: integer(v.epoch, 1), versionId: text(v.versionId) };
  if (kind === "cancel") return { kind, ...basis, ...(v.reason === undefined ? {} : { reason: text(v.reason) }) };
  const changes = { ...(v.patch === undefined ? {} : { patch: fields(v.patch, true) }), ...(v.acceptedResponses === undefined ? {} : { acceptedResponses: responses(v.acceptedResponses) }) };
  return kind === "resume" ? { kind, ...basis, ...changes, reason: text(v.reason), ...(v.contextRequest === undefined ? {} : { contextRequest: contextRequest(v.contextRequest) }) } : { kind, ...basis, ...changes };
}
/** Parses either public design act; canonical effects are refused at the public boundary. */
export function parseDesignRequestOperation(value: unknown): DesignRecordOperation {
  const v = object(value);
  if (v.type === "design.request") { object(v, ["type", "action"]); return { type: v.type, action: parseDesignRequestAction(v.action) }; }
  object(v, ["type", "itemId", "versionId", "receipt", "placement", "width", "height", "title"]);
  if (v.type !== "design.receipt") bad("Expected a design request or receipt act.");
  return { type: "design.receipt", itemId: text(v.itemId), versionId: text(v.versionId), receipt: parseDesignReceipt(v.receipt), ...position(v) };
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") return "{" + Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",") + "}";
  return JSON.stringify(value);
}
/** Snapshot recovery hashes validated intent with its immutable authenticated author, after join-aware matching. */
export async function designIntentHash(operation: DesignRecordOperation, authoredActorId: string): Promise<string> {
  const { effect: _effect, ...publicIntent } = operation;
  const bytes = new TextEncoder().encode(canonical({ operation: parseDesignRequestOperation(publicIntent), actorId: text(authoredActorId) }));
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((n) => n.toString(16).padStart(2, "0")).join("");
}
