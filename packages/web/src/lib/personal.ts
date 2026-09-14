import { classifyAutomaticSource } from "@isocan/api/context";
import {
  personalRoute, personalCanvasRoute, personalDelegatesRoute, sourceClassificationRoute,
  SOURCE_POLICY_HEADER, sourcePolicyHeader, HOMES_ROUTE, PRESENCE_WHERE_ROUTE,
  type HomesResponse, type CanvasSnapshotResponse, type PresenceWhereResponse,
  type PersonalStatusResponse, type PersonalEnsureResponse, type PersonalLinksResponse,
  type PersonalLinkResponse, type PersonalUnlinkResponse, type PersonalDelegatesResponse,
  type PersonalDelegateResponse, type PersonalReadRequest, type PersonalReadResponse,
  type SourceClassificationRequest, type SourceClassificationResponse,
} from "@isocan/core";
import { request, getSnapshot, readBlob } from "./api.ts";

/** Lazy personal controls use the current explicit actor; badge recovery never picks a person. */
export const personalApi = {
  personalStatus: (actorId: string, signal?: AbortSignal, destinationCanvasId?: string) => request<PersonalStatusResponse>("GET", personalRoute(actorId, destinationCanvasId), undefined, signal, "badge"),
  ensurePersonal: (actorId: string, signal?: AbortSignal, destinationCanvasId?: string) => request<PersonalEnsureResponse>("POST", `${personalRoute()}/ensure`, { actorId, ...(destinationCanvasId ? { destinationCanvasId } : {}) }, signal, "badge"),
  personalLinks: (canvasId: string, actorId: string, signal?: AbortSignal) => request<PersonalLinksResponse>("GET", personalCanvasRoute(canvasId, undefined, actorId), undefined, signal, "badge"),
  linkPersonal: (canvasId: string, actorId: string, requestId: string, signal?: AbortSignal) => request<PersonalLinkResponse>("POST", personalCanvasRoute(canvasId, "link"), { actorId, requestId }, signal, "badge"),
  unlinkPersonal: (canvasId: string, actorId: string, requestId: string, itemId: string, signal?: AbortSignal) => request<PersonalUnlinkResponse>("POST", personalCanvasRoute(canvasId, "unlink"), { actorId, requestId, itemId }, signal, "badge"),
  personalDelegates: (source: string, actorId: string, signal?: AbortSignal) => request<PersonalDelegatesResponse>("GET", personalDelegatesRoute(source, undefined, actorId), undefined, signal, "badge"),
  setPersonalDelegate: (source: string, agent: string, actorId: string, allowed: boolean, signal?: AbortSignal) => request<PersonalDelegateResponse>("PUT", personalDelegatesRoute(source, agent), { actorId, allowed }, signal, "badge"),
  readPersonal: (canvasId: string, body: PersonalReadRequest, signal?: AbortSignal) => request<PersonalReadResponse>("POST", personalCanvasRoute(canvasId, "read"), body, signal, "badge"),
  classifySource: (body: SourceClassificationRequest, signal?: AbortSignal) => request<SourceClassificationResponse>("GET", sourceClassificationRoute(body), undefined, signal, "badge"),
};

/** Metadata chooses authority; an unreachable home never becomes a successful local fallback. */
export async function authoritativeHome(canvasId: string, signal?: AbortSignal): Promise<string> {
  const homes = await request<HomesResponse>("GET", HOMES_ROUTE, undefined, signal, "badge");
  if (!Object.prototype.hasOwnProperty.call(homes.canvases, canvasId)) throw new Error("The canvas's authoritative home is unknown.");
  return homes.canvases[canvasId] ?? window.location.origin;
}

/** Automatic reads carry the same restriction at the actual source request, beyond preflight. */
function sourceHeaders(expectedHome: string): Record<string, string> {
  return { [SOURCE_POLICY_HEADER]: sourcePolicyHeader({ policy: { mode: "exclude" }, expectedHome }) };
}

/** Source snapshots are read only with an immutable automatic exclusion policy. */
export function sourceSnapshot(source: SourceClassificationRequest, signal?: AbortSignal): Promise<CanvasSnapshotResponse> {
  return getSnapshot(source.canvasId, signal, sourceHeaders(source.expectedHome));
}

/** Presence is another source read, so it receives the same policy as the miniature. */
export function sourcePresence(expectedHome: string, signal?: AbortSignal): Promise<PresenceWhereResponse> {
  return request("GET", PRESENCE_WHERE_ROUTE, undefined, signal, "badge", sourceHeaders(expectedHome));
}

/** Native image URLs cannot attach the policy header; fetch first, then show an ephemeral object URL. */
export function sourcePicture(canvasId: string, hash: string, expectedHome: string, signal: AbortSignal): Promise<Blob> {
  return readBlob(canvasId, hash, signal, sourceHeaders(expectedHome));
}

/** Inherited design bytes retain the automatic exclusion policy at the actual blob request. */
export async function sourceText(canvasId: string, hash: string, expectedHome: string, signal?: AbortSignal): Promise<string> {
  return (await readBlob(canvasId, hash, signal, sourceHeaders(expectedHome))).text();
}

/** Placement and inheritance share the renderer's authoritative source classification. */
export async function automaticSource(canvasId: string, source: string | null, destinationCanvasId: string, signal?: AbortSignal) {
  return classifyAutomaticSource(personalApi, { canvasId, source, home: await authoritativeHome(destinationCanvasId, signal) }, signal);
}
