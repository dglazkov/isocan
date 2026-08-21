import type {
  Actor,
  ActorClaimOp,
  ActorColors,
  BlobUploadResponse,
  CanvasSnapshotResponse,
  GcReport,
  GcRequest,
  LogEntry,
  Operation,
  PostOpResponse,
  Project,
  ActorNames,
} from "@isocan/core";
import { encodeFilename, FILENAME_HEADER, newClientId } from "@isocan/core";

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

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    ...(body !== undefined
      ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
      : {}),
  });
  const json = (await res.json().catch(() => null)) as any;
  if (!res.ok) throw new ApiError(res.status, json?.error ?? `HTTP ${res.status}`, json?.code);
  return json as T;
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
  const res = await fetch(`/api/projects/${projectId}/blobs`, {
    method: "POST",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      [FILENAME_HEADER]: encodeFilename(filename),
    },
    body: file,
  });
  const json = (await res.json().catch(() => null)) as any;
  if (!res.ok) throw new ApiError(res.status, json?.error ?? `HTTP ${res.status}`, json?.code);
  return json as BlobUploadResponse;
}

export function runGc(projectId: string, options: GcRequest = {}): Promise<GcReport> {
  return request("POST", `/api/projects/${projectId}/gc`, options);
}

export function blobUrl(projectId: string, blobHash: string): string {
  return `/api/projects/${projectId}/blobs/${blobHash}`;
}
