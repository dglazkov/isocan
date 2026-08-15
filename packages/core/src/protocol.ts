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
  /** Display override; fall back to actor.name. */
  label: string | null;
  cursor: { x: number; y: number } | null;
  selection: string[];
  status: string | null;
  /** "Busy with X" — clients render the motion locally; the daemon only
   * stores the fact. Cleared by explicit cursor commands and by any
   * piggybacked op (working resolves into done). */
  activity: { kind: "working"; itemId: string } | null;
  lastSeen: string;
}

export interface CreateSessionRequest {
  actor: Actor;
  label?: string;
}

export interface CreateSessionResponse {
  sessionId: string;
  ttlMs: number;
}

export interface UpdateSessionRequest {
  cursor?: { x: number; y: number } | null;
  selection?: string[];
  status?: string | null;
  activity?: { kind: "working"; itemId: string } | null;
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
