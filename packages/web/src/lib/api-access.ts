import type {
  Capability,
  GrantResponse,
  GrantSubject,
  GrantsResponse,
  GroupResponse,
  GroupsResponse,
  SpaceCanvasResponse,
  SpaceLinkRequest,
  SpaceLinkResponse,
  SpaceResponse,
  SpacesResponse,
} from "@isocan/core";
import {
  GROUPS_ROUTE,
  PUBLIC_CANVASES_ROUTE,
  SPACES_ROUTE,
  grantRevokeRoute,
  grantsRoute,
  groupActingRoute,
  groupMemberRoute,
  groupRoute,
  narrowed,
  publicListingRoute,
  spaceActingRoute,
  spaceCanvasRoute,
  spaceGrantRevokeRoute,
  spaceGrantsRoute,
  spaceLinkRoute,
  spaceRoute,
} from "@isocan/core";
import { request } from "./api.ts";

/*
 * **Who may enter: grants, the public listing, spaces and groups** (moved out
 * of `api.ts` on 14 Oct 2026, unchanged).
 *
 * Every caller is a surface that loads when it is opened — the Share dialog,
 * the canvas list's spaces, the Groups panel, the public catalogue, ⌘K — so
 * none of this is needed to draw a canvas. In `api.ts`, which the first paint
 * needs for `sendOp` and the door, it was in every first visit anyway, and it
 * brought the whole of core's `grants.ts` and `public.ts` with it: a module
 * in the entry chunk carries every export any chunk uses, and everything those
 * exports import. Transport stays in `api.ts` (`request`, which exists for
 * adapters like this one).
 */

// ---- who may enter this canvas (the Share dialog's three calls) ----
//
// The routes are built by `@isocan/core`'s `grantsRoute`/`grantRoute` rather
// than spelled here, and the subject is core's `GrantSubject` rather than the
// string `"link"`: the dialog, the CLI verb and the daemon all have to agree
// about the shape of a URL and the spelling of a subject, and a disagreement
// shows up at runtime as a refusal with nothing to read.

/** The rows still admitting, oldest first. Tombstones stay on the desk; the
 * route does not hand them over, because "who can get in" is a question about
 * the present. */
export function listGrants(canvasId: string): Promise<GrantsResponse> {
  return request("GET", grantsRoute(canvasId));
}

/** Catalogue browsing needs a badge at most, never an actor or canvas admission. */
export function publicCanvases(signal?: AbortSignal): Promise<import("@isocan/core").PublicCanvasesResponse> {
  return request("GET", PUBLIC_CANVASES_ROUTE, undefined, signal, "badge");
}

/** Capture the reviewed link's id so a stale Share toggle cannot publish its
 * replacement; the home checks ownership and eligibility before accepting. */
export function setPublicListing(canvasId: string, grantId: string, listed: boolean, actorId: string): Promise<GrantResponse> {
  return request("PUT", publicListingRoute(canvasId, grantId), { listed, actorId });
}

/** Share it. `link` needs no attester; `email:` and `repo:` need one this home
 * has borrowed, and a home that has borrowed none refuses with `no-attester`
 * — the dialog shows that refusal rather than hiding it behind a disabled
 * control. */
export function createGrant(
  canvasId: string,
  subject: GrantSubject,
  capability?: Capability,
  /** Who is acting — the persona this tab wears. A write to grants asks
   * `own`, which a person holds, and a browser's badge may hold several. */
  actorId?: string,
): Promise<GrantResponse> {
  return request("POST", grantsRoute(canvasId), {
    subject,
    // Sent whenever it is not edit (#88, `narrowed`), so an older home never
    // meets the field for the one value it has always meant by omission.
    ...(narrowed(capability) ? { capability } : {}),
    ...(actorId ? { actorId } : {}),
  });
}

/**
 * Un-share it. Deliberately sends NO body and no content-type: a `DELETE`
 * declaring `application/json` with nothing in it is a Fastify parse error,
 * and while `http.ts` now answers that with the 400 it always was, the
 * request that never needed a body should not send headers about one.
 */
export function revokeGrant(
  canvasId: string,
  grantId: string,
  actorId?: string,
  /** `?bar=1`: revoke and keep them out in one request (roles phase 3). The
   * parameter's spelling is core's, like the route. */
  bar?: boolean,
): Promise<GrantResponse> {
  return request(
    "DELETE",
    grantRevokeRoute(canvasId, grantId, { ...(actorId ? { actorId } : {}), ...(bar ? { bar } : {}) }),
  );
}

/**
 * Keep somebody out (roles phase 3): a bar, written directly — the dialog's
 * **and keep them out** after a Remove whose answer said the link would still
 * admit them. The same POST as an invitation, with `bars: true` and no rung;
 * the home replaces any live row naming them and sweeps.
 */
export function createBar(
  canvasId: string,
  subject: GrantSubject,
  actorId?: string,
): Promise<GrantResponse> {
  return request("POST", grantsRoute(canvasId), {
    subject,
    bars: true,
    ...(actorId ? { actorId } : {}),
  });
}

// ---- the space: a named set of canvases access is set on once (roles phase 4) ----
//
// The canvas list's headings, **Move to space…**, and the space's Share
// dialog drive these; `isocan space` and `isocan share --space` drive the
// same routes, spelled once in core. A space is at the home, like a grant.

/** The spaces this badge may see — made by an actor it claims, or named by
 * a live row it satisfies — each with its `canvasIds`, which the canvas list
 * joins to `GET /api/projects`. A badge admitted to one canvas sees none. */
export function listSpaces(signal?: AbortSignal): Promise<SpacesResponse> {
  return request("GET", SPACES_ROUTE, undefined, signal);
}

export function createSpace(name: string, actorId?: string): Promise<SpaceResponse> {
  return request("POST", SPACES_ROUTE, { name, ...(actorId ? { actorId } : {}) });
}

/** No body, for `revokeGrant`'s reason; the actor rides the query. */
export function deleteSpace(spaceId: string, actorId?: string): Promise<SpaceCanvasResponse> {
  return request("DELETE", spaceActingRoute(spaceRoute(spaceId), actorId));
}

/** **Move to space…** — refused with `canvas-in-space` when the canvas is
 * in another; move it out first. */
export function addToSpace(spaceId: string, canvasId: string, actorId?: string): Promise<SpaceCanvasResponse> {
  return request("PUT", spaceCanvasRoute(spaceId, canvasId), actorId ? { actorId } : {});
}

/** **No space** — the canvas keeps its own rows and the space's stop
 * reaching it; the home sweeps it. */
export function removeFromSpace(spaceId: string, canvasId: string, actorId?: string): Promise<SpaceCanvasResponse> {
  return request("DELETE", spaceActingRoute(spaceCanvasRoute(spaceId, canvasId), actorId));
}

export function listSpaceGrants(spaceId: string): Promise<GrantsResponse> {
  return request("GET", spaceGrantsRoute(spaceId));
}

export function createSpaceGrant(
  spaceId: string,
  subject: GrantSubject,
  capability?: Capability,
  actorId?: string,
): Promise<GrantResponse> {
  return request("POST", spaceGrantsRoute(spaceId), {
    subject,
    ...(narrowed(capability) ? { capability } : {}),
    ...(actorId ? { actorId } : {}),
  });
}

export function revokeSpaceGrant(
  spaceId: string,
  grantId: string,
  actorId?: string,
  bar?: boolean,
): Promise<GrantResponse> {
  return request(
    "DELETE",
    spaceGrantRevokeRoute(spaceId, grantId, { ...(actorId ? { actorId } : {}), ...(bar ? { bar } : {}) }),
  );
}

/** **Every canvas in this space** (roles journey 4, step 4): the link on
 * each canvas set to a rung or turned off, in one request, and the answer
 * says how many canvases it reached. */
export function setSpaceLink(
  spaceId: string,
  capability: SpaceLinkRequest["capability"],
  actorId?: string,
): Promise<SpaceLinkResponse> {
  return request("POST", spaceLinkRoute(spaceId), {
    capability,
    ...(actorId ? { actorId } : {}),
  } satisfies SpaceLinkRequest);
}

// ---- the group: a named set of people access is given to once (roles phase 5) ----
//
// The Groups panel on the canvas list and the Share dialog's group picker
// drive these; `isocan group` and `isocan share group:<name>` drive the same
// routes, spelled once in core. A group is at the home, like a grant.

/** The groups this badge's actors made, members and all — the owner's list. */
export function listGroups(): Promise<GroupsResponse> {
  return request("GET", GROUPS_ROUTE);
}

export function createGroup(name: string, actorId?: string): Promise<GroupResponse> {
  return request("POST", GROUPS_ROUTE, { name, ...(actorId ? { actorId } : {}) });
}

/** One group: members for its maker; name and size for anybody a live row
 * naming it lets see it — what a group row in the Share dialog shows. */
export function readGroup(groupId: string): Promise<GroupResponse> {
  return request("GET", groupRoute(groupId));
}

export function addGroupMember(groupId: string, attribute: string, actorId?: string): Promise<GroupResponse> {
  return request("PUT", groupMemberRoute(groupId, attribute), actorId ? { actorId } : {});
}

/** No body, for `revokeGrant`'s reason; the actor rides the query. */
export function removeGroupMember(groupId: string, attribute: string, actorId?: string): Promise<GroupResponse> {
  return request("DELETE", groupActingRoute(groupMemberRoute(groupId, attribute), actorId));
}

export function deleteGroup(groupId: string, actorId?: string): Promise<GroupResponse> {
  return request("DELETE", groupActingRoute(groupRoute(groupId), actorId));
}
