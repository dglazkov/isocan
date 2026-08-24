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
  GrantResponse,
  GrantsResponse,
  GrantSubject,
  JoinCanvasRequest,
  JoinCanvasResponse,
  LogEntry,
  MintPassResponse,
  Operation,
  PostOpResponse,
  PresenceSession,
  Project,
  RedeemPassResponse,
  UpdateSessionRequest,
  WatchLogRequest,
  WatchLogResponse,
  ActorNames,
  SlashCommand,
} from "@isocan/core";
import {
  encodeFilename,
  FILENAME_HEADER,
  grantRoute,
  grantsRoute,
  healthPath,
  HOME_JOIN_ROUTE,
  PASS_REDEEM_ROUTE,
  passesRoute,
} from "@isocan/core";
import type { BuildStamp, StoredBadge } from "@isocan/server";
import { bearerHeader, knockOnDoor, paths, readBadge, writeBadge } from "@isocan/server";

/** The health route: who is holding the port, and which build they are. */
export interface Health extends Partial<BuildStamp> {
  ok: true;
  pid: number;
  startedAt: string;
  /** The home this daemon is a REPLICA of, when it is one. Absent means the
   * daemon IS a home — every daemon before phase 6, and every daemon nobody
   * has configured. The CLI reads it to know where the pages are: a replica
   * serves none, so `isocan open` and `setup` must point at this address
   * instead of at `127.0.0.1`. */
  home?: string;
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

export class DaemonClient {
  /** Loaded once per process, from `identity.json`'s `auth` block. */
  private badge: StoredBadge | null | undefined;

  /**
   * How to make the home vouch for whoever this command speaks as: claim the
   * actor under the session key it belongs to. Registered by
   * `resolveIdentity` — knowing who you are is knowing how to prove it.
   *
   * Two refusals need it, and they are the two landmines mechanism 5 laid:
   *
   * - **401.** The door mints a badge whose claims are EMPTY, and the request
   *   about to be replayed asserts an actor. Re-claim, then replay.
   * - **`not-your-actor`.** The home identity in `~/.isocan/identity.json` is
   *   a local file that nothing ever claimed — so the first time a machine
   *   speaks for its person, the home has never heard the claim. Making it on
   *   demand is what turns "refused, for every solo human at once" into one
   *   extra round trip, once per badge, that nobody sees.
   */
  private reclaim: (() => Promise<void>) | null = null;
  private reclaiming = false;

  constructor(
    readonly base: string,
    readonly home: string,
  ) {}

  /**
   * Every request carries the badge, and a refused one heals itself and comes
   * straight back. This is what makes neither the door nor the membership
   * check a breaking change: a CLI that has never seen a badge, whose home was
   * wiped, or whose person the home has never been told about, recovers in one
   * extra round trip with nobody told anything.
   *
   * Exactly one recovery per request, and never a loop: a 401 goes to the
   * door (which re-claims on the way back), and a `not-your-actor` claims.
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
    let json = (await res.json().catch(() => null)) as any;
    const recovered =
      res.status === 401
        ? await this.reBadge()
        : json?.code === "not-your-actor" && (await this.reclaimIdentity());
    if (recovered) {
      res = await send();
      json = (await res.json().catch(() => null)) as any;
    }
    if (!res.ok) {
      throw new ApiError(res.status, json?.error ?? `HTTP ${res.status}`, json?.code);
    }
    return json as T;
  }

  /** `Authorization: Bearer <badgeId>.<secret>`, when we hold one. */
  private async authHeader(): Promise<Record<string, string>> {
    const badge = await this.storedBadge();
    return badge ? bearerHeader(badge) : {};
  }

  private async storedBadge(): Promise<StoredBadge | null> {
    if (this.badge === undefined) this.badge = await readBadge(this.home, this.base);
    return this.badge;
  }

  /** Go to the door and keep what it hands over. Returns false if the door
   * itself refused, so a caller does not loop. */
  private async reBadge(): Promise<boolean> {
    const badge = await knockOnDoor(this.base);
    if (!badge) return false;
    this.badge = badge;
    await writeBadge(this.home, this.base, badge);
    // Re-claim, THEN replay. Without this the recovery path is a 401
    // followed by a `not-your-actor`: the door mints a badge whose claims
    // are empty while the client goes on asserting the actor it has held
    // all along.
    await this.reclaimIdentity();
    return true;
  }

  /** How to prove who this command speaks as, if the home asks. Registered by
   * `resolveIdentity` the moment that is known. */
  reclaimWith(reclaim: () => Promise<void>): void {
    this.reclaim = reclaim;
  }

  /** Claim the identity this command speaks as. False when there is nothing
   * to claim or the home refused, so a caller does not replay into the same
   * refusal twice. The guard is against the claim's OWN request coming back
   * around here. */
  private async reclaimIdentity(): Promise<boolean> {
    if (!this.reclaim || this.reclaiming) return false;
    this.reclaiming = true;
    try {
      await this.reclaim();
      return true;
    } catch {
      // The actor is somebody else's now, or the name collides. The replay's
      // refusal says so in the caller's own words rather than this one's.
      return false;
    } finally {
      this.reclaiming = false;
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
   * copy of isocan it is running. Null when nothing answers.
   *
   * The path is a property of `this.base`, not a constant: against 127.0.0.1
   * it is `/healthz` as it has always been, and against a hosted home it is
   * `/api/healthz`, because Google's frontend swallows the bare path and this
   * one call sits under `health()`, `ensureDaemon`'s startup poll and
   * `warnIfStale` — all three of which would otherwise report a live home as
   * dead. See `healthPath`. */
  async healthz(timeoutMs = 300): Promise<Health | null> {
    try {
      const res = await fetch(`${this.base}${healthPath(this.base)}`, {
        signal: AbortSignal.timeout(timeoutMs),
      });
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

  // ---- who may enter a canvas: `isocan share`'s three calls ----
  //
  // The same three routes the Share dialog drives, built from the same core
  // helpers — house rule 2's "button and verb, one endpoint", taken literally
  // enough that neither surface spells a URL. On a replica the daemon forwards
  // all three to the home, because the row that decides who may enter lives
  // there; nothing here has to know that.

  grants(projectId: string): Promise<GrantsResponse> {
    return this.request("GET", grantsRoute(projectId));
  }

  createGrant(projectId: string, subject: GrantSubject): Promise<GrantResponse> {
    return this.request("POST", grantsRoute(projectId), { subject });
  }

  /** No body, deliberately: a DELETE that declares `application/json` and
   * sends nothing is a Fastify parse error, and a request with nothing to say
   * should not announce a content type. */
  revokeGrant(projectId: string, grantId: string): Promise<GrantResponse> {
    return this.request("DELETE", grantRoute(projectId, grantId));
  }

  // ---- passes: the escalation credential (Scene 5) ----
  //
  // Two routes, deliberately different shapes, and the CLI does not get to
  // decide which: `passesRoute` is project-scoped so the door has already
  // asked whether this badge may mint for this canvas, and `PASS_REDEEM_ROUTE`
  // is flat because the redeemer is BY DEFINITION not admitted yet. Both
  // spellings come from `@isocan/core`, like the grant routes above and for
  // the same reason — stage 3's dialog drives the identical pair.
  //
  // On a replica both forward to the home. That is not an optimization: a pass
  // is desk state, single-use is only single across the desk that holds the
  // row, and the badge a redeemed pass endows has to be the one the HOME will
  // see presented. Nothing here has to know that, which is the point.

  /** Mint one for this canvas. `actorId` endows the claim; omitting it mints
   * the admission-only shape. The token comes back exactly once. */
  mintPass(projectId: string, actorId?: string): Promise<MintPassResponse> {
    return this.request("POST", passesRoute(projectId), actorId ? { actorId } : {});
  }

  /**
   * Redeem one: this daemon's badge comes away admitted at the home and, when
   * the pass named a claim, holding it.
   *
   * **The answer is the only announcement there will ever be.** The handoff
   * row carries no session key by design, and `GET /api/actors` is keyed by
   * session key — so a caller that throws this response away cannot ask for
   * it again, and the identity the pass endowed becomes unreachable from this
   * machine even though the badge still holds it. `isocan setup` writes it
   * into `identity.json` for exactly that reason.
   */
  redeemPass(token: string): Promise<RedeemPassResponse> {
    return this.request("POST", PASS_REDEEM_ROUTE, { token });
  }

  /**
   * Ask this daemon to fetch one canvas from its home — the arrival that
   * carries an ADDRESS and no admission (a cloned marker, a pass-less
   * `setup`). `HOME_JOIN_ROUTE` in core carries the reasoning.
   *
   * Refuses `not-a-replica` (409) on a home, which is a fine answer to get:
   * callers that ask speculatively — binding resolution does — carry on and
   * report whatever they were going to report anyway.
   */
  async joinFromHome(projectId: string): Promise<Project> {
    const { project } = await this.request<JoinCanvasResponse>("POST", HOME_JOIN_ROUTE, {
      projectId,
    } satisfies JoinCanvasRequest);
    return project;
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
