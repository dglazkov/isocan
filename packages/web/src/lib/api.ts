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
  SlashCommand,
} from "@isocan/core";
import { DOOR_ROUTE, encodeFilename, FILENAME_HEADER, newClientId } from "@isocan/core";

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
 * Go to the door and be handed a cookie. The page load already badges this
 * browser — the daemon sets the cookie on the HTML document — so this is
 * belt-and-braces: it heals a cookie that was cleared mid-session, and the
 * visible property is that NOTHING is visible. One 401 in the network log,
 * one door call, the retried request at 200, and the canvas does not flinch.
 */
export async function knockOnDoor(): Promise<boolean> {
  try {
    const res = await fetch(DOOR_ROUTE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ carrier: "cookie" }),
    });
    return res.ok;
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
  if (res.status === 401 && (await knockOnDoor())) res = await send();
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

export function runGc(projectId: string, options: GcRequest = {}): Promise<GcReport> {
  return request("POST", `/api/projects/${projectId}/gc`, options);
}

export function blobUrl(projectId: string, blobHash: string): string {
  return `/api/projects/${projectId}/blobs/${blobHash}`;
}
