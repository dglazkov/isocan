import type {
  Actor,
  ActorClaimOp,
  ActorColors,
  BlobUploadResponse,
  CanvasSnapshotResponse,
  GcReport,
  GcRequest,
  GrantResponse,
  GrantsResponse,
  GrantSubject,
  LogEntry,
  Operation,
  PostOpResponse,
  Project,
  ActorNames,
  SlashCommand,
} from "@isocan/core";
import {
  DOOR_ROUTE,
  encodeFilename,
  FILENAME_HEADER,
  grantRoute,
  grantsRoute,
  newClientId,
} from "@isocan/core";

/** Stable per-tab id so a client can recognize its own ops in broadcasts. */
export const CLIENT_ID = newClientId();

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * What to do the moment the door hands this browser a NEW badge: re-claim the
 * persona it is wearing, before the refused request is replayed.
 *
 * Registered from `main.tsx` rather than imported here, because the persona
 * roster lives in `lib/identity.ts` and that module already imports this one
 * — a hook keeps the dependency pointing one way.
 */
let reclaim: (() => Promise<unknown>) | null = null;
let reclaiming = false;

export function onReBadge(fn: () => Promise<unknown>): void {
  reclaim = fn;
}

/**
 * Go to the door and be handed a cookie. The page load already badges this
 * browser — the daemon sets the cookie on the HTML document — so this is
 * belt-and-braces: it heals a cookie that was cleared mid-session, and the
 * visible property is that NOTHING is visible. One 401 in the network log,
 * one door call, the retried request at 200, and the canvas does not flinch.
 *
 * The re-claim is what keeps that true now that the home checks who is
 * speaking: a fresh badge holds no claims, and the request about to be
 * replayed asserts the actor this tab has held all along. Without it, badge
 * recovery is a 401 followed by a `not-your-actor` on the first action after
 * it — the canvas would flinch, once, for good.
 */
export async function knockOnDoor(): Promise<boolean> {
  try {
    const res = await fetch(DOOR_ROUTE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ carrier: "cookie" }),
    });
    if (!res.ok) return false;
    await reclaimNow();
    return true;
  } catch {
    return false;
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const send = () =>
    fetch(url, {
      method,
      ...(body !== undefined
        ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
        : {}),
    });
  let res = await send();
  let json = (await res.json().catch(() => null)) as any;
  // Exactly one recovery per request, and never a loop. A 401 goes to the
  // door (which re-claims on the way back); a `not-your-actor` means the
  // badge is fine and the CLAIM is gone — a tab whose persona the desk no
  // longer remembers — so it claims and comes straight back.
  const recovered =
    res.status === 401
      ? await knockOnDoor()
      : json?.code === "not-your-actor" && (await reclaimNow());
  if (recovered) {
    res = await send();
    json = (await res.json().catch(() => null)) as any;
  }
  if (!res.ok) throw new ApiError(res.status, json?.error ?? `HTTP ${res.status}`, json?.code);
  return json as T;
}

async function reclaimNow(): Promise<boolean> {
  if (!reclaim || reclaiming) return false;
  reclaiming = true;
  try {
    await reclaim();
    return true;
  } catch {
    return false; // somebody else is that persona now; the replay says so
  } finally {
    reclaiming = false;
  }
}

/** Name (or resume) this browser's actor — the one op sent without an
 * actor: the claim resolves who is speaking, and the response envelope
 * carries the answer. */
export function claimActor(op: ActorClaimOp): Promise<PostOpResponse> {
  return request("POST", "/api/ops", { projectId: null, clientId: CLIENT_ID, op });
}

export function sendOp(
  projectId: string | null,
  actor: Actor,
  op: Operation,
): Promise<PostOpResponse> {
  return request("POST", "/api/ops", { projectId, actor, clientId: CLIENT_ID, op });
}

/** Chosen identity colors, actor id → hex. */
export function fetchActorColors(): Promise<ActorColors> {
  return request("GET", "/api/colors");
}

/** The name each actor goes by now, actor id → name. */
export function fetchActorNames(): Promise<ActorNames> {
  return request("GET", "/api/names");
}

/** Every slash command available here — built-ins under this home's own. */
export function fetchCommands(): Promise<SlashCommand[]> {
  return request("GET", "/api/commands");
}

export function listProjects(): Promise<Project[]> {
  return request("GET", "/api/projects");
}

export function getSnapshot(projectId: string): Promise<CanvasSnapshotResponse> {
  return request("GET", `/api/projects/${projectId}/canvas`);
}

export function undo(projectId: string, actor: Actor): Promise<LogEntry> {
  return request("POST", `/api/projects/${projectId}/undo`, { actor, clientId: CLIENT_ID });
}

export function redo(projectId: string, actor: Actor): Promise<LogEntry> {
  return request("POST", `/api/projects/${projectId}/redo`, { actor, clientId: CLIENT_ID });
}

export async function uploadBlob(
  projectId: string,
  file: File | Blob,
  filename: string,
): Promise<BlobUploadResponse> {
  // Bypasses `request` (raw bytes), so the recovery retry is spelled out —
  // a 401 here would read as a drop that silently failed.
  const send = () =>
    fetch(`/api/projects/${projectId}/blobs`, {
      method: "POST",
      headers: {
        "Content-Type": file.type || "application/octet-stream",
        [FILENAME_HEADER]: encodeFilename(filename),
      },
      body: file,
    });
  let res = await send();
  if (res.status === 401 && (await knockOnDoor())) res = await send();
  const json = (await res.json().catch(() => null)) as any;
  if (!res.ok) throw new ApiError(res.status, json?.error ?? `HTTP ${res.status}`, json?.code);
  return json as BlobUploadResponse;
}

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
export function listGrants(projectId: string): Promise<GrantsResponse> {
  return request("GET", grantsRoute(projectId));
}

/** Share it. Today `link` is the only subject a home can check, and the API
 * refuses the others by naming phase 9 — the dialog shows that refusal rather
 * than hiding it behind a disabled control. */
export function createGrant(projectId: string, subject: GrantSubject): Promise<GrantResponse> {
  return request("POST", grantsRoute(projectId), { subject });
}

/**
 * Un-share it. Deliberately sends NO body and no content-type: a `DELETE`
 * declaring `application/json` with nothing in it is a Fastify parse error,
 * and while `http.ts` now answers that with the 400 it always was, the
 * request that never needed a body should not send headers about one.
 */
export function revokeGrant(projectId: string, grantId: string): Promise<GrantResponse> {
  return request("DELETE", grantRoute(projectId, grantId));
}

export function runGc(projectId: string, options: GcRequest = {}): Promise<GcReport> {
  return request("POST", `/api/projects/${projectId}/gc`, options);
}

export function blobUrl(projectId: string, blobHash: string): string {
  return `/api/projects/${projectId}/blobs/${blobHash}`;
}
