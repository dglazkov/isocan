import type { DesignAcceptedResponse, DesignContinuation, DesignDiscovery, DesignGoverningBinding } from "./design-request.ts";

/** A hash alone cannot identify which permitted source supplied an artifact. */
export interface DesignArtifactRef {
  home: string;
  canvasId: string;
  itemId: string;
  versionId: string;
  blobHash: string;
}
/** Supplied locations and inspected bytes are distinct states; unavailable sources retain a reason. */
export interface DesignReference {
  id: string;
  state: "supplied" | "fetched" | "inaccessible" | "superseded";
  url?: string;
  artifact?: DesignArtifactRef;
  reason?: string;
}
/** Shape or association refusal; authentication remains the writer’s separate responsibility. */
export class DesignPartnerContractError extends Error {
  constructor(readonly code: "invalid" | "association" | "actor" | "stale" | "conflict", message: string) {
    super(message); this.name = "DesignPartnerContractError";
  }
}
/** Raises a schema error without implying custody or inspection. */
export const bad = (message: string): never => { throw new DesignPartnerContractError("invalid", message); };
/** Rejects unknown semantic fields before projecting a persisted record. */
export const object = (v: unknown, fields?: readonly string[]): Record<string, unknown> => {
  if (v === null || typeof v !== "object" || Array.isArray(v)) return bad("Expected an object.");
  if (fields && Object.keys(v).some((key) => !fields.includes(key))) bad("Unknown field in design-partner record.");
  return v as Record<string, unknown>;
};
/** Common version and request keys used by each strict record parser. */
export const recordFields = ["schemaVersion", "requestId", "epoch", "kind"];
/** Requires bounded nonempty text for persisted identities and prose. */
export const text = (v: unknown): string => typeof v === "string" && v.trim().length > 0 && v.length <= 32000 ? v : bad("Expected nonempty bounded text.");
/** Rejects coercion of persisted booleans. */
export const bool = (v: unknown): boolean => typeof v === "boolean" ? v : bad("Expected a boolean.");
/** Requires a safe integral protocol value at the stated lower bound. */
export const integer = (v: unknown, min = 0): number => Number.isSafeInteger(v) && (v as number) >= min ? v as number : bad("Expected an integer in range.");
/** Accepts only explicitly supported semantic enum values. */
export const choice = <T extends string>(v: unknown, values: readonly T[]): T => values.includes(v as T) ? v as T : bad(`Expected one of ${values.join(", ")}.`);
/** Bounds persisted arrays and validates each entry. */
export const list = <T>(v: unknown, parse: (entry: unknown) => T, max = 1000): T[] => Array.isArray(v) && v.length <= max ? v.map(parse) : bad("Expected a bounded array.");
/** Requires at least one explicit entry for an answer or comparison. */
export const nonempty = <T>(items: T[]): T[] => items.length ? items : bad("Expected at least one entry.");
/** Rejects repeated identities within one persisted collection. */
export const unique = <T>(items: T[], key: (item: T) => string): T[] => new Set(items.map(key)).size === items.length ? items : bad("Repeated identity.");
/** Validates a bounded unique collection of textual identities. */
export const ids = (v: unknown): string[] => unique(list(v, text), (x) => x);
/** Preserves an explicit absent fact while validating provided text. */
export const nullableText = (v: unknown): string | null => v === null ? null : text(v);
/** Checks absolute HTTP(S) reference locations without fetching them. */
export const url = (v: unknown): string => {
  const value = text(v);
  let parsed: URL; try { parsed = new URL(value); } catch { return bad("Expected an absolute HTTP(S) URL."); }
  if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password) bad("Expected an HTTP(S) URL without credentials.");
  return value;
};
/** Keeps presentation fidelity independent of request progress. */
export const fidelity = (v: unknown): "wireframe" | "designed" | "implementation" => choice(v, ["wireframe", "designed", "implementation"]);
/** Requires a lowercase SHA-256 content identity. */
export const hash = (v: unknown): string => typeof v === "string" && /^[a-f0-9]{64}$/.test(v) ? v : bad("Expected a lowercase SHA-256 blob identity.");
/** Validates common schema version, request identity and epoch. */
export function base(v: Record<string, unknown>): { schemaVersion: 1; requestId: string; epoch: number } {
  if (v.schemaVersion !== 1) bad("Unsupported design-partner schema version.");
  return { schemaVersion: 1, requestId: text(v.requestId), epoch: integer(v.epoch, 1) };
}
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
/** Parses the entrance source of a design brief or interview. */
export function parseDesignEntranceSource(value: unknown): import("./design-partner.ts").DesignBrief["source"] {
  const v = object(value), entrance = choice(v.entrance, ["canvas-chat", "external-agent"]);
  object(v, entrance === "canvas-chat" ? ["entrance", "threadId", "commentId"] : ["entrance", "externalRequestId"]);
  return entrance === "canvas-chat" ? { entrance, threadId: text(v.threadId), commentId: text(v.commentId) } : { entrance, externalRequestId: text(v.externalRequestId) };
}
/** Parses a question source reference. */
export function parseDesignQuestionSource(value: unknown): import("./design-partner.ts").DesignQuestionSource {
  const v = object(value, ["threadId", "commentId", "payloadId", "revision"]);
  return { threadId: text(v.threadId), commentId: text(v.commentId), payloadId: text(v.payloadId), revision: integer(v.revision, 1) };
}
/** Parses a list of accepted response references. */
export function parseDesignAcceptedResponses(value: unknown): DesignAcceptedResponse[] {
  return unique(list(value, (entry) => { const v = object(entry, ["question", "responseId"]); return { question: parseDesignQuestionSource(v.question), responseId: text(v.responseId) }; }), (v) => v.responseId);
}
/** Validates writer-stamped continuation facts without elevating native reports into human responses. */
export function parseDesignContinuation(value: unknown): DesignContinuation {
  const v = object(value, ["sourceCapture", "scopeCapture", "acceptedResponses", "factProvenance", "resumedBy"]);
  const capture = v.sourceCapture === null ? null : object(v.sourceCapture, ["bodyHash", "boundaryCommentId"]);
  const scope = object(v.scopeCapture, ["kind", "revision"]);
  const resumed = v.resumedBy === undefined ? undefined : object(v.resumedBy, ["actorId", "reason"]);
  return { sourceCapture: capture && { bodyHash: hash(capture.bodyHash), boundaryCommentId: text(capture.boundaryCommentId) }, scopeCapture: { kind: choice(scope.kind, ["source-comment", "current-selection", "current-ambient"]), revision: integer(scope.revision) }, acceptedResponses: parseDesignAcceptedResponses(v.acceptedResponses), factProvenance: unique(list(v.factProvenance, (entry) => { const f = object(entry, ["field", "actorId", "kind", "responseId"]); const kind = choice(f.kind, ["direct", "reported", "questionnaire"]); if ((kind === "questionnaire") !== (f.responseId !== undefined)) bad("Questionnaire provenance requires its accepted response."); return { field: text(f.field), actorId: text(f.actorId), kind, ...(f.responseId === undefined ? {} : { responseId: text(f.responseId) }) }; }), (f) => f.field), ...(resumed ? { resumedBy: { actorId: text(resumed.actorId), reason: text(resumed.reason) } } : {}) };
}
/** Explicit purpose and fact bindings support a request-wide initial discovery allowance. */
export function parseDesignDiscovery(value: unknown): DesignDiscovery {
  const v = object(value, ["purpose", "reason", "source", "factBindings"]), purpose = choice(v.purpose, ["initial", "consequential", "interview"]);
  if (purpose !== "initial" && v.reason === undefined || purpose === "interview" && v.source === undefined) bad("Additional discovery needs a reason and interviews need provenance.");
  return { purpose, ...(v.reason === undefined ? {} : { reason: text(v.reason) }), ...(v.source === undefined ? {} : { source: parseDesignEntranceSource(v.source) }), factBindings: unique(list(v.factBindings, (entry) => { const f = object(entry, ["questionId", "factId"]); return { questionId: text(f.questionId), factId: text(f.factId) }; }, 32), (f) => f.questionId) };
}
/** The expected governing winner is separate from the list of incidental input references. */
export function parseDesignGoverning(value: unknown): DesignGoverningBinding {
  const v = object(value, ["atItemId", "artifact", "explicitNone"]);
  return { atItemId: nullableText(v.atItemId), artifact: v.artifact === null ? null : parseDesignArtifactRef(v.artifact), explicitNone: bool(v.explicitNone) };
}
