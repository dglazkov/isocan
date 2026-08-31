import type {
  Actor,
  ActorClaimOp,
  AttestOffer,
  AttestRequest,
  AttestResponse,
  ActorColors,
  BadgesResponse,
  BlobUploadResponse,
  CanvasSnapshotResponse,
  GcReport,
  GcRequest,
  GrantResponse,
  GrantsResponse,
  GrantSubject,
  HomesResponse,
  PresenceWhereResponse,
  KillBadgeResponse,
  LogEntry,
  MintPassResponse,
  Operation,
  PostOpResponse,
  Canvas,
  ActorNames,
  RedeemPassResponse,
  ServingResponse,
  SlashCommand,
} from "@isocan/core";
import {
  ATTEST_ROUTE,
  badgeRoute,
  BADGES_ROUTE,
  DOOR_ROUTE,
  encodeFilename,
  FILENAME_HEADER,
  grantRoute,
  grantsRoute,
  HOMES_ROUTE,
  PRESENCE_WHERE_ROUTE,
  newClientId,
  newOpId,
  PASS_REDEEM_ROUTE,
  passesRoute,
  canvasesRoute,
  SERVING_ROUTE,
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
 * **The home never answered, and this act could not wait for it** (phase 10).
 *
 * Deliberately NOT an `ApiError`: the difference between "the home said no"
 * and "the home did not say anything" is the difference between a decision and
 * an absence, and everything downstream branches on it. A queue retries an
 * absence and must never retry a decision; a person is told different
 * sentences about each.
 *
 * Thrown only for the acts that CANNOT be queued, each of which owns its own
 * sentence rather than getting a generic one — see `offlineNote`.
 */
export class OfflineError extends Error {
  readonly offline = true;
  constructor(message: string) {
    super(message);
    this.name = "OfflineError";
  }
}

/**
 * Did the home answer at all?
 *
 * An `ApiError` means it did — with a refusal, but an answer. Anything else
 * out of `fetch` (a `TypeError`, an aborted request, DNS) means the request
 * never got a verdict, and the honest thing to say about the op is "unknown",
 * not "failed". That distinction is why the idempotency key exists: an op
 * whose answer was lost may well have LANDED, and asking again with the same
 * key is the only way to find out without risking a second one.
 */
export function homeAnswered(err: unknown): err is ApiError {
  return err instanceof ApiError;
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
  return request("POST", "/api/ops", { canvasId: null, clientId: CLIENT_ID, op });
}

/**
 * One op, straight up, under a name the caller chose.
 *
 * The unqueued core of `sendOp`, and the call the offline queue makes when it
 * flushes: the key is supplied rather than minted here precisely because a
 * flush is a RE-send and has to say the same thing twice.
 */
export function postOp(
  canvasId: string | null,
  actor: Actor,
  op: Operation,
  opId: string,
  group?: string,
): Promise<PostOpResponse> {
  return request("POST", "/api/ops", {
    canvasId,
    actor,
    clientId: CLIENT_ID,
    opId,
    op,
    ...(group !== undefined ? { group } : {}),
  });
}

/**
 * Where a write goes when the home cannot be reached (phase 10).
 *
 * A hook rather than an import, for the reason `onReBadge` above is a hook:
 * the queue lives in `stores/canvasStore.ts`, which already imports this
 * module, and a hook keeps the dependency pointing one way. Registered from
 * `main.tsx`, at the entry point, before the first gesture can happen.
 *
 * Returns true when the op was kept. False means it could not be — a canvas
 * born with no network (phase 13's offline birth), naming yourself against a
 * namespace this tab cannot see, or an op about a canvas this tab does not
 * have open — and then `sendOp` throws, because a gesture that quietly
 * evaporates is the failure this phase exists to remove.
 */
let queueWrite: ((canvasId: string | null, actor: Actor, op: Operation, opId: string) => boolean) | null =
  null;

export function onOfflineWrite(fn: typeof queueWrite): void {
  queueWrite = fn;
}

/** What to tell somebody whose act cannot wait in a queue. Each sentence
 * names the act, says what happened, and — where there is one — the remedy;
 * "something went wrong" is not any of those things. */
function offlineNote(op: Operation): string {
  switch (op.type) {
    case "project.create":
      return "A new canvas has to be made at its home, and this browser cannot reach it. Try again when you are back online.";
    case "project.delete":
      return "Deleting a canvas has to be done at its home, and this browser cannot reach it.";
    case "actor.claim":
    case "actor.setColor":
      return "Changing who you are needs the home — it is the only place that knows what names are taken. You can keep working as you are.";
    default:
      return "This change is about a canvas this tab does not have open, and the home cannot be reached to make it.";
  }
}

/**
 * Write an op — and, if the home cannot be reached, keep it (phase 10).
 *
 * Every op the app sends is minted with an id HERE rather than at the daemon,
 * because that id is the idempotency key and the key has to survive the thing
 * it protects against: a POST whose answer never came. When the network is
 * gone the op goes into the queue carrying the same key it was posted under,
 * so the flush after reconnect asks the home the same question a second time
 * and gets the same answer rather than a `duplicate-id` refusal.
 *
 * Resolves to `null` when the op was queued instead of sent — no caller in the
 * app reads the response, and inventing a seq for an op the home has not seen
 * would be exactly the sort of comfortable lie phase 7 spent a finding on.
 */
export async function sendOp(
  canvasId: string | null,
  actor: Actor,
  op: Operation,
  /** **One gesture, one undo.** Ops sent under the same id are undone
   *  together — see `LogEntry.group`. A gesture that writes one op needs
   *  nothing here; a paste, or an edit that changes words and title, passes
   *  the same id for every op it writes. */
  group?: string,
): Promise<PostOpResponse | null> {
  const opId = newOpId();
  try {
    return await postOp(canvasId, actor, op, opId, group);
  } catch (err) {
    if (homeAnswered(err)) throw err;
    if (queueWrite?.(canvasId, actor, op, opId)) return null;
    throw new OfflineError(offlineNote(op));
  }
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

/**
 * **The canvases this origin is the home of** — and deliberately not every
 * canvas this daemon holds (phase 10.3).
 *
 * A daemon is no longer one of two things. It is the home of some canvases and
 * a replica for others, and it serves pages only for the ones it is the home
 * of: `GET /p/<id>` for a canvas that lives at dev.isocan.io answers a
 * signpost, not the app shell. But the canvas list links to canvases with a
 * react-router `<Link>`, which is a client-side navigation that **never
 * touches the server** — so a wide list here would walk straight past that
 * guard and render a local replica of a dev canvas. Two doors onto one canvas,
 * two cookies, two service worker registrations, two browser replicas with the
 * local one stale by construction: `local-bridge.md`'s own worst case, *"two
 * surfaces agreeing with each other and both wrong."*
 *
 * So the caller states which reach it wants. That is the route's own standing
 * rule — **the caller states which, the route never sniffs who called** — and
 * the alternative (the daemon narrowing the list whenever a cookie carried it,
 * because a cookie means a browser) would have been that rule broken in the
 * one place it is load-bearing.
 *
 * `here` stacks ON the admissible answer rather than replacing it: being the
 * home of a canvas does not admit anybody to it. A tab still sees only what
 * its badge may see.
 */
export function listCanvases(): Promise<Canvas[]> {
  return request("GET", canvasesRoute("here"));
}

/**
 * **Which canvas lives where, and which homes are answering** (phase 10.3).
 *
 * One read, and the only route that can answer a per-canvas home question —
 * the health payload's `home` is the *birth default* now, which is a fact
 * about the daemon and says nothing about the canvas in front of you.
 *
 * The app asks for exactly one reason: `CanvasPage` must not render a canvas
 * this origin is not the home of. See `lib/homes.ts` for what it does with the
 * answer, and why an unreachable daemon is not an obstacle to opening a canvas
 * this tab already holds offline.
 */
export function fetchHomes(): Promise<HomesResponse> {
  return request("GET", HOMES_ROUTE);
}

/**
 * **Who is on which canvas right now** — one read for a question presence
 * files the other way round. See `PRESENCE_WHERE_ROUTE`.
 *
 * The lens shows one agent across a dozen canvases and holds a socket to none
 * of them; opening a dozen to keep a dozen dots exact is a cost nobody asked
 * for, and a dot a few seconds stale is still a dot.
 */
export function fetchPresenceWhere(): Promise<PresenceWhereResponse> {
  return request("GET", PRESENCE_WHERE_ROUTE);
}

/**
 * **Which enrolled agents a live rc is actually answering for.**
 *
 * Connection-bound, never a TTL: the daemon reports the holds it is holding
 * right now. `roster()` takes this as its fourth argument and downgrades every
 * standing row to `enrolled` without it — which is what the app did until it
 * started asking. See `useAnswerable`.
 */
export function fetchRcAnswering(canvasId: string): Promise<{ actorIds: string[] }> {
  return request("GET", `/api/projects/${encodeURIComponent(canvasId)}/rc`);
}

export function getSnapshot(canvasId: string): Promise<CanvasSnapshotResponse> {
  return request("GET", `/api/projects/${canvasId}/canvas`);
}

/**
 * **The log, read through the door like everything else.**
 *
 * Three surfaces wanted this and all three wrote the route by hand — the
 * scrubber, the card peek, the lens. A bare `fetch` skips `request`, and what
 * `request` does here is the whole point: a 401 knocks on the door and comes
 * back, instead of resolving to nothing.
 *
 * Resolving to nothing is the expensive half. A scrubber says so out loud. But
 * a peek with no majors looks like a canvas where nothing happened, and a lens
 * with no acts looks like an agent who did nothing — a wrong answer wearing
 * the same face as a true one. That is worth one function.
 *
 * `since=0` because every caller wants the whole log; a caller that wants a
 * tail can pass one.
 */
export function getOplog(canvasId: string, since = 0): Promise<LogEntry[]> {
  return request("GET", `/api/projects/${encodeURIComponent(canvasId)}/oplog?since=${since}`);
}

/**
 * What was rolled out of the live log. Only the scrubber asks: a history
 * folded from the live log alone would replay a story missing its beginning.
 * Absent (or unreadable) is normal — most canvases have never been rolled —
 * so this answers `[]` rather than throwing, and the caller can fold either
 * way without a branch.
 */
export function getArchivedOplog(canvasId: string): Promise<LogEntry[]> {
  return request<LogEntry[]>(
    "GET",
    `/api/projects/${encodeURIComponent(canvasId)}/oplog/archive`,
  ).catch(() => []);
}

/**
 * **Undo is the home's, and offline it says so** (phase 10's honesty problem,
 * second half).
 *
 * Undo here is not "reverse the last thing I did in this tab". It is an
 * actor-scoped walk of a stack the home rebuilds from the oplog, applying
 * stored INVERSES computed against the state each op was applied to, repairing
 * or skipping the ones another actor's work has invalidated (`server/undo.ts`).
 * A tab holds none of that. It holds a canvas.
 *
 * Three things were on the table and two were rejected out loud:
 *
 * - **Undo locally and queue the resulting op.** This is the tempting one and
 *   it is wrong for the reason the engine already gives about REPLICAS: *"a
 *   replica whose live log was re-snapshotted holds no entries to walk.
 *   Choosing what to undo here and forwarding the resulting op would be a
 *   second opinion about a stack that has one owner."* A tab is a thinner
 *   replica than that daemon, and the same sentence applies harder.
 * - **Queue the undo REQUEST and let the home decide on reconnect.** Worse,
 *   because it is invisible: the button does nothing now and something
 *   surprising in ten minutes, against a stack that has moved.
 * - **Refuse, and say why.** What this does. `⌘Z` on a plane is a reasonable
 *   thing to try and an unreasonable thing to be met with silence by.
 *
 * The refusal is an `OfflineError`, so it reaches a person as a sentence
 * rather than as a caught-and-dropped promise (see `ZoomControls`).
 */
export async function undo(canvasId: string, actor: Actor): Promise<LogEntry> {
  return history("undo", canvasId, actor);
}

export async function redo(canvasId: string, actor: Actor): Promise<LogEntry> {
  return history("redo", canvasId, actor);
}

const HISTORY_OFFLINE =
  "Undo lives at the canvas's home — it walks your own history over the whole canvas, which this browser cannot see from here. Your changes are being kept and will go up when you reconnect.";

async function history(kind: "undo" | "redo", canvasId: string, actor: Actor): Promise<LogEntry> {
  try {
    return await request<LogEntry>("POST", `/api/projects/${canvasId}/${kind}`, {
      actor,
      clientId: CLIENT_ID,
    });
  } catch (err) {
    if (homeAnswered(err)) throw err;
    throw new OfflineError(HISTORY_OFFLINE);
  }
}

/**
 * **Blobs are NOT queued offline, and the refusal is loud** (phase 10, the
 * scope that was cut, with its reason).
 *
 * Adding a file offline means queueing BYTES, not an op — a second durable
 * store with its own quota, its own eviction story, and its own answer to what
 * happens when the browser reclaims it before the network comes back. And the
 * op that would ride on top of it names a `blobHash` that does not exist
 * anywhere yet, so the queue would hold an `item.add` pointing at nothing: a
 * canvas that renders locally and cannot render for anybody else, until the
 * upload it depends on either succeeds or is quietly forgotten. That is a
 * design (content-addressed staging, upload-then-op ordering, a GC that knows
 * about un-landed bytes), not a phase-10 detail.
 *
 * So it is deferred — and the one thing that could not be deferred with it is
 * saying so. A drop that silently does nothing is exactly the failure mode
 * this phase is about, so the sentence is specific: the file is named, the
 * reason is given, and the remedy (try again when reconnected — the file is
 * still on your disk) is stated.
 */
export async function uploadBlob(
  canvasId: string,
  file: File | Blob,
  filename: string,
): Promise<BlobUploadResponse> {
  // Bypasses `request` (raw bytes), so the recovery retry is spelled out —
  // a 401 here would read as a drop that silently failed.
  const send = () =>
    fetch(`/api/projects/${canvasId}/blobs`, {
      method: "POST",
      headers: {
        "Content-Type": file.type || "application/octet-stream",
        [FILENAME_HEADER]: encodeFilename(filename),
      },
      body: file,
    });
  let res: Response;
  try {
    res = await send();
  } catch {
    throw new OfflineError(
      `“${filename}” was not added: files go to the canvas's home and this browser cannot reach it. ` +
        "Everything else you do here is being kept — try the file again when you reconnect.",
    );
  }
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
export function listGrants(canvasId: string): Promise<GrantsResponse> {
  return request("GET", grantsRoute(canvasId));
}

/** Share it. `link` needs no attester; `email:` and `repo:` need one this home
 * has borrowed, and a home that has borrowed none refuses with `no-attester`
 * — the dialog shows that refusal rather than hiding it behind a disabled
 * control. */
export function createGrant(canvasId: string, subject: GrantSubject): Promise<GrantResponse> {
  return request("POST", grantsRoute(canvasId), { subject });
}

/**
 * Un-share it. Deliberately sends NO body and no content-type: a `DELETE`
 * declaring `application/json` with nothing in it is a Fastify parse error,
 * and while `http.ts` now answers that with the 400 it always was, the
 * request that never needed a body should not send headers about one.
 */
export function revokeGrant(canvasId: string, grantId: string): Promise<GrantResponse> {
  return request("DELETE", grantRoute(canvasId, grantId));
}

// ---- what this holder has proved (phase 9 stage 2) ----
//
// One route, two verbs, and not canvas-scoped: an attestation is a fact about
// the HOLDER rather than about a room, and a badge that is not admitted
// anywhere must still be able to prove its address — because proving it is how
// it comes to be admitted.

/**
 * What this home can verify, what this badge has proved, and who that lets it
 * be.
 *
 * The `auth` half is why this is a fetch and not a build-time constant: the
 * key and project reach the page from the home at run time, so one image runs
 * at dev.isocan.io, at isocan.io, and on a laptop that has borrowed nothing.
 * A page that baked them in would be a per-home bundle.
 */
export function attestOffer(): Promise<AttestOffer> {
  return request("GET", ATTEST_ROUTE);
}

/**
 * Hand the home a token from the attester it named, and have it write the row.
 *
 * The address is read out of the verified token at the daemon, never sent
 * beside it: a body naming the mailbox to attest would be this page attesting
 * for itself with a signature stapled on.
 */
export function attest(idToken: string): Promise<AttestResponse> {
  return request("POST", ATTEST_ROUTE, { idToken } satisfies AttestRequest);
}

// ---- your own surfaces: kill-a-badge (phase 9) ----
//
// Not canvas-scoped, unlike the grant routes above: a badge is not about one
// canvas, and ending one ends that holder's recognition everywhere at once.
// The routes come from core for `grantsRoute`'s reason — this browser, the
// CLI and a replica's home connection speak to the same daemon, and a URL
// that drifts shows up at runtime as a refusal with nothing to read.

/** Every surface that shares an identity with this browser's badge, this one
 * marked `self`. A badge with no personas sees exactly itself. */
export function listBadges(): Promise<BadgesResponse> {
  return request("GET", BADGES_ROUTE);
}

/** End one. No body, for `revokeGrant`'s reason. */
export function killBadge(badgeId: string): Promise<KillBadgeResponse> {
  return request("DELETE", badgeRoute(badgeId));
}

// ---- the escalation pass (Scene 5) ----
//
// Two routes with deliberately different shapes, and neither is spelled here:
// `passesRoute` and `PASS_REDEEM_ROUTE` come from core, because this browser,
// the CLI and a replica's home connection all speak to the same daemon and a
// URL that drifts shows up at runtime as a refusal with nothing to read.
//
// Minting is canvas-scoped, so the door has already asked whether this badge
// may be in this room before the handler runs. Redeeming is NOT, and cannot
// be: the redeemer is by definition not admitted yet, and a canvas-scoped
// path would have the door refuse the one request whose purpose is to become
// admitted. `passes.ts` in core argues both at length.

/**
 * Mint one for this canvas, endowing an actor this badge already holds.
 *
 * The "Bring your own agent…" dialog's only call. The endowment is the
 * point rather than an option — Scene 5's pass is *minted by her admitted tab,
 * for her actor* — and the home refuses a claim this badge does not hold
 * (`not-your-actor`), so endowing somebody else is not reachable from here.
 * The `--admit-only` shape the CLI offers has no button, because the gesture
 * that needs it (an agent that will name itself) is not one a person makes in
 * a browser.
 */
export function mintPass(canvasId: string, actorId?: string): Promise<MintPassResponse> {
  // **Omitting the actor is the admission-only shape**, and it is a real
  // gesture rather than a degenerate one: Scene 5 hands your identity to your
  // own second machine, and Scene 6 admits an AGENT that will name itself.
  // Sending `actorId: undefined` would serialize the key away anyway; saying
  // so here is what stops the next reader from "fixing" it into a required
  // argument.
  return request("POST", passesRoute(canvasId), actorId ? { actorId } : {});
}

/**
 * Redeem the pass a tab arrived carrying — see `lib/arrival.ts`, the only
 * caller, for why it rides in a `#fragment`.
 *
 * The refusals are three different sentences (`unknown-pass`, `pass-spent`,
 * `pass-expired`) and reach the caller as an `ApiError` with its `code`
 * intact, which is the whole reason they are separate codes at the daemon: a
 * person who just clicked a link needs to be told which of the three happened,
 * because the remedies differ.
 */
export function redeemPass(token: string): Promise<RedeemPassResponse> {
  return request("POST", PASS_REDEEM_ROUTE, { token });
}

export function runGc(canvasId: string, options: GcRequest = {}): Promise<GcReport> {
  return request("POST", `/api/projects/${canvasId}/gc`, options);
}

export function blobUrl(canvasId: string, blobHash: string): string {
  return `/api/projects/${canvasId}/blobs/${blobHash}`;
}

/** How this home serves — today, only whether a content origin exists. */
export function getServing(): Promise<ServingResponse> {
  return request("GET", SERVING_ROUTE);
}


/**
 * Whether a site will let itself be shown in a frame — asked of the daemon,
 * because only something making the request server-side can read the headers
 * that decide it. See `/api/frameable` and `core/frameable.ts`.
 *
 * Never throws: a check that cannot be made answers `ok`, so the person is
 * free to try. Refusing a site on a failed probe would be worse than the
 * blank frame this exists to prevent.
 */
export async function checkFrameable(
  url: string,
): Promise<{ ok: boolean; why?: string; url?: string }> {
  try {
    const res = await fetch(`/api/frameable?url=${encodeURIComponent(url)}`);
    if (!res.ok) return { ok: true };
    return (await res.json()) as { ok: boolean; why?: string; url?: string };
  } catch {
    return { ok: true };
  }
}
