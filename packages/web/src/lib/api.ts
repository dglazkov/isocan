import type {
  Actor,
  ActorClaimOp,
  AttestOffer,
  AttestRequest,
  AttestResponse,
  ActorColors,
  BadgesResponse,
  BlobUploadResponse,
  Capability,
  CanvasSnapshotResponse,
  DirClaim,
  GcReport,
  GcRequest,
  GrantResponse,
  GrantsResponse,
  GrantSubject,
  HomesResponse,
  NewsResponse,
  PresenceWhereResponse,
  KillBadgeResponse,
  LogEntry,
  MintPassResponse,
  Operation,
  Persona,
  PostOpResponse,
  Canvas,
  ActorMarks,
  ActorNames,
  RcAnsweringResponse,
  RcAskRequest,
  RcAskResponse,
  RedeemPassResponse,
  ServingResponse,
  SlashCommand,
  SpaceCanvasResponse,
  SpaceLinkRequest,
  SpaceLinkResponse,
  SpaceResponse,
  SpacesResponse,
  GroupResponse,
  GroupsResponse,
} from "@isocan/core";
import {
  ATTEST_ROUTE,
  groupActingRoute,
  groupMemberRoute,
  groupRoute,
  GROUPS_ROUTE,
  spaceActingRoute,
  spaceCanvasRoute,
  spaceGrantRevokeRoute,
  spaceGrantsRoute,
  spaceLinkRoute,
  spaceRoute,
  SPACES_ROUTE,
  badgeRoute,
  BADGES_ROUTE,
  DOOR_ROUTE,
  encodeFilename,
  FILENAME_HEADER,
  grantRevokeRoute,
  grantsRoute,
  HOMES_ROUTE,
  narrowed,
  NEWS_ROUTE,
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
    /** Why, when the code alone does not say — `withdrawn` on a
     * `not-admitted` from a badge that had been inside. */
    readonly reason?: string,
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
  if (!res.ok) throw new ApiError(res.status, json?.error ?? `HTTP ${res.status}`, json?.code, json?.reason);
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
/** The mark each actor wears instead of an initial — see `useActorMarks`. */
export function fetchActorMarks(): Promise<ActorMarks> {
  return request("GET", "/api/marks");
}

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

/** What changed, for the person using this — see `NEWS_ROUTE`. Open, because
 *  it is release notes. */
export function fetchNews(): Promise<NewsResponse> {
  return request("GET", NEWS_ROUTE);
}

/**
 * **Which enrolled agents a live rc is actually answering for — and whether
 * one is parked at all.**
 *
 * Connection-bound, never a TTL: the daemon reports the holds it is holding
 * right now, unioned with what member machines' daemons relay up their
 * home-link sockets (agent-custody mechanism 1). `roster()` takes the ids as
 * its fourth argument and downgrades every standing row to `enrolled`
 * without them; `parked` is the add-agent gate. See `useAnswerable`.
 */
export function fetchRcAnswering(canvasId: string): Promise<RcAnsweringResponse> {
  return request("GET", `/api/projects/${encodeURIComponent(canvasId)}/rc`);
}

/**
 * **Ask the parked rc to add an agent** (agent-custody mechanism 2). Carries
 * a name and the asker; the rc mints the actor on the machine that answers
 * for it, and the outcome arrives the way everything does — the
 * `agent.enroll` op lands, or the dialog's countdown says nothing answered.
 */
export function askEnrolAgent(canvasId: string, body: RcAskRequest): Promise<RcAskResponse> {
  return request("POST", `/api/projects/${encodeURIComponent(canvasId)}/agents/ask`, body);
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
  if (!res.ok) throw new ApiError(res.status, json?.error ?? `HTTP ${res.status}`, json?.code, json?.reason);
  return json as BlobUploadResponse;
}

// ---- the owner's own machine, and its disk (the workbench's routes) ----
//
// Six routes that answer on exactly ONE daemon: the canvas's home, on its
// owner's machine, over loopback, with a directory bound. Everywhere else
// each of them 404s with a sentence saying so — and that sentence is not an
// error. It is the answer, and every caller below renders it as one.
//
// Which is why these were the last routes still written by hand, and why
// writing them by hand was expensive here in particular. A pane that already
// knows how to say "no directory is bound to this canvas on this machine"
// says a LOST BADGE the same way: same grey text, same shape, in a panel that
// looks like it worked. A bare `fetch` cannot tell those apart, because it
// never asks — it reads a 401's body and shows whatever is in it, or shows
// nothing at all.
//
// `request` asks. A 401 knocks on the door, re-claims this tab's persona and
// comes back with the real answer, so the sentence a person reads is about
// their disk rather than about their cookie. What reaches a caller is then
// one of two things, and `homeAnswered` tells them apart: an `ApiError`
// carrying the daemon's own refusal (show it — it names the rule, which is
// what lets somebody fix the path they typed), or anything else, which means
// the daemon never answered at all.

/** One row of a bound directory's listing. */
export interface TreeEntry {
  path: string;
  kind: "file" | "dir";
  size: number;
}

interface TreeResponse {
  roots: Array<{ root: string; entries: TreeEntry[]; truncated: boolean }>;
}

/**
 * The bound directory's listing. `isocan tree` prints this same answer from
 * this same route — one derivation, two surfaces.
 *
 * `roots` is plural because a canvas can be bound in more than one place on
 * one machine (a clone, a worktree). The pane shows the first, as the write
 * does; which one a listing means when there are two is a question nobody has
 * asked yet.
 */
export function getTree(canvasId: string): Promise<TreeResponse> {
  return request("GET", `/api/projects/${encodeURIComponent(canvasId)}/tree`);
}

/**
 * One file's BYTES, on their way to becoming an item — the ＋'s first half.
 *
 * Bypasses `request` for `uploadBlob`'s reason: the route answers
 * octet-stream and `request` reads json. So the recovery is spelled out here
 * instead, because skipping it made the same silence in the same place — the
 * ＋ on a tab whose cookie had been cleared did nothing at all, and did
 * nothing again on the second press.
 */
export async function readBoundFile(canvasId: string, path: string): Promise<ArrayBuffer> {
  const url = `/api/projects/${encodeURIComponent(canvasId)}/tree/file?path=${encodeURIComponent(path)}`;
  let res = await fetch(url);
  if (res.status === 401 && (await knockOnDoor())) res = await fetch(url);
  if (!res.ok) {
    const json = (await res.json().catch(() => null)) as any;
    throw new ApiError(res.status, json?.error ?? `HTTP ${res.status}`, json?.code, json?.reason);
  }
  return res.arrayBuffer();
}

export interface PickListing {
  dir: string;
  up: string | null;
  entries: Array<{ name: string; path: string; bound: boolean; claim?: DirClaim }>;
}

/**
 * Directories to pick from — one level, names only, jailed to `$HOME`.
 *
 * `at` is where to look; null asks for the starting place. Every refusal here
 * is deliberately ONE sentence at the daemon — absent, outside the jail, a
 * symlink, a file are all "there is nothing to list here" — because a picker
 * that enumerated its refusals would be describing a disk the caller cannot
 * see.
 */
export function pickDirectories(canvasId: string, at: string | null): Promise<PickListing> {
  const where = at ? `?at=${encodeURIComponent(at)}` : "";
  return request("GET", `/api/projects/${encodeURIComponent(canvasId)}/pick${where}`);
}

interface BindResponse {
  root: string;
  marker: string;
  /** The directory already carried this canvas's marker — a cloned repo whose
   *  binding this machine was simply missing. */
  adopted: boolean;
}

/**
 * Bind a directory to this canvas — what `isocan use` does, without a
 * terminal.
 *
 * The browser cannot do this itself and not for want of an API: a
 * `FileSystemHandle` exposes `kind` and `name` and never a path, by design,
 * so a directory picked in a page can never become a binding the CLI or an
 * agent can see. The daemon is the only party that can name a directory.
 *
 * Unlike the picker above, every refusal here is its OWN sentence (nothing at
 * that path, a file rather than a directory, a home directory that would
 * claim every canvas beneath it, already bound elsewhere) — the caller is the
 * person who typed the path, and which rule refused them is exactly what they
 * need in order to type a better one.
 */
export function bindDirectory(canvasId: string, path: string): Promise<BindResponse> {
  return request("POST", `/api/projects/${encodeURIComponent(canvasId)}/bind`, { path });
}

export interface PersonaFile {
  file: string;
  persona: Persona;
  /** The file verbatim. An editor showing a re-rendering of what we
   *  understood is an editor that silently drops what we did not. */
  text: string;
}

interface PersonasResponse {
  root: string;
  personas: PersonaFile[];
}

/**
 * The personas in this canvas's directory, parsed by core — so this panel and
 * `isocan persona ls` cannot disagree about what a persona says.
 */
export function getPersonas(canvasId: string): Promise<PersonasResponse> {
  return request("GET", `/api/projects/${encodeURIComponent(canvasId)}/personas`);
}

/**
 * Save one, whole. The name is a stem the daemon jails; the text is the file,
 * front matter and all. There is no merge and there should not be — the file
 * is small, one person is editing it, and a clever merge is a way to lose a
 * line nobody noticed.
 */
export function savePersona(
  canvasId: string,
  name: string,
  text: string,
): Promise<{ ok: true; file: string }> {
  return request(
    "PUT",
    `/api/projects/${encodeURIComponent(canvasId)}/personas/${encodeURIComponent(name)}`,
    { text },
  );
}

interface BackingResponse {
  bound: boolean;
  /** Path relative to the root → the content hash found there. */
  onDisk: Record<string, string>;
}

/**
 * What this machine's disk says about the canvas's tracked items — the
 * derived half of `backingOf`, which this app and `isocan ls` both render.
 *
 * Asked when a canvas opens and after a save, because those are the two
 * moments the answer can change. Nothing polls and nothing watches the
 * filesystem: every crossing is a gesture.
 */
export function getBacking(canvasId: string): Promise<BackingResponse> {
  return request("GET", `/api/projects/${encodeURIComponent(canvasId)}/backing`);
}

/**
 * Write an item out to the directory bound here — the other direction from
 * `＋`, and the same call `isocan save` makes.
 *
 * `force` is a person deciding to overwrite work the canvas did not do: a
 * file matching none of the item's versions drifted outside the canvas, and
 * the daemon refuses it with a 409 the first time so that the second press is
 * a decision rather than an accident.
 */
export function writeItem(
  canvasId: string,
  itemId: string,
  force = false,
): Promise<{ root: string; path: string; wrote: string }> {
  return request("POST", `/api/projects/${encodeURIComponent(canvasId)}/write`, { itemId, force });
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
export function listSpaces(): Promise<SpacesResponse> {
  return request("GET", SPACES_ROUTE);
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

export function createSpaceBar(spaceId: string, subject: GrantSubject, actorId?: string): Promise<GrantResponse> {
  return request("POST", spaceGrantsRoute(spaceId), {
    subject,
    bars: true,
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

/**
 * **A version's bytes, read through the door.**
 *
 * The third call that cannot use `request` — `uploadBlob` sends bytes,
 * `readBoundFile` receives a bound file's, and this receives a blob's — so
 * the 401 recovery is spelled out here for the same reason, and in the same
 * shape: knock once, re-claim this tab's persona, ask again.
 *
 * `blobUrl` stays, and is still the right call for an `<img src>`, a video,
 * or an iframe: the browser loads those itself and there is no response for
 * anyone to recover from. What is NOT fine is `fetch(blobUrl(...))`, which
 * the app did in seven places. Every one of them read a 401 as an ANSWER —
 * an empty composer over words that still exist, an editor opened on
 * `{"error":"..."}`, a copy that copies nothing, a text item that looks
 * blank. The route was spelled once, so the door guard stayed green; the
 * recovery was missing all seven times, which is the thing that hurt.
 *
 * Throws an `ApiError` if the home is still refusing after the knock —
 * `homeAnswered` tells that apart from never reaching it — so a caller can
 * say which silence it is instead of rendering empty.
 */
async function fetchBlob(canvasId: string, blobHash: string): Promise<Response> {
  const url = blobUrl(canvasId, blobHash);
  let res = await fetch(url);
  if (res.status === 401 && (await knockOnDoor())) res = await fetch(url);
  if (!res.ok) {
    const json = (await res.json().catch(() => null)) as any;
    throw new ApiError(res.status, json?.error ?? `HTTP ${res.status}`, json?.code, json?.reason);
  }
  return res;
}

/** A version's bytes. */
export async function readBlob(canvasId: string, blobHash: string): Promise<Blob> {
  return (await fetchBlob(canvasId, blobHash)).blob();
}

/**
 * A version's bytes as text.
 *
 * Only reached on a 2xx, which is load-bearing: a 404's body is the daemon's
 * own `{"error":"blob not found"}`, and reading THAT as the document is how
 * that JSON ends up rendered on the canvas — or, worse, opened in an editor
 * and saved back over the file.
 */
export async function readBlobText(canvasId: string, blobHash: string): Promise<string> {
  return (await fetchBlob(canvasId, blobHash)).text();
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
