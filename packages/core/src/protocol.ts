import type { ActorColors, ActorNames } from "./identity.ts";
import type { Actor, CanvasState, Project } from "./model.ts";
import type { LogEntry, OpEnvelope, Operation } from "./ops.ts";

/** Default daemon port, localhost only. */
export const DEFAULT_PORT = 4441;

// ---- WebSocket ----

export type ServerMessage =
  | {
      type: "snapshot";
      project: Project;
      canvas: CanvasState;
      lastSeq: number;
      /** Chosen identity colors, so the first paint is already right. */
      colors: ActorColors;
      /** Current names (actor id → name), so a rename reaches the words
       * somebody wrote before it. Absent entries keep the stamped name. */
      names: ActorNames;
    }
  /**
   * The other half of the connect handshake: "you already have through
   * `from`, here is what happened since." What follows is one `op-applied`
   * per entry in `from+1 … lastSeq`, in order, replayed through the same
   * reducer a crash recovery replays — because it IS that code path.
   *
   * A client asks for this with `?since=N` and must be ready for either
   * answer: the home sends `snapshot` instead whenever it cannot serve the
   * tail (the client is ahead of it, or the entries have been compacted out
   * of the live log). That is not an error path, it is the fallback half of
   * one contract, and a client that treats a `snapshot` where it expected a
   * `resumed` as a failure has misread it.
   *
   * `colors` and `names` ride along for the same reason `snapshot` carries
   * them: a rename or a recolour that happened while the lid was shut has to
   * reach the words that were written before it, and nothing in the op tail
   * carries identity's public face.
   */
  | {
      type: "resumed";
      /** The cursor the client presented — the last seq it already holds. */
      from: number;
      /** The last seq it will hold once the tail below has been applied. */
      lastSeq: number;
      colors: ActorColors;
      names: ActorNames;
    }
  | { type: "op-applied"; entry: LogEntry }
  | { type: "project-deleted" }
  /** The roster carries the chosen identity colors with it: they change about
   * as often as who is here, and every client that needs one is already
   * listening. A color nobody else can see is not an identity, so it travels
   * on the same channel as the faces it paints. */
  | {
      type: "presence-roster";
      sessions: PresenceSession[];
      colors: ActorColors;
      names: ActorNames;
    };

/** Client → server. Presence is the ephemeral plane: daemon memory + WS
 * fan-out only — never the oplog, never storage, never undo. */
export type ClientMessage =
  | {
      type: "presence";
      /** The tab's client id — doubles as its presence session id. */
      sessionId: string;
      actor: Actor;
      cursor: { x: number; y: number } | null;
      selection: string[];
    }
  /**
   * A whole roster, from a connection that speaks for several people at once.
   *
   * This is the daemon's beat, not a tab's: "one connection carries several
   * actors" is the case mechanism 1 drew the badge for — Priya's daemon
   * relaying its CLI self AND Isaac — and a per-session `presence` message
   * cannot express it, because one socket is one presence session by
   * construction there.
   *
   * A full set replaces what that connection last relayed, rather than a diff:
   * the sender already has the whole roster in hand (it is what its own hub
   * holds), and a diff protocol would be a second thing to get wrong for no
   * saving worth measuring on a plane that is already coalesced.
   *
   * Sessions keep their ids, their `kind`, their labels and their statuses, so
   * a parked agent on somebody's laptop shows on the home's canvas as a parked
   * agent — Scene 4's dimmed face with a dashed ring — rather than as an
   * anonymous cursor. The receiving daemon still checks EVERY actor in it
   * against the relaying badge's claims and drops the ones it cannot vouch
   * for; the sender's word for who is here is not the sender's word for who it
   * may speak as.
   */
  | { type: "presence-relay"; sessions: PresenceSession[] };

// ---- presence sessions ----

export interface PresenceSession {
  sessionId: string;
  actor: Actor;
  kind: "web" | "cli";
  /** Display override; fall back to actor.name. */
  label: string | null;
  cursor: { x: number; y: number } | null;
  selection: string[];
  status: string | null;
  /** "Busy here" — anchored to an item OR a freestanding point. Clients
   * render the motion locally; the daemon only stores the fact. Cleared by
   * explicit cursor commands and by any piggybacked op (working resolves
   * into done). */
  activity: PresenceActivity | null;
  /**
   * The thread this session is answering, if it has picked one up.
   *
   * Deliberately NOT part of `activity`. That field says where somebody is
   * STANDING, and it changes constantly — an agent answering a thread spends
   * most of its time working on the items the thread is about, and every
   * `session work`, every `point`, and every applied op moves it. What it is
   * ANSWERING does not change when it walks across the canvas to do the work.
   * Folding the two together meant an agent vanished from the thread the
   * instant it started working, which is exactly when you most want to see it.
   *
   * Cleared by the receipt — posting a comment — because that is the answer.
   */
  onThread: string | null;
  lastSeen: string;
}

export type PresenceActivity =
  | { kind: "working"; itemId: string }
  | { kind: "working"; x: number; y: number }
  /** On a THREAD: picked up what was asked there and working on it. The other
   * two say where on the canvas somebody is; this one says what they are
   * answering, which is the question the person who asked it is waiting on.
   * Rendering it from the cursor's position instead — "is this dot near that
   * pin?" — is a guess, and it is wrong the moment the agent goes to look at
   * the thing it was asked about. */
  | { kind: "working"; threadId: string };

export interface CreateSessionRequest {
  actor: Actor;
  label?: string;
}

export interface CreateSessionResponse {
  sessionId: string;
  ttlMs: number;
}

export interface UpdateSessionRequest {
  /** Who is holding this session now. Sent on every update so renaming
   * yourself re-labels the live face instead of waiting out its TTL — the
   * same contract the web's presence beat carries over the socket. */
  actor?: Actor;
  cursor?: { x: number; y: number } | null;
  selection?: string[];
  status?: string | null;
  /** Who is speaking when `status` is set. "explicit" (default) — the actor
   * said it (`session say/work --say`); it sticks until they post a comment
   * or say something else. "lifecycle" — the choreography itself (parking on
   * `wait`, being woken); overrides anything. "inferred" — narration derived
   * from what a command is doing; never displaces an explicit status. */
  statusSource?: "explicit" | "lifecycle" | "inferred";
  activity?: PresenceActivity | null;
  /** Pick up a thread, or (null) put it down. Omit to leave it alone: the
   * whole point is that it survives everything else a session does. */
  onThread?: string | null;
}

// ---- watching the whole home ----

/**
 * The cross-project long-poll behind `isocan wait`. An on-call agent listens
 * to canvases it has never opened — including ones created while it waits —
 * so the cursor is a MAP of per-project seqs rather than one number.
 *
 * Omit `cursors` to seed: the daemon returns no entries and the current tip
 * of every project, which is "everything from now on". A project missing from
 * a supplied map is watched from its very first op — exactly right for a
 * canvas born mid-wait.
 */
export interface WatchLogRequest {
  cursors?: Record<string, number>;
  /** Watch exactly these canvases and no others — what `wait --project` uses.
   * Omit to watch the whole home, canvases yet to be created included. */
  only?: string[];
  /** Hold the request open this long when nothing has landed yet. */
  waitMs?: number;
}

export interface WatchedLogEntry extends LogEntry {
  projectId: string;
  /** The canvas's title, so a waiter can name where it was summoned. */
  projectTitle: string;
}

export interface WatchLogResponse {
  /** Across all watched projects, oldest first. */
  entries: WatchedLogEntry[];
  /** Feed straight back into the next request. */
  cursors: Record<string, number>;
}

// ---- REST payloads ----

export interface PostOpRequest {
  /** null only for project.create and actor.claim. */
  projectId: string | null;
  /** Who is speaking. Optional for actor.claim only — a claim RESOLVES who
   * is speaking, and the response envelope carries the answer. */
  actor?: Actor;
  clientId?: string;
  op: Operation;
}

export interface PostOpResponse {
  seq: number;
  envelope: OpEnvelope;
}

export interface UndoRedoRequest {
  actor: Actor;
  clientId?: string;
}

export interface BlobUploadResponse {
  blobHash: string;
  mimeType: string;
  size: number;
}

/** The header a blob upload carries its filename in. */
export const FILENAME_HEADER = "X-Isocan-Filename";

/**
 * Above this, a blob does not go through the daemon.
 *
 * ONE number, here, because both clients branch on it and "the same
 * computation in two clients" is exactly what the house rules forbid. It is
 * below Cloud Run's 32 MiB HTTP/1 request-body cap with room to spare: a
 * hosted home physically cannot receive a larger body, so a client that
 * posted one would get a platform error with no isocan words in it. Under it
 * the bytes are posted to `POST /api/projects/:id/blobs` as they always have
 * been; over it the client asks for an upload ticket, PUTs straight to object
 * storage, and registers the hash.
 *
 * A `FileStore` home has no ticket to give and says so (`beginUpload` returns
 * null), so a local daemon keeps the single simple path at any size — the
 * split is the cloud backing's, not the protocol's.
 */
export const MAX_DIRECT_UPLOAD_BYTES = 24 * 1024 * 1024;

/** What the daemon hands back for a blob too big to post: where to PUT the
 * bytes, and the headers that were SIGNED into that URL — send them exactly,
 * or the upload is refused by the object store rather than by us. */
export interface UploadTicket {
  url: string;
  headers: Record<string, string>;
  /** ISO 8601. Short — minutes, not days. */
  expiresAt: string;
}

/** The daemon's answer to "I have a big blob": either a ticket, or the news
 * that these bytes are already here and no upload is needed. */
export type BeginUploadResponse =
  | { upload: UploadTicket; blob?: undefined }
  | { upload?: undefined; blob: BlobUploadResponse };

/**
 * Filenames travel percent-encoded, because a header value is a ByteString
 * and real filenames are not. Every macOS screenshot is named with U+202F
 * (narrow no-break space) before AM/PM, and handing that to `fetch` throws
 * before a request is ever made — which read, on the canvas, as a PNG that
 * silently refused to be dropped.
 */
export const encodeFilename = (filename: string): string => encodeURIComponent(filename);

/** Inverse of {@link encodeFilename}. A literal name from an older client or
 * a hand-rolled `curl` survives: only malformed escapes fall back. */
export function decodeFilename(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? "");
  if (!value) return "upload.bin";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export interface CanvasSnapshotResponse {
  project: Project;
  canvas: CanvasState;
  lastSeq: number;
  /** Chosen identity colors (actor id → hex); absent entries are derived. */
  colors: ActorColors;
  /** Current names (actor id → name); absent entries keep the name that
   * was stamped on the comment or op being rendered. */
  names: ActorNames;
}

export interface HealthResponse {
  ok: true;
  pid: number;
  version: string;
  startedAt: string;
  /**
   * The home this daemon is a REPLICA of, when it is one; absent when the
   * daemon IS a home (every daemon before phase 6, and every daemon nobody has
   * configured).
   *
   * On the health route because that is the one call every client already
   * makes before it does anything else, and because the answer changes what a
   * client may say to a person: a replica serves no pages, so `isocan open`
   * and `isocan setup` must send them to this address instead of to
   * `127.0.0.1`, and the marker a new canvas gets must carry it.
   */
  home?: string;
}

/** Loopback, by the two literals a URL can produce plus the whole 127/8
 * block RFC 1122 reserves. `new URL()` hands IPv6 hosts back in brackets,
 * so `::1` arrives as `[::1]` and has to be recognized in that shape. */
const LOOPBACK = /^(\[::1\]|::1|localhost|127\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i;

/**
 * WHICH health path to ask a daemon at this address for.
 *
 * The daemon answers `/healthz` and `/api/healthz` from one handler with one
 * body, so this is never a second thing to keep in sync — it is a choice of
 * which door to knock on, and the choice belongs to the ADDRESS rather than
 * to the caller.
 *
 * Why it existed, and why it stays after that reason expired. Phase 5 measured
 * Google's frontend claiming the exact path `/healthz` on the dev home and
 * answering its own branded 404, never reaching the container — so a probe
 * that had only ever spoken to 127.0.0.1 (`daemonPidOn`, `ensureDaemon`'s
 * startup poll, `warnIfStale`, `stopDaemons`, `isocan status`) would read a
 * live hosted home as DEAD the first time it was pointed at one. Phase 6
 * pointed all of them at one, and then re-measured: `/healthz` on that same
 * home now returns the daemon's own body. Something between the two days
 * changed, and which end of the wire it was is not established.
 *
 * The function stays, for the reason that never depended on the frontend:
 * `/api/` is the one prefix the SPA fallback does not answer with a cheerful
 * 200. `/healthz/` and `/HEALTHZ` come back as `index.html` at 200 — a check
 * on a near-miss path is green forever and cannot fail for the right reason.
 * So this is now DEFENSIVE rather than necessary, which is the honest way to
 * hold a guard against behaviour that went away without notice and can return
 * the same way.
 *
 * Loopback keeps `/healthz` deliberately: no frontend stands between a CLI and
 * its own daemon, every one of those callers works exactly as it does today,
 * and this stays an addition rather than a rename. `/api/healthz` is the other
 * answer because `/api/` is the one prefix the SPA fallback does not answer
 * with a cheerful 200 — a check that cannot fail is the defect the pair of
 * routes exists to avoid.
 *
 * Anything unparseable is treated as remote. That is the safe way to be wrong:
 * `/api/healthz` is answered on loopback too, so a mistake here costs nothing,
 * while guessing "loopback" about an address we could not read would resurrect
 * the exact failure this function exists to prevent.
 */
export function healthPath(base: string): string {
  let host: string;
  try {
    host = new URL(base).hostname;
  } catch {
    try {
      // A bare `127.0.0.1:4441` or `dev.isocan.io` — no scheme, still an
      // address somebody meant. Parsing it is cheaper than refusing it.
      host = new URL(`http://${base}`).hostname;
    } catch {
      return "/api/healthz";
    }
  }
  return LOOPBACK.test(host) ? "/healthz" : "/api/healthz";
}

// ---- the canvas listing: two callers, two questions, one route ----

/**
 * How far `GET /api/projects` may see — **stated by the caller**, never
 * inferred from who is calling.
 *
 * Two clients poll this route and they are not asking the same thing:
 *
 * - A **browser** asks "what can I open from here?" That is a person looking
 *   at their own home's front page, and the honest answer includes a canvas
 *   they have never been in but could walk into by clicking it — which on a
 *   solo home is most of them, because a canvas created from the CLI is
 *   admitted to the CLI's BEARER badge while the tab carries a COOKIE badge
 *   that has never been in it. Narrow this and the person opens `/` and
 *   cannot see the canvas their own agent just made.
 * - A **replica** asks "what am I supposed to be carrying?" A replica that
 *   answers that with "everything a door would let me through" mirrors a
 *   stranger's canvas onto a laptop because a link grant happened to be on —
 *   which is discovery by enumeration, and phase 7 named it the wrong
 *   primitive.
 *
 * So the route answers both and the CALLER says which. Sniffing the carrier
 * would be the obvious shortcut and it is the one this codebase already
 * refuses (`BadgeCarrier`: stated, never sniffed) — a bearer holder is a CLI
 * as often as it is a replica, and the day a browser holds a bearer the
 * sniff silently changes what a person can see.
 *
 * The vocabulary is deliberately the SAME two words `claimContext` already
 * uses for the same distinction one layer down (`NameReach` in the server's
 * engine), because it is the same distinction: what a badge has been let
 * into, versus what the door would let it into if it knocked.
 *
 * - `"admissible"` — admitted ∪ what a grant would admit. **The default**,
 *   which is what makes this change backwards compatible in the direction
 *   that matters: an OLD replica polling a new home sends no parameter and
 *   gets exactly the answer it always got. A NEW replica polling an old home
 *   sends one that home ignores, and over-replicates the way it does today —
 *   a known, pre-existing behaviour rather than a new failure.
 * - `"admitted"` — admissions and nothing else. What a replica asks.
 */
export type ProjectsReach = "admitted" | "admissible";

/** The query parameter carrying a {@link ProjectsReach}. One spelling, so a
 * caller cannot get it subtly wrong and silently receive the wide answer. */
export const PROJECTS_REACH_PARAM = "reach";

/** `GET /api/projects`, optionally narrowed. Built here rather than spelled at
 * each caller for `grantRoute`/`passesRoute`'s reason: the one place a route
 * is written is the one place it can be got wrong. */
export function projectsRoute(reach?: ProjectsReach): string {
  return reach ? `/api/projects?${PROJECTS_REACH_PARAM}=${reach}` : "/api/projects";
}

// ---- joining one canvas at the home ----

/**
 * **"Fetch me this one canvas from my home."** POST `{projectId}` at a
 * replica; the replica asks its home about that canvas with its own badge,
 * and the home's door decides.
 *
 * This is the other half of narrowing the sweep, and without it the narrowing
 * would be a regression rather than a fix. Two shipped, documented arrivals
 * carry a canvas's ADDRESS but no admission:
 *
 * - a **cloned marker** — `.isocan/project.json` committed to git and checked
 *   out on a second machine (Scene 0's multi-device beat, `second-device`), and
 * - a **pass-less `isocan setup <address>`** — arriving thin from a terminal,
 *   under the canvas's standing link grant.
 *
 * Both used to work by accident: the replica enumerated its home and the
 * canvas was in the list, so the sweep dialled it. Enumeration is what phase 7
 * named the wrong primitive, so the arrival has to say what it wants instead —
 * which it can, because in both cases somebody handed this machine an id.
 *
 * **It is not a new privilege.** The home runs exactly the door test it always
 * ran; the admission it writes is the same `{root: "grant"}` row that dialling
 * the canvas would have written a second later. What changes is only that the
 * home is asked about ONE canvas by name instead of being asked to list
 * itself.
 *
 * Outside `/api/projects/` deliberately, for `PASS_REDEEM_ROUTE`'s reason: a
 * route under that prefix runs the LOCAL door test, and the whole premise here
 * is a canvas this machine does not have yet.
 */
export const HOME_JOIN_ROUTE = "/api/home/join";

export interface JoinCanvasRequest {
  projectId: string;
}

/** The home's own row for that canvas — title included, so a caller can say
 * what arrived rather than echoing back the id it already had. */
export interface JoinCanvasResponse {
  project: Project;
}

export interface ApiError {
  error: string;
  code?: string;
}

/**
 * **There is no such route under `/api/` on this daemon** — and saying so is
 * phase 8 closing phase 7.5's open finding.
 *
 * An unmatched `/api/` path used to fall through to the SPA handler and answer
 * **200 with the web app**: the fourth instance of "this system's default
 * answer to a wrong address is a cheerful one", after `/healthz/`, the blank
 * page a mistyped canvas address rendered, and a socket refusal
 * indistinguishable from a network blip. This one had
 * teeth beyond legibility, because it is how one VERSION of this code talks to
 * another: a replica asking an older home for a route that home does not have
 * got HTML, and the fallback worked *only because parsing HTML as JSON
 * throws*. Correct by accident is not correct — and phase 8 is the moment it
 * stops being theoretical, because a replica now asks its home to redeem a
 * pass, and a home that predates this phase has no such route.
 *
 * The code is exported here, rather than spelled in the server, because it is
 * the answer a CLIENT reads to tell "this home is too old for that" from "this
 * home refused me". Nothing branches on it today: the callers that meet it
 * fall back for any refusal, which is the right shape. It is here so that the
 * first caller that WANTS to branch has a name to branch on rather than a
 * status code shared with four other meanings.
 */
export const UNKNOWN_ROUTE = "unknown-route";

// ---- blob garbage collection (maintenance; not an Operation) ----

export interface GcRequest {
  /** How many recent oplog entries to keep (the undo horizon). */
  keepOps?: number;
  /** Report only; delete and rewrite nothing. */
  dryRun?: boolean;
  /** Blobs younger than this are never swept (covers the upload→item.add gap). */
  graceMs?: number;
}

export interface GcReport {
  dryRun: boolean;
  retainedEntries: number;
  droppedEntries: number;
  reachableBlobs: number;
  reachableBytes: number;
  sweptBlobs: number;
  sweptBytes: number;
  /** Unreachable but inside the grace period — left for a later run. */
  skippedRecentBlobs: number;
}
