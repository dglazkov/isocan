import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import { openSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  Actor,
  BlobUploadResponse,
  CanvasSnapshotResponse,
  CreateSessionResponse,
  GcReport,
  GcRequest,
  LogEntry,
  Operation,
  PostOpResponse,
  PresenceSession,
  Project,
  UpdateSessionRequest,
  WatchLogRequest,
  WatchLogResponse,
} from "@isocan/core";
import { paths } from "@isocan/server";

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

export class DaemonClient {
  constructor(
    readonly base: string,
    readonly home: string,
  ) {}

  private async request<T>(method: string, url: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.base}${url}`, {
      method,
      ...(body !== undefined
        ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
        : {}),
    });
    const json = (await res.json().catch(() => null)) as any;
    if (!res.ok) {
      throw new ApiError(res.status, json?.error ?? `HTTP ${res.status}`, json?.code);
    }
    return json as T;
  }

  async health(timeoutMs = 300): Promise<boolean> {
    try {
      const res = await fetch(`${this.base}/healthz`, { signal: AbortSignal.timeout(timeoutMs) });
      return res.ok;
    } catch {
      return false;
    }
  }

  /** Start the daemon detached if it isn't answering, then wait for healthz. */
  async ensureDaemon(): Promise<void> {
    if (await this.health()) return;
    const cliBin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../bin/isocan.js");
    await fs.mkdir(this.home, { recursive: true });
    const log = openSync(paths.daemonLogFile(this.home), "a");
    const port = new URL(this.base).port;
    spawn(process.execPath, [cliBin, "serve", "--foreground"], {
      detached: true,
      stdio: ["ignore", log, log],
      env: { ...process.env, ISOCAN_PORT: port, ISOCAN_HOME: this.home },
    }).unref();
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      if (await this.health(500)) return;
      await new Promise((r) => setTimeout(r, 150));
    }
    throw new Error(`daemon did not come up on ${this.base} — see ${paths.daemonLogFile(this.home)}`);
  }

  sendOp(
    projectId: string | null,
    actor: Actor,
    op: Operation,
    clientId?: string,
  ): Promise<PostOpResponse> {
    return this.request("POST", "/api/ops", {
      projectId,
      actor,
      op,
      ...(clientId !== undefined ? { clientId } : {}),
    });
  }

  // ---- presence sessions ----

  createSession(projectId: string, actor: Actor, label?: string): Promise<CreateSessionResponse> {
    return this.request("POST", `/api/projects/${projectId}/sessions`, {
      actor,
      ...(label !== undefined ? { label } : {}),
    });
  }

  updateSession(
    projectId: string,
    sessionId: string,
    patch: UpdateSessionRequest,
  ): Promise<{ ok: true }> {
    return this.request("PUT", `/api/projects/${projectId}/sessions/${sessionId}`, patch);
  }

  endSession(projectId: string, sessionId: string): Promise<{ ok: true }> {
    return this.request("DELETE", `/api/projects/${projectId}/sessions/${sessionId}`);
  }

  listSessions(projectId: string): Promise<PresenceSession[]> {
    return this.request("GET", `/api/projects/${projectId}/sessions`);
  }

  // ---- on call: presence that belongs to the home, not to one canvas ----

  createOnCall(actor: Actor, label?: string): Promise<CreateSessionResponse> {
    return this.request("POST", "/api/presence/oncall", {
      actor,
      ...(label !== undefined ? { label } : {}),
    });
  }

  touchOnCall(sessionId: string, patch: UpdateSessionRequest): Promise<{ ok: true }> {
    return this.request("PUT", `/api/presence/oncall/${sessionId}`, patch);
  }

  endOnCall(sessionId: string): Promise<{ ok: true }> {
    return this.request("DELETE", `/api/presence/oncall/${sessionId}`);
  }

  listProjects(): Promise<Project[]> {
    return this.request("GET", "/api/projects");
  }

  snapshot(projectId: string): Promise<CanvasSnapshotResponse> {
    return this.request("GET", `/api/projects/${projectId}/canvas`);
  }

  /** With waitMs, the daemon long-polls: holds until an entry lands past
   * `since` or the window closes (empty array). */
  getLog(projectId: string, since: number, waitMs?: number): Promise<LogEntry[]> {
    const wait = waitMs !== undefined ? `&waitMs=${waitMs}` : "";
    return this.request("GET", `/api/projects/${projectId}/oplog?since=${since}${wait}`);
  }

  /** Every project at once. Omit `cursors` to seed at "now"; otherwise the
   * daemon long-polls until an op lands on any canvas. */
  watchLog(request: WatchLogRequest): Promise<WatchLogResponse> {
    return this.request("POST", "/api/oplog/watch", request);
  }

  undo(projectId: string, actor: Actor): Promise<LogEntry> {
    return this.request("POST", `/api/projects/${projectId}/undo`, { actor });
  }

  redo(projectId: string, actor: Actor): Promise<LogEntry> {
    return this.request("POST", `/api/projects/${projectId}/redo`, { actor });
  }

  gc(projectId: string, request: GcRequest): Promise<GcReport> {
    return this.request("POST", `/api/projects/${projectId}/gc`, request);
  }

  async uploadBlob(
    projectId: string,
    data: Buffer,
    mimeType: string,
    filename: string,
  ): Promise<BlobUploadResponse> {
    const res = await fetch(`${this.base}/api/projects/${projectId}/blobs`, {
      method: "POST",
      headers: { "Content-Type": mimeType, "X-Isocan-Filename": filename },
      body: new Uint8Array(data),
    });
    const json = (await res.json().catch(() => null)) as any;
    if (!res.ok) throw new ApiError(res.status, json?.error ?? `HTTP ${res.status}`, json?.code);
    return json as BlobUploadResponse;
  }

  async downloadBlob(projectId: string, blobHash: string): Promise<Buffer> {
    const res = await fetch(`${this.base}/api/projects/${projectId}/blobs/${blobHash}`);
    if (!res.ok) throw new ApiError(res.status, `blob not found: ${blobHash}`);
    return Buffer.from(await res.arrayBuffer());
  }
}
