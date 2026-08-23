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
export type ClientMessage = {
  type: "presence";
  /** The tab's client id — doubles as its presence session id. */
  sessionId: string;
  actor: Actor;
  cursor: { x: number; y: number } | null;
  selection: string[];
};

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
}

export interface ApiError {
  error: string;
  code?: string;
}

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
