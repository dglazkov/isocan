import type { Actor, CanvasState, Project } from "./model.ts";
import type { LogEntry, OpEnvelope, Operation } from "./ops.ts";

/** Default daemon port, localhost only. */
export const DEFAULT_PORT = 4441;

// ---- WebSocket, server → client only ----

export type ServerMessage =
  | { type: "snapshot"; project: Project; canvas: CanvasState; lastSeq: number }
  | { type: "op-applied"; entry: LogEntry }
  | { type: "project-deleted" };

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
