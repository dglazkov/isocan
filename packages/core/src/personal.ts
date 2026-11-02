import type { Capability } from "./grants.ts";
import type { PostOpResponse } from "./protocol.ts";

/** A tool's explicit restriction, additional to its bearer credential. */
export type PersonalSourcePolicy =
  | { readonly mode: "exclude" }
  | { readonly mode: "direct"; readonly actorId: string; readonly intent: "read" | "edit" | "own" };

/** Immutable per-call policy; cancellation is local and never serialized. */
export interface SourceRequestContext {
  readonly policy: PersonalSourcePolicy;
  readonly expectedHome?: string;
  readonly signal?: AbortSignal;
}

/** JSON and raw transports carry the same selected-actor restriction. */
export const SOURCE_POLICY_HEADER = "X-Isocan-Source-Policy";

/** Reject malformed restrictions rather than silently falling back to badge standing. */
export function parseSourcePolicyHeader(value: string): Omit<SourceRequestContext, "signal"> {
  if (value.length > 4096) throw new Error("source policy is too large");
  const row = JSON.parse(value) as Record<string, unknown>;
  if (!row || typeof row !== "object" || Array.isArray(row) ||
      Object.keys(row).some((key) => key !== "policy" && key !== "expectedHome") ||
      (row.expectedHome !== undefined && (typeof row.expectedHome !== "string" || !row.expectedHome))) {
    throw new Error("invalid source policy");
  }
  const policy = row.policy as Record<string, unknown>;
  if (!policy || typeof policy !== "object" || Array.isArray(policy)) throw new Error("invalid source policy");
  if (policy.mode === "exclude" && Object.keys(policy).length === 1) {
    return Object.freeze({ policy: Object.freeze({ mode: "exclude" as const }),
      ...(typeof row.expectedHome === "string" ? { expectedHome: row.expectedHome } : {}) });
  }
  if (policy.mode !== "direct" || Object.keys(policy).length !== 3 ||
      typeof policy.actorId !== "string" || !policy.actorId || policy.actorId.length > 256 ||
      (policy.intent !== "read" && policy.intent !== "edit" && policy.intent !== "own")) {
    throw new Error("invalid source policy");
  }
  return Object.freeze({ policy: Object.freeze({ mode: "direct" as const, actorId: policy.actorId, intent: policy.intent }),
    ...(typeof row.expectedHome === "string" ? { expectedHome: row.expectedHome } : {}) });
}

/** Validate a fresh copy so later caller mutation cannot change an in-flight request. */
export function sourcePolicyHeader(context: SourceRequestContext): string {
  return JSON.stringify(parseSourcePolicyHeader(JSON.stringify({ policy: context.policy,
    ...(context.expectedHome !== undefined ? { expectedHome: context.expectedHome } : {}) })));
}

/** Classification reveals no source title, owner, content or admission. */
export interface SourceClassificationRequest { canvasId: string; expectedHome: string }
/** Unknown authority stays redacted, just as a known personal source does. */
export interface SourceClassificationResponse { kind: "ordinary" | "personal" | "unavailable" }
/** Discovery never uses a link grant; exact entry may use a current one. */
export interface SourceAccessRequest extends SourceClassificationRequest {
  lookup: "discovery" | "entry";
  policy: PersonalSourcePolicy;
}
/** This answer is not a lease: the actual request rechecks the same policy. */
export interface SourceAccessResponse {
  kind: "ordinary" | "personal";
  capability: Capability;
}

/** Lifecycle is metadata, independent of loading private canvas contents. */
export type PersonalSourceState = "reserved" | "live" | "deleted" | "taken-down" | "purged" | "unavailable";
/** Display labels may change; canonical identity is the authority. */
interface PersonalOwner { id: string; name: string }
/** A preserved joined dataset retains its address and privacy classification. */
interface PersonalSourceStatus { canvasId: string; state: PersonalSourceState }
/** Status is read-only; only ensure can reserve and privately create a source. */
export interface PersonalStatusResponse {
  home: string;
  owner: PersonalOwner;
  source: PersonalSourceStatus | null;
  preserved: PersonalSourceStatus[];
}
/** Repeated ensure calls return the same binding, including lifecycle refusals. */
export interface PersonalEnsureResponse extends PersonalStatusResponse { created: boolean }
/** The deliberate shared disclosure: address and owner label, never a private preview. */
export interface PersonalLinkStatus {
  itemId: string;
  owner: PersonalOwner;
  sourceCanvasId: string;
  home: string;
  linked: boolean;
  available: boolean;
  refused?: string;
}
/** Current concrete cards, in reading order, with caller-specific availability. */
export interface PersonalLinksResponse { links: PersonalLinkStatus[] }
/** One gesture identity survives retries, while relinking chooses a fresh identity. */
export interface PersonalLinkRequest { actorId: string; requestId: string }
/** Unlink is an ordinary card deletion; its consent survives for undo. */
export interface PersonalUnlinkRequest extends PersonalLinkRequest { itemId: string }
/** A live existing link needs no operation; a new link is one native group operation. */
export interface PersonalLinkResponse { link: PersonalLinkStatus; receipt: PostOpResponse | null }
/** The ordinary delete receipt keeps unlink undoable by its owner. */
export interface PersonalUnlinkResponse { receipt: PostOpResponse }
/** Source-specific delegation is private state, separate from canvas sharing. */
export interface PersonalDelegate { agentId: string; allowed: boolean; at: string; byOwnerId: string }
/** Only the canonical source owner may enumerate this access list. */
export interface PersonalDelegatesResponse { sourceCanvasId: string; delegates: PersonalDelegate[] }
/** Revocation changes the next authoritative read without rewriting a visible card. */
export interface SetPersonalDelegateRequest { actorId: string; allowed: boolean }
/** A successful access decision returned to the owner. */
export interface PersonalDelegateResponse { delegation: PersonalDelegate }
/** Summary reads never load blobs; content pagination binds to the current contribution set. */
export type PersonalReadRequest = { actorId: string; itemId: string } & (
  | { mode: "summary" }
  | { mode: "content"; cursor?: string; limit?: number }
);
/** Private provenance is returned only after owner/delegate and concrete-card checks. */
export interface PersonalPiece {
  kind: "design" | "pin";
  itemId: string;
  title: string;
  versionId: string | null;
  mimeType: string | null;
  text?: string;
  bytes?: number;
  unavailable?: string;
}
/** Neither mode includes a raw snapshot, Chat, or general write capability. */
export interface PersonalReadResponse {
  kind: "personal";
  mode: "summary" | "content";
  owner: PersonalOwner;
  sourceCanvasId: string;
  home: string;
  itemId: string;
  pieces: PersonalPiece[];
  truncated: boolean;
  nextCursor?: string;
}

/** Classification deliberately sits outside snapshot-loading canvas hooks. */
export function sourceClassificationRoute(request: SourceClassificationRequest): string {
  return `/api/source-classification?${new URLSearchParams(request as unknown as Record<string, string>)}`;
}
/** Explicit source preflight, separate from automatic classification. */
export const SOURCE_ACCESS_ROUTE = "/api/source-access";
/** Home-scoped personal status and birth share one route family. */
export function personalRoute(actorId?: string, destinationCanvasId?: string): string {
  const params = new URLSearchParams({ ...(actorId === undefined ? {} : { actorId }), ...(destinationCanvasId === undefined ? {} : { destinationCanvasId }) });
  return `/api/personal${params.size ? `?${params}` : ""}`;
}
/** Destination-scoped acts are forwarded to that canvas's authority. */
export function personalCanvasRoute(canvasId: string, action?: "link" | "unlink" | "read", actorId?: string): string {
  return `/api/projects/${encodeURIComponent(canvasId)}/personal${action ? `/${action}` : ""}${actorId === undefined ? "" : `?actorId=${encodeURIComponent(actorId)}`}`;
}
/** Access controls are bound to the exact source, including preserved joined datasets. */
export function personalDelegatesRoute(sourceCanvasId: string, agentId?: string, actorId?: string): string {
  return `/api/personal/sources/${encodeURIComponent(sourceCanvasId)}/delegates${agentId === undefined ? "" : `/${encodeURIComponent(agentId)}`}${actorId === undefined ? "" : `?actorId=${encodeURIComponent(actorId)}`}`;
}
