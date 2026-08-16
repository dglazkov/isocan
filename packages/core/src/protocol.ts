import type { Actor, CanvasState, Project } from "./model.ts";
import type { LogEntry, OpEnvelope, Operation } from "./ops.ts";

/** Default daemon port, localhost only. */
export const DEFAULT_PORT = 4441;

// ---- WebSocket ----

export type ServerMessage =
  | { type: "snapshot"; project: Project; canvas: CanvasState; lastSeq: number }
  | { type: "op-applied"; entry: LogEntry }
  | { type: "project-deleted" }
  | { type: "presence-roster"; sessions: PresenceSession[] };

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
  /** Where this session lives. "project" — on this canvas, with a cursor.
   * "home" — ON CALL: parked in a terminal (`isocan wait`) and listening to
   * the whole home, so it surfaces on EVERY canvas, including ones it has
   * never touched. That is how a fresh canvas can @-mention an agent. */
  scope: "project" | "home";
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
  lastSeen: string;
}

export type PresenceActivity =
  | { kind: "working"; itemId: string }
  | { kind: "working"; x: number; y: number };

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
  /** null only for project.create. */
  projectId: string | null;
  actor: Actor;
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

export interface CanvasSnapshotResponse {
  project: Project;
  canvas: CanvasState;
  lastSeq: number;
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
