import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import { openSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  Actor,
  ActorBindingRecord,
  ActorClaimOp,
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
  ActorNames,
  SlashCommand,
} from "@isocan/core";
import type { DoorResponse } from "@isocan/core";
import { BADGE_SCHEME, DOOR_ROUTE, encodeFilename, FILENAME_HEADER, formatBadgeToken } from "@isocan/core";
import type { BuildStamp } from "@isocan/server";
import { paths } from "@isocan/server";

/** `/healthz`: who is holding the port, and which build they are. */
export interface Health extends Partial<BuildStamp> {
  ok: true;
  pid: number;
  startedAt: string;
}

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

/** One badge, as `identity.json`'s `auth` block holds it. Keyed by home
 * address, so phase 6's second badge — a local daemon's badge TO the home —
 * has a slot waiting instead of needing a second file. */
interface StoredBadge {
  badgeId: string;
  secret: string;
  at: string;
}

export class DaemonClient {
  /** Loaded once per process, from `identity.json`'s `auth` block. */
  private badge: StoredBadge | null | undefined;

  constructor(
    readonly base: string,
    readonly home: string,
  ) {}

  /**
   * Every request carries the badge, and a refused one goes to the door and
   * comes straight back. This is what makes the door NOT a breaking change:
   * a CLI that has never seen a badge, or whose home was wiped, heals itself
   * in one extra round trip with nobody told anything.
   */
  private async request<T>(method: string, url: string, body?: unknown): Promise<T> {
    const send = async () => {
      const headers: Record<string, string> = { ...(await this.authHeader()) };
      if (body !== undefined) headers["Content-Type"] = "application/json";
      return fetch(`${this.base}${url}`, {
        method,
        ...(Object.keys(headers).length > 0 ? { headers } : {}),
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
    };
    let res = await send();
    if (res.status === 401 && (await this.reBadge())) res = await send();
    const json = (await res.json().catch(() => null)) as any;
    if (!res.ok) {
      throw new ApiError(res.status, json?.error ?? `HTTP ${res.status}`, json?.code);
    }
    return json as T;
  }

  /** `Authorization: Bearer <badgeId>.<secret>`, when we hold one. */
  private async authHeader(): Promise<Record<string, string>> {
    const badge = await this.storedBadge();
    if (!badge) return {};
    return { Authorization: `${BADGE_SCHEME} ${formatBadgeToken(badge.badgeId, badge.secret)}` };
  }

  private async storedBadge(): Promise<StoredBadge | null> {
    if (this.badge === undefined) this.badge = await readBadge(this.home, this.base);
    return this.badge;
  }

  /** Go to the door and keep what it hands over. Returns false if the door
   * itself refused, so a caller does not loop. */
  private async reBadge(): Promise<boolean> {
    try {
      const res = await fetch(`${this.base}${DOOR_ROUTE}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carrier: "bearer" }),
      });
      if (!res.ok) return false;
      const door = (await res.json()) as DoorResponse;
      if (!door.secret) return false;
      const badge: StoredBadge = {
        badgeId: door.badgeId,
        secret: door.secret,
        at: new Date().toISOString(),
      };
      this.badge = badge;
      await writeBadge(this.home, this.base, badge);
      return true;
    } catch {
      return false;
    }
  }

  /** The badge this client is presenting, for `whoami` to print. Never the
   * secret. */
  async badgeId(): Promise<string | null> {
    return (await this.storedBadge())?.badgeId ?? null;
  }

  async health(timeoutMs = 300): Promise<boolean> {
    return (await this.healthz(timeoutMs)) !== null;
  }

  /** The daemon's own account of itself — pid, when it started, and which
   * copy of isocan it is running. Null when nothing answers. */
  async healthz(timeoutMs = 300): Promise<Health | null> {
    try {
      const res = await fetch(`${this.base}/healthz`, { signal: AbortSignal.timeout(timeoutMs) });
      return res.ok ? ((await res.json()) as Health) : null;
    } catch {
      return null;
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

  /** Name (or resume) the actor behind a session key — the one op sent
   * without an actor: the response envelope says who you are. */
  claimActor(op: ActorClaimOp): Promise<PostOpResponse> {
    return this.request("POST", "/api/ops", { projectId: null, op });
  }

  /** Who the given session keys speak as (everyone, when omitted). */
  actorBindings(keys?: string[]): Promise<ActorBindingRecord[]> {
    const query = keys?.length ? `?keys=${keys.map(encodeURIComponent).join(",")}` : "";
    return this.request("GET", `/api/actors${query}`);
  }

  /** Claims for these session keys held by a badge that is not this one —
   * what a client whose badge was lost needs in order to be told the truth
   * about why it has no identity. Never adopts; only reports. */
  orphanedActors(keys: string[]): Promise<ActorBindingRecord[]> {
    const query = keys.length ? `?keys=${keys.map(encodeURIComponent).join(",")}` : "";
    return this.request("GET", `/api/actors/orphaned${query}`);
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
  ): Promise<{ ok: true; cancelled?: { threadId: string; by: string; at: string } }> {
    return this.request("PUT", `/api/projects/${projectId}/sessions/${sessionId}`, patch);
  }

  endSession(projectId: string, sessionId: string): Promise<{ ok: true }> {
    return this.request("DELETE", `/api/projects/${projectId}/sessions/${sessionId}`);
  }

  listSessions(projectId: string): Promise<PresenceSession[]> {
    return this.request("GET", `/api/projects/${projectId}/sessions`);
  }

  /** End every session an actor holds — the daemon-side truth, for when the
   * local session pointer has been lost. */
  endActorSessions(actorId: string, kind?: "web" | "cli"): Promise<{ ended: number }> {
    const query = kind ? `?kind=${kind}` : "";
    return this.request("DELETE", `/api/presence/actors/${actorId}${query}`);
  }

  listProjects(): Promise<Project[]> {
    return this.request("GET", "/api/projects");
  }

  snapshot(projectId: string): Promise<CanvasSnapshotResponse> {
    return this.request("GET", `/api/projects/${projectId}/canvas`);
  }

  /** The name each actor goes by now. A snapshot already carries this; it is
   * fetched on its own for commands that print names without one. */
  actorNames(): Promise<ActorNames> {
    return this.request("GET", "/api/names");
  }

  /** Every slash command available here: built-ins under this home's own. */
  commands(): Promise<SlashCommand[]> {
    return this.request("GET", `/api/commands`);
  }

  /** Write one for this home. `text` is the file, frontmatter and all. */
  saveCommand(name: string, text: string): Promise<void> {
    return this.request("PUT", `/api/commands/${encodeURIComponent(name)}`, { text });
  }

  /** Remove one of this home's; the built-in of that name comes back. */
  deleteCommand(name: string): Promise<void> {
    return this.request("DELETE", `/api/commands/${encodeURIComponent(name)}`);
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
    // Blobs bypass `request` (raw bytes, no JSON), so they need the badge and
    // the recovery retry spelled out — easy to miss, and a 401 on an upload
    // would read as a broken drop.
    const send = async () =>
      fetch(`${this.base}/api/projects/${projectId}/blobs`, {
        method: "POST",
        headers: {
          ...(await this.authHeader()),
          "Content-Type": mimeType,
          [FILENAME_HEADER]: encodeFilename(filename),
        },
        body: new Uint8Array(data),
      });
    let res = await send();
    if (res.status === 401 && (await this.reBadge())) res = await send();
    const json = (await res.json().catch(() => null)) as any;
    if (!res.ok) throw new ApiError(res.status, json?.error ?? `HTTP ${res.status}`, json?.code);
    return json as BlobUploadResponse;
  }

  async downloadBlob(projectId: string, blobHash: string): Promise<Buffer> {
    const send = async () =>
      fetch(`${this.base}/api/projects/${projectId}/blobs/${blobHash}`, {
        headers: await this.authHeader(),
      });
    let res = await send();
    if (res.status === 401 && (await this.reBadge())) res = await send();
    if (!res.ok) throw new ApiError(res.status, `blob not found: ${blobHash}`);
    return Buffer.from(await res.arrayBuffer());
  }
}

/**
 * The `auth` block `identity.json` has stubbed since the beginning, filled
 * in. It sits beside the human's name because a machine's credential belongs
 * beside the machine's person — one badge per client home directory, holding
 * the human's claim and each of its agents'.
 */
async function readBadge(home: string, base: string): Promise<StoredBadge | null> {
  try {
    const raw = JSON.parse(await fs.readFile(paths.identityFile(home), "utf8")) as {
      auth?: Record<string, StoredBadge>;
    };
    const badge = raw.auth?.[base];
    return badge?.badgeId && badge.secret ? badge : null;
  } catch {
    return null;
  }
}

/** Read-merge, never clobber: `identity.json` also holds the human's name,
 * and a badge write that rewrote the file from scratch would delete it (and
 * the mirror bug — `isocan identity --name` deleting the badge — is why
 * `writeIdentity` merges too). */
async function writeBadge(home: string, base: string, badge: StoredBadge): Promise<void> {
  await fs.mkdir(home, { recursive: true });
  let current: Record<string, unknown> = {};
  try {
    current = JSON.parse(await fs.readFile(paths.identityFile(home), "utf8")) as Record<string, unknown>;
  } catch {
    // No identity yet: an agent-only machine gets a file holding just its
    // badge. `readIdentity` returns null without id/name, so nothing
    // mis-resolves.
  }
  const auth = { ...((current.auth as Record<string, StoredBadge>) ?? {}), [base]: badge };
  await fs.writeFile(paths.identityFile(home), JSON.stringify({ ...current, auth }, null, 2));
}
