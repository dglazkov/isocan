import { canonicalJson } from "./canonical-json.ts";
import { object, text, integer, choice, list, unique, ids, nullableText, fidelity, bool, bad, parseDesignArtifactRef, parseDesignReference, parseDesignEntranceSource, parseDesignAcceptedResponses } from "./design-partner-values.ts";
export { parseDesignContinuation, parseDesignDiscovery, parseDesignGoverning } from "./design-partner-values.ts";
import { parseDesignReceipt } from "./design-partner.ts";
import type { DesignBriefFields, DesignRequestAction, DesignRecordOperation } from "./design-request.ts";
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
    return { kind, requestId: text(v.requestId), itemId: text(v.itemId), versionId: text(v.versionId), source: parseDesignEntranceSource(v.source), fields: fields(v.fields, false) as DesignBriefFields, admission: choice(v.admission, ["explicit", "automatic"]), ...(v.contextRequest === undefined ? {} : { contextRequest: contextRequest(v.contextRequest) }), ...position(v) };
  }
  object(v, ["kind", "brief", "epoch", "versionId", ...(kind === "cancel" ? ["reason"] : ["patch", "acceptedResponses", ...(kind === "resume" ? ["reason", "contextRequest"] : [])])]);
  const basis = { brief: parseDesignArtifactRef(v.brief), epoch: integer(v.epoch, 1), versionId: text(v.versionId) };
  if (kind === "cancel") return { kind, ...basis, ...(v.reason === undefined ? {} : { reason: text(v.reason) }) };
  const changes = { ...(v.patch === undefined ? {} : { patch: fields(v.patch, true) }), ...(v.acceptedResponses === undefined ? {} : { acceptedResponses: parseDesignAcceptedResponses(v.acceptedResponses) }) };
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
/** Snapshot recovery hashes validated intent with its immutable authenticated author, after join-aware matching. */
export async function designIntentHash(operation: DesignRecordOperation, authoredActorId: string): Promise<string> {
  const { effect: _effect, ...publicIntent } = operation;
  const bytes = new TextEncoder().encode(canonicalJson({ operation: parseDesignRequestOperation(publicIntent), actorId: text(authoredActorId) }));
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((n) => n.toString(16).padStart(2, "0")).join("");
}
