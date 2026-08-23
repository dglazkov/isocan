import { Readable } from "node:stream";
import { WebSocket } from "ws";
import type {
  Actor,
  BlobUploadResponse,
  FreeNameResponse,
  GrantResponse,
  GrantsResponse,
  GrantSubject,
  LogEntry,
  MintPassResponse,
  PostOpRequest,
  PostOpResponse,
  PresenceSession,
  Project,
  RedeemPassResponse,
  ServerMessage,
  UndoRedoRequest,
} from "@isocan/core";
import {
  encodeFilename,
  FILENAME_HEADER,
  FREE_NAME_ROUTE,
  grantRoute,
  grantsRoute,
  healthPath,
  PASS_REDEEM_ROUTE,
  passesRoute,
  WS_NO_CANVAS,
} from "@isocan/core";
import type { Engine } from "./engine.ts";
import type { PresenceHub } from "./presence.ts";
import { bearerHeader, knockOnDoor, readBadge, writeBadge, type StoredBadge } from "./badge-store.ts";

/**
 * The home connection: what turns a local daemon into a **syncing replica**.
 *
 * A daemon with a home configured is a replica OF THAT HOME for every canvas
 * it holds — one home per daemon, a whole-daemon property, because phase 6's
 * Work says "the local daemon grows its home connection" in the singular
 * throughout. A canvas that is local-only while a home exists is offline
 * birth, which is phase 13's, and half-building it here would be worse than
 * not building it.
 *
 * What the connection carries is the journey's two planes (Scene 4's wiring):
 *
 * - **ops** — persisted, seq-numbered, and the home is the single writer of
 *   them. A local write is FORWARDED (see `HomeConnection` below) and comes
 *   back down this socket with the home's seq, which is written to the local
 *   store verbatim. Nothing here re-numbers anything: the demotion IS that the
 *   local engine stops assigning seqs.
 * - **presence** — ephemeral, relayed both ways, never written down.
 *   `PresenceHub.mirror` holds the far side's roster and `localRoster` is what
 *   goes up, so `isocan who` and a parked `isocan wait` on this machine see
 *   the whole canvas.
 *
 * And it reconnects by **seq cursor**: `?since=<local lastSeq>` per canvas,
 * which is Scene 4's lid-close beat from the daemon's end — the same handshake
 * the browser tab uses, which is the isomorphism thesis paying again.
 */

/** Between reconnect attempts. Fast enough that a dropped socket is invisible
 * to a person, backing off far enough that a home that is down does not get
 * hammered by every replica on the internet at once. */
const RECONNECT_MIN_MS = 250;
const RECONNECT_MAX_MS = 10_000;

/** How often the set of canvases to replicate is re-read from the home. See
 * `sync()` for why this is a poll and not a subscription. */
const DEFAULT_POLL_MS = 2000;

/** Presence beats are coalesced before they go up, exactly as `ws.ts`
 * coalesces roster broadcasts and for the same reason: a cursor stream would
 * otherwise put one WS frame on the wire per mouse move, per canvas. */
const RELAY_COALESCE_MS = 40;

/**
 * The home could not be reached at all.
 *
 * Loud and NOT queued. Holding a write until the home comes back is the
 * browser's offline queue (phase 10) and offline birth (phase 13); building
 * half of it here — an in-memory queue with no durability, no ordering story
 * against the home's own log, and no adoption path — is exactly the kind of
 * almost-working machinery those phases exist to do properly. So the seam is
 * here, named, and the failure is honest: an agent is told its write did not
 * happen, which is true, instead of being told it did.
 */
export class HomeUnreachableError extends Error {
  readonly code = "home-unreachable";
  constructor(homeUrl: string, cause: string) {
    super(
      `this daemon is a replica of ${homeUrl} and cannot reach it (${cause}) — ` +
        "the write was NOT made. Offline writes are queued in the browser " +
        "(phase 10) and at birth (phase 13); a replica's CLI writes are not.",
    );
    this.name = "HomeUnreachableError";
  }
}

/**
 * The home refused, and its answer is passed through unchanged.
 *
 * Status AND code both, deliberately: a replica is a pass-through, not a
 * re-interpreter. `writer-fenced` in particular must arrive at the caller as a
 * 409 with its own code, because the one thing a client must never do with it
 * is retry (see the architecture's deploy-overlap section) — and a replica
 * that flattened every refusal to 500 would turn "do not retry" into "try
 * again", once per replica, during every rollout.
 */
export class HomeRefusedError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "HomeRefusedError";
  }
}

/** What the engine and the routes need from the home. Narrow on purpose: the
 * engine learns "there is somewhere else to send this", never how a socket
 * works. */
export interface HomeConnection {
  readonly homeUrl: string;
  /** `POST /api/ops` at the home, with this daemon's badge. */
  submitOp(body: PostOpRequest): Promise<PostOpResponse>;
  undo(projectId: string, body: UndoRedoRequest): Promise<LogEntry>;
  redo(projectId: string, body: UndoRedoRequest): Promise<LogEntry>;
  /** Make this daemon's badge at the home vouch for an actor (and, when the
   * name has changed, tell the home the new one). */
  announceActor(actor: Actor): Promise<void>;
  /**
   * A name that is free AT THE HOME, in this daemon's badge's scope there.
   *
   * The one question a claim asks that a replica cannot answer for itself, and
   * therefore the one part of a claim that travels. `Engine.preferredName`
   * holds the reasoning; this end is a plain read.
   */
  freeName(): Promise<string>;
  /**
   * The grant routes, forwarded.
   *
   * A grant is desk state and desk state does not replicate — so unlike a
   * canvas, whose local copy is a real copy, the local rows on this machine
   * say only who on THIS machine may reach it. The row that decides who may
   * enter the canvas at all lives at the home, and a `isocan share` that
   * edited the laptop's ledger would report success while the link stayed on
   * for the world. These three go up for the same reason writes do.
   */
  grants(projectId: string): Promise<GrantsResponse>;
  createGrant(projectId: string, subject: GrantSubject): Promise<GrantResponse>;
  revokeGrant(projectId: string, grantId: string): Promise<GrantResponse>;
  /**
   * The pass routes, forwarded — for the grant routes' reason, one turn
   * sharper.
   *
   * A pass is desk state and desk state does not replicate, so the row lives
   * at the home. But a pass is also SINGLE-USE, and single-use is only a
   * property of the desk that holds the row: a replica that minted its own
   * passes would be handing out admissions to a canvas whose door it does not
   * answer, and one minted here and redeemed there would be spent twice.
   *
   * `actor` rather than an id, because the home may never have heard of this
   * actor: `mintPass` claims it onto this daemon's badge first (the home
   * verifies badge-level, which is all it can see), and bringing an actor in
   * from elsewhere needs its name.
   */
  mintPass(projectId: string, actor?: Actor): Promise<MintPassResponse>;
  redeemPass(token: string): Promise<RedeemPassResponse>;
  /** Blob bytes go where the ops that name them go. */
  putBlob(
    projectId: string,
    data: Buffer,
    meta: { mimeType: string; filename: string },
  ): Promise<BlobUploadResponse>;
  /** Bytes this replica has never seen, read straight from the home. Null when
   * the home does not have them either. */
  openBlob(
    projectId: string,
    blobHash: string,
    range?: { start: number; end: number },
  ): Promise<{ stream: Readable; mimeType: string; size: number } | null>;
}

/** What a canvas socket was told when it connected — the observable half of
 * the lid-close beat, so a test can assert a RESUME happened and not a
 * re-snapshot, which is the thing this phase is about. */
export interface HomeHello {
  projectId: string;
  type: "resumed" | "snapshot";
  /** The cursor we presented. */
  since: number;
  /** Where the home says we will be once its answer is applied. */
  lastSeq: number;
}

/**
 * Every handshake this canvas's socket has had, counted.
 *
 * Counted rather than merely remembered because the interesting question is
 * negative: "did this reconnect take the tail, and NOT a re-snapshot". A last-
 * hello field alone cannot answer it — a snapshot followed by a resume looks
 * like a resume — and a replica quietly falling back to a full re-snapshot on
 * every reconnect is exactly the regression that would make the seq cursor
 * decorative while every test still passed.
 */
export interface HomeHandshakes {
  resumed: number;
  snapshots: number;
  last: HomeHello | null;
}

export interface HomeLinkOptions {
  /** The address of the home — `https://isocan.io`. */
  homeUrl: string;
  /** This machine's isocan home directory: where the badge is kept, beside
   * the CLI's own, in `identity.json`'s `auth` block. */
  home: string;
  engine: Engine;
  presence: PresenceHub;
  /** How often to re-read the home's canvas list. Tests turn it down. */
  pollMs?: number;
}

interface CanvasLink {
  projectId: string;
  socket: WebSocket | null;
  /** Serializes message handling: applying an entry is async, and messages
   * arrive in an order that IS the contract (hello, then the tail, in order).
   * Without a chain, two `op-applied` handlers interleave and the second sees
   * a `lastSeq` the first has not written yet. */
  work: Promise<void>;
  retry: ReturnType<typeof setTimeout> | null;
  backoffMs: number;
  relay: ReturnType<typeof setTimeout> | null;
  closed: boolean;
}

export class HomeLink implements HomeConnection {
  readonly homeUrl: string;
  private readonly home: string;
  private readonly engine: Engine;
  private readonly presence: PresenceHub;
  private readonly pollMs: number;

  private badge: StoredBadge | null = null;
  private links = new Map<string, CanvasLink>();
  private poll: ReturnType<typeof setInterval> | null = null;
  private stopped = false;
  private syncing: Promise<void> | null = null;
  private handshakeLog = new Map<string, HomeHandshakes>();
  /** Cuts every in-flight request to the home when the daemon shuts down, so
   * closing does not wait out a 30-second timeout on a home that has gone. */
  private aborter = new AbortController();

  /**
   * Actors this daemon's badge has already been made to vouch for at the home.
   *
   * Mechanism 5, from the local end: each hop vouches for what only it can
   * see. This daemon verifies session-level (that client's `sessionKey`
   * claimed this actor HERE) and the home verifies badge-level (the op's actor
   * is among the presenting badge's claims) — so before this daemon speaks for
   * an actor at the home, that actor has to be on its one badge. Cached
   * exactly as `ws.ts` caches its per-socket `vouched` set, and for the same
   * measurement: presence beats arrive by the hundred under one unchanging
   * actor, and a desk round trip per beat is a desk round trip per mouse move.
   */
  private claimed = new Set<string>();
  private claiming = new Map<string, Promise<void>>();

  constructor(options: HomeLinkOptions) {
    this.homeUrl = options.homeUrl.replace(/\/+$/, "");
    this.home = options.home;
    this.engine = options.engine;
    this.presence = options.presence;
    this.pollMs = options.pollMs ?? DEFAULT_POLL_MS;
    // Local faces going up. Coalesced per canvas; see `scheduleRelay`.
    this.presence.onChange((projectId) => this.scheduleRelay(projectId));
    /**
     * A canvas this daemon now holds and is not listening to gets a socket at
     * once, rather than at the next poll.
     *
     * The case that forced it: a canvas born HERE. `bindFresh` forwards
     * `project.create`, the answer lands locally, and the CLI reads it straight
     * back — a canvas nothing is subscribed to would be a canvas that stops
     * updating for as long as the poll interval, on the machine that just made
     * it. Hanging this off the engine's own event is what removes the race:
     * the canvas exists locally by definition when this fires, so the dial can
     * present a real cursor instead of asking for a snapshot of the thing it
     * just wrote.
     */
    this.engine.onEvent((projectId, message) => {
      if (message.type !== "op-applied") return;
      if (this.stopped || this.links.has(projectId)) return;
      this.openCanvas(projectId);
    });
  }

  /** Open the connection and keep it open. Never throws: a home that is down
   * at boot must not stop a daemon from serving its local CLIs — the retry
   * loop is the whole point. */
  async start(): Promise<void> {
    await this.sync().catch(() => {});
    this.poll = setInterval(() => void this.sync().catch(() => {}), this.pollMs);
    this.poll.unref?.();
  }

  /**
   * Shut down with the daemon.
   *
   * Phase 4's finding paid for this once already: a socket left open is a
   * process that never exits. Every canvas socket is terminated, every timer
   * cleared, and the mirrored faces are dropped — because with the connection
   * gone, nobody on the other side of it is visibly here any more, and a
   * roster that went on showing them would be presence lying.
   */
  async close(): Promise<void> {
    this.stopped = true;
    this.aborter.abort();
    if (this.poll) clearInterval(this.poll);
    this.poll = null;
    const links = [...this.links.values()];
    this.links.clear();
    for (const link of links) this.closeLink(link);
    this.presence.dropMirror(this.origin());
    // Let any in-flight message handler finish writing before the store closes
    // under it — a half-applied entry is the one thing a shutdown must not
    // leave behind.
    await Promise.allSettled(links.map((link) => link.work));
  }

  /** The key this link's mirrored faces are held under. One home, one key. */
  private origin(): string {
    return `home:${this.homeUrl}`;
  }

  // ---- the canvas set ----

  /**
   * Which canvases this replica carries, re-read from both ends.
   *
   * A POLL rather than a subscription, and that is a real limitation rather
   * than a shrug: there is no home-wide socket — `/ws` is per canvas — so
   * "a canvas appeared at the home" has no event to ride on. Polling
   * `GET /api/projects` every couple of seconds is what makes Scene 0's last
   * line true ("her laptop and her desktop show the same canvas") without
   * inventing a home-wide channel this phase would then have to defend.
   *
   * **What this over-reaches, said out loud:** `GET /api/projects` is
   * home-wide today, not scoped to the badge's admissions, so on a shared home
   * a replica would mirror canvases it has no business holding. That narrowing
   * is mechanism 10's and phase 7's — the route, not this caller, is where it
   * belongs — and until it lands, a replica of a MULTI-TENANT home pulls down
   * more than it should. A solo home (Scene 0, and everything this phase
   * proves) has exactly one member, so today it is right.
   */
  private sync(): Promise<void> {
    if (this.stopped) return Promise.resolve();
    // One sweep at a time: two concurrent sweeps would race to open two
    // sockets for one canvas.
    if (this.syncing) return this.syncing;
    this.syncing = this.sweep().finally(() => {
      this.syncing = null;
    });
    return this.syncing;
  }

  private async sweep(): Promise<void> {
    const wanted = new Set<string>();
    for (const project of await this.engine.listProjects()) wanted.add(project.id);
    // The home's list is best-effort: a home that is down must not make a
    // replica forget the canvases it already holds.
    const theirs = await this.api<Project[]>("GET", "/api/projects").catch(() => null);
    if (theirs) for (const project of theirs) wanted.add(project.id);
    for (const projectId of wanted) {
      if (this.stopped) return;
      if (!this.links.has(projectId)) this.openCanvas(projectId);
    }
  }

  // ---- one canvas, one socket ----

  private openCanvas(projectId: string): void {
    const link: CanvasLink = {
      projectId,
      socket: null,
      work: Promise.resolve(),
      retry: null,
      backoffMs: RECONNECT_MIN_MS,
      relay: null,
      closed: false,
    };
    this.links.set(projectId, link);
    void this.dial(link);
  }

  private closeLink(link: CanvasLink): void {
    link.closed = true;
    if (link.retry) clearTimeout(link.retry);
    if (link.relay) clearTimeout(link.relay);
    link.retry = null;
    link.relay = null;
    const socket = link.socket;
    link.socket = null;
    socket?.terminate();
  }

  private reconnect(link: CanvasLink): void {
    if (this.stopped || link.closed || link.retry) return;
    const wait = link.backoffMs;
    link.backoffMs = Math.min(link.backoffMs * 2, RECONNECT_MAX_MS);
    link.retry = setTimeout(() => {
      link.retry = null;
      void this.dial(link);
    }, wait);
    link.retry.unref?.();
  }

  /**
   * Dial one canvas, presenting the cursor this replica actually holds.
   *
   * `since` is the LOCAL `lastSeq` — "I have through N", Scene 4's beat 7 in
   * one query parameter. A canvas this home has never seen sends 0 and gets a
   * snapshot, which is how a replica adopts a canvas somebody else made.
   *
   * A daemon is not a browser: the badge goes in `Authorization` as a bearer,
   * never a cookie. `ws.ts`'s Origin check deliberately exempts the bearer
   * carrier, because an attacker's page cannot read a bearer token and so has
   * nothing to ride.
   */
  private async dial(link: CanvasLink): Promise<void> {
    if (this.stopped || link.closed) return;
    const badge = await this.ensureBadge();
    if (!badge) return this.reconnect(link);
    const since = await this.localSeq(link.projectId);
    const wsBase = this.homeUrl.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
    const url = `${wsBase}/ws?projectId=${encodeURIComponent(link.projectId)}&since=${since}`;
    let socket: WebSocket;
    try {
      socket = new WebSocket(url, { headers: bearerHeader(badge) });
    } catch {
      return this.reconnect(link);
    }
    link.socket = socket;
    // Without a listener an abrupt death raises an unhandled 'error' event on
    // the EventEmitter and takes the daemon with it — the same reason `ws.ts`
    // installs one on every accepted socket.
    socket.on("error", () => {});
    socket.on("open", () => {
      link.backoffMs = RECONNECT_MIN_MS;
      this.scheduleRelay(link.projectId);
    });
    socket.on("message", (data) => {
      let message: ServerMessage;
      try {
        message = JSON.parse(String(data)) as ServerMessage;
      } catch {
        return;
      }
      link.work = link.work
        .then(() => this.receive(link, since, message))
        .catch(() => {});
    });
    socket.on("close", (code) => {
      if (link.socket !== socket) return; // superseded
      link.socket = null;
      this.presence.mirror(link.projectId, this.origin(), []);
      // 4404: the home says this canvas is not there. Stop dialling it — a
      // replica holding a canvas the home has never heard of is offline birth
      // (phase 13), and retrying forever would be a socket storm about a
      // canvas nobody can serve.
      if (code === WS_NO_CANVAS) {
        link.closed = true;
        this.links.delete(link.projectId);
        return;
      }
      this.reconnect(link);
    });
  }

  /**
   * The seq this replica actually holds for a canvas — 0 when it holds none of
   * it, which is what asks for a snapshot.
   *
   * `settled()` first, and it is not a nicety. A forwarded write holds the
   * single-writer chain across its round trip to the home, so a canvas can be
   * created AT THE HOME while this daemon is one line from writing it down.
   * Reading the store in that window answered "I have nothing" about a canvas
   * we were in the middle of making — the home dutifully sent a snapshot, and
   * the replica adopted it over the entry it was about to land, losing seq 1
   * from its own log. A cursor has to be a fact.
   */
  private async localSeq(projectId: string): Promise<number> {
    try {
      await this.engine.settled();
      return (await this.engine.getSnapshot(projectId)).lastSeq;
    } catch {
      return 0;
    }
  }

  /**
   * One message from the home, applied here.
   *
   * The two hellos are the two halves of one contract and a client must handle
   * either: `resumed` means "keep what you have, here comes the evening",
   * `snapshot` means "what you have cannot be caught up from my live log —
   * take this instead". Treating the fallback as a failure is the misreading
   * `protocol.ts` warns about.
   */
  private async receive(link: CanvasLink, since: number, message: ServerMessage): Promise<void> {
    const { projectId } = link;
    switch (message.type) {
      case "resumed":
        this.hello({ projectId, type: "resumed", since, lastSeq: message.lastSeq });
        await this.engine.mergeRemoteIdentity(message.colors, message.names);
        return;
      case "snapshot":
        this.hello({ projectId, type: "snapshot", since, lastSeq: message.lastSeq });
        await this.engine.adoptRemoteSnapshot(projectId, message);
        await this.engine.mergeRemoteIdentity(message.colors, message.names);
        return;
      case "op-applied": {
        const applied = await this.engine.applyRemote(projectId, message.entry);
        // A gap means an entry landed at the home that we never saw — the
        // socket dropped mid-tail, or a message was lost. Re-dialling with the
        // cursor we DO hold lets the home decide between a tail and a
        // snapshot, which is the one place that decision belongs.
        if (applied === "gap") this.resync(link);
        return;
      }
      case "project-deleted":
        await this.engine.applyRemoteDelete(projectId);
        link.closed = true;
        this.links.delete(projectId);
        this.closeLink(link);
        return;
      case "presence-roster": {
        // Our own relayed faces come back in the merged roster; taking them
        // as mirrored copies would double every face this machine puts up.
        const ours = new Set(
          this.presence.localRoster(projectId).map((session) => session.sessionId),
        );
        this.presence.mirror(
          projectId,
          this.origin(),
          message.sessions.filter((session) => !ours.has(session.sessionId)),
        );
        await this.engine.mergeRemoteIdentity(message.colors, message.names);
        return;
      }
    }
  }

  private hello(hello: HomeHello): void {
    const log = this.handshakeLog.get(hello.projectId) ?? {
      resumed: 0,
      snapshots: 0,
      last: null,
    };
    if (hello.type === "resumed") log.resumed += 1;
    else log.snapshots += 1;
    log.last = hello;
    this.handshakeLog.set(hello.projectId, log);
  }

  /** How this canvas's socket has been answered, every time it has connected.
   * Never absent for a canvas that has connected; zeroes for one that has
   * not. */
  handshakes(projectId: string): HomeHandshakes {
    return this.handshakeLog.get(projectId) ?? { resumed: 0, snapshots: 0, last: null };
  }

  private resync(link: CanvasLink): void {
    const socket = link.socket;
    link.socket = null;
    socket?.terminate();
    link.backoffMs = RECONNECT_MIN_MS;
    this.reconnect(link);
  }

  // ---- presence, going up ----

  private scheduleRelay(projectId: string): void {
    const link = this.links.get(projectId);
    if (!link || link.relay) return;
    link.relay = setTimeout(() => {
      link.relay = null;
      void this.relay(link).catch(() => {});
    }, RELAY_COALESCE_MS);
    link.relay.unref?.();
  }

  /**
   * This machine's faces, up to the home, in one message.
   *
   * One connection carrying several actors is exactly the case mechanism 1
   * drew the badge for — "Priya's daemon carries one connection on behalf of
   * her CLI self AND Isaac, so its badge must vouch for both" — so every actor
   * in the roster is claimed first. Skipping that is not a subtle failure: the
   * home runs `requireActor` on each relayed session and silently DROPS the
   * ones it cannot vouch for, which shows up as faces that never go up.
   */
  private async relay(link: CanvasLink): Promise<void> {
    const socket = link.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    const sessions = this.presence.localRoster(link.projectId);
    const vouched: PresenceSession[] = [];
    for (const session of sessions) {
      // Best effort per face: one actor the home will not vouch for must not
      // take the rest of the roster down with it.
      const ok = await this.ensureClaim(session.actor).then(
        () => true,
        () => false,
      );
      if (ok) vouched.push(session);
    }
    if (socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: "presence-relay", sessions: vouched }));
  }

  // ---- the badge, and the claims that ride on it ----

  private async ensureBadge(): Promise<StoredBadge | null> {
    if (this.badge) return this.badge;
    const stored = await readBadge(this.home, this.homeUrl);
    if (stored) {
      this.badge = stored;
      return stored;
    }
    return this.reBadge();
  }

  private async reBadge(): Promise<StoredBadge | null> {
    const badge = await knockOnDoor(this.homeUrl);
    if (!badge) return null;
    this.badge = badge;
    await writeBadge(this.home, this.homeUrl, badge);
    // A fresh badge claims NOBODY — the door mints an empty one. Forgetting
    // what the old badge vouched for is what makes the next `ensureClaim`
    // re-make the claim instead of trusting a cache about a credential that no
    // longer exists; without it, every forwarded write after a re-badge would
    // be refused `not-your-actor` forever.
    this.claimed.clear();
    return badge;
  }

  /**
   * Make this daemon's badge at the home vouch for one actor.
   *
   * **Where a local claim becomes a claim at the home**, and the choice is
   * `as` under a session key that belongs to the connection —
   * `replica:<actorId>` — rather than the local client's own key. Two reasons,
   * both mechanism 5's:
   *
   * - A `sessionKey` is "a client's local index for finding its own stored
   *   badge, never something the home trusts". The local keys are the LOCAL
   *   daemon's business — they are how it verifies session-level — and
   *   re-keying them at the home would be this hop claiming to see what only
   *   the hop below it can.
   * - `as` is the right verb because actor ids are global and travel untouched
   *   (mechanism 10, and offline-birth's "actor ids travel untouched"). The
   *   home must end up holding the SAME actor, not a namesake.
   *
   * The name rides along so the home can bring in an actor it has never heard
   * of: `reincarnate` refuses an unknown `as` with no name, and every actor
   * born on a replica is unknown at the home the first time.
   *
   * **The seam this leaves, named rather than smoothed:** if that actor is
   * already claimed at the home by ANOTHER badge within the last half hour —
   * most plausibly the same person's browser tab, which claimed them at the
   * one origin — the home refuses with `name-taken`, correctly, because two
   * badges holding one actor is what a PASS is for (mechanism 1's "Jordan's
   * tab and her daemon"). The refusal is surfaced with the home's own words
   * rather than swallowed.
   *
   * **Phase 8 built the pass, and the seam narrowed rather than closed** —
   * which is the design's answer, not a shortfall. A machine whose person is
   * already somebody at the home enrols by REDEEMING a pass minted from the
   * surface that is her (`redeemPass`, below); after that the home's badge
   * holds the claim outright and this call has nothing left to ask. What is
   * still refused is the thing that should be: announcing your way into an
   * identity somebody else is currently wearing, with nobody vouching. "First
   * surface versus every later surface of the same person" is exactly how
   * mechanism 1 puts it.
   */
  announceActor(actor: Actor): Promise<void> {
    return this.ensureClaim(actor).catch((err: unknown) => {
      // Said out loud, because a name collision AT THE HOME is exactly the
      // thing an agent would otherwise meet as a baffling refusal on its first
      // write — but not while shutting down. This call is deliberately
      // fire-and-forget (see `Engine.claim`), so it routinely outlives the
      // command that made it, and a daemon on its way out complaining that it
      // could not reach a home it is no longer connected to is noise about
      // nothing.
      if (this.stopped) return;
      console.error(
        `[isocan] the home would not vouch for ${actor.name} (${actor.id}): ` +
          (err as Error).message,
      );
    });
  }

  /**
   * "What name is free where this is going to land?"
   *
   * No claim goes up first, and there is nothing to cache: the answer is about
   * a namespace other machines are also writing to, and a remembered one would
   * be a reservation this link is in no position to hold. The engine treats
   * what comes back as a preference and re-checks it locally, so a stale answer
   * is cheap and an unreachable home costs nothing at all.
   */
  async freeName(): Promise<string> {
    const { name } = await this.api<FreeNameResponse>("GET", FREE_NAME_ROUTE);
    if (!name) throw new HomeRefusedError(200, "the home named no free name");
    return name;
  }

  private ensureClaim(actor: Actor): Promise<void> {
    // Keyed by id AND name, because a claim is also how somebody RENAMES
    // themselves. Keying on the id alone would let the first claim-up cache
    // the old name forever, and `mergeRemoteIdentity` would then push that
    // stale name back down over the new one every time a roster arrived — a
    // rename that undid itself a few milliseconds after it was made.
    const key = `${actor.id}\u0000${actor.name}`;
    if (this.claimed.has(key)) return Promise.resolve();
    const inflight = this.claiming.get(key);
    if (inflight) return inflight;
    const work = this.api<PostOpResponse>("POST", "/api/ops", {
      projectId: null,
      op: {
        type: "actor.claim",
        sessionKey: `replica:${actor.id}`,
        as: actor.id,
        name: actor.name,
      },
    })
      .then(() => {
        this.claimed.add(key);
      })
      .finally(() => {
        this.claiming.delete(key);
      });
    this.claiming.set(key, work);
    return work;
  }

  // ---- HomeConnection: writes, forwarded ----

  async submitOp(body: PostOpRequest): Promise<PostOpResponse> {
    if (body.actor) await this.ensureClaim(body.actor);
    return this.api<PostOpResponse>("POST", "/api/ops", body);
  }

  /** Who may enter this canvas, as the HOME has it. No claim goes up first:
   * a grant is about badges, never about actors. */
  grants(projectId: string): Promise<GrantsResponse> {
    return this.api<GrantsResponse>("GET", grantsRoute(projectId));
  }

  createGrant(projectId: string, subject: GrantSubject): Promise<GrantResponse> {
    return this.api<GrantResponse>("POST", grantsRoute(projectId), { subject });
  }

  revokeGrant(projectId: string, grantId: string): Promise<GrantResponse> {
    return this.api<GrantResponse>("DELETE", grantRoute(projectId, grantId));
  }

  /**
   * Mint a pass at the home, on this daemon's badge.
   *
   * The claim goes up first, exactly as it does before a forwarded write: the
   * home refuses to endow a pass with an actor the presenting badge does not
   * hold, and the badge that presents here is this daemon's one badge at the
   * home rather than the local CLI's. That is mechanism 5's split doing its
   * job — the local daemon already checked that the asking process may speak
   * as this actor, which the home could never know, and the home checks that
   * this machine may, which is all it can honestly see.
   */
  async mintPass(projectId: string, actor?: Actor): Promise<MintPassResponse> {
    if (actor) await this.ensureClaim(actor);
    return this.api<MintPassResponse>(
      "POST",
      passesRoute(projectId),
      actor ? { actorId: actor.id } : {},
    );
  }

  /**
   * Redeem one at the home, on this daemon's badge — the enrolling half of
   * Scene 5, from the new machine's end.
   *
   * Two things happen here that are easy to miss, and both are the point:
   *
   * - **This badge comes back admitted at the home**, so the canvas now
   *   appears in `GET /api/projects` for it and the next sweep dials it. That
   *   is how a replica stops discovering canvases by enumerating a home and
   *   starts replicating the ones it was actually let into — phase 7's open
   *   question, answered by the mechanism phase 7 said would answer it.
   * - **The vouch cache is primed rather than left to be discovered.** The
   *   home has just written this actor onto this badge's claims, so
   *   `ensureClaim` has nothing to do; without priming it, the first forwarded
   *   write would spend a round trip re-claiming an actor the badge already
   *   holds. (It would also *succeed* — `reincarnate` lets a badge re-key an
   *   actor it already claims, which phase 8 had to make true anyway, because
   *   after a pass there are legitimately two badges holding one actor and the
   *   other one is a live tab.) A re-badge clears this cache along with
   *   everything else, which is correct: a badge that had to go back to the
   *   door is a different holder, and it holds nothing.
   *
   * A sweep is kicked immediately rather than waiting out the poll interval:
   * the person at the terminal has just typed the enrolling command, and the
   * next thing they expect is their canvas.
   */
  async redeemPass(token: string): Promise<RedeemPassResponse> {
    const answer = await this.api<RedeemPassResponse>("POST", PASS_REDEEM_ROUTE, { token });
    if (answer.actor) this.claimed.add(`${answer.actor.id}\u0000${answer.actor.name}`);
    void this.sync().catch(() => {});
    return answer;
  }

  async undo(projectId: string, body: UndoRedoRequest): Promise<LogEntry> {
    await this.ensureClaim(body.actor);
    return this.api<LogEntry>("POST", `/api/projects/${projectId}/undo`, body);
  }

  async redo(projectId: string, body: UndoRedoRequest): Promise<LogEntry> {
    await this.ensureClaim(body.actor);
    return this.api<LogEntry>("POST", `/api/projects/${projectId}/redo`, body);
  }

  /**
   * Bytes follow the ops that name them.
   *
   * A blob is not an `Operation` — but `item.add` carries a `blobHash`, and an
   * op whose bytes stayed on one laptop is an item that renders as a broken
   * version everywhere else, including in the browser tab that is the whole
   * point of having a home. So an upload on a replica goes to the home FIRST
   * (it is the authority, and its refusal is the one that matters) and the
   * local store keeps its own copy after — Scene 4's "and in Priya's
   * `~/.isocan` by hash" is the local half, and it is not optional either: an
   * agent's hands are the filesystem.
   */
  async putBlob(
    projectId: string,
    data: Buffer,
    meta: { mimeType: string; filename: string },
  ): Promise<BlobUploadResponse> {
    const badge = await this.ensureBadge();
    if (!badge) throw new HomeUnreachableError(this.homeUrl, "no badge");
    const send = async (held: StoredBadge) =>
      this.fetchHome(`/api/projects/${projectId}/blobs`, {
        method: "POST",
        headers: {
          ...bearerHeader(held),
          "Content-Type": meta.mimeType,
          [FILENAME_HEADER]: encodeFilename(meta.filename),
        },
        body: new Uint8Array(data),
      });
    let res = await send(badge);
    if (res.status === 401) {
      const fresh = await this.reBadge();
      if (fresh) res = await send(fresh);
    }
    const json = (await res.json().catch(() => null)) as
      | (BlobUploadResponse & { error?: string; code?: string })
      | null;
    if (!res.ok) {
      throw new HomeRefusedError(res.status, json?.error ?? `HTTP ${res.status}`, json?.code);
    }
    return json as BlobUploadResponse;
  }

  /** Bytes this replica has never held, streamed from the home. What makes an
   * item somebody else added on another machine openable here. */
  async openBlob(
    projectId: string,
    blobHash: string,
    range?: { start: number; end: number },
  ): Promise<{ stream: Readable; mimeType: string; size: number } | null> {
    const badge = await this.ensureBadge();
    if (!badge) return null;
    const headers: Record<string, string> = { ...bearerHeader(badge) };
    if (range) headers.Range = `bytes=${range.start}-${range.end}`;
    let res: Response;
    try {
      res = await this.fetchHome(`/api/projects/${projectId}/blobs/${blobHash}`, { headers });
    } catch {
      return null;
    }
    if (!res.ok || !res.body) return null;
    const size = Number(res.headers.get("content-length") ?? "0");
    return {
      stream: Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]),
      mimeType: res.headers.get("content-type") ?? "application/octet-stream",
      size,
    };
  }

  // ---- the plumbing under all of the above ----

  /**
   * One JSON call at the home, with the badge, healing a 401 exactly once.
   *
   * The recovery is `DaemonClient`'s in shape and deliberately not shared with
   * it: what a holder DOES about a refusal is policy (the CLI re-claims the
   * identity the command speaks as; this re-claims everyone the daemon relays
   * for), while what a badge IS and where it is kept is mechanism — and it is
   * the mechanism that lives in one place, `badge-store.ts`, because two
   * answers to "which credential is in that file" on one machine is the
   * divergence house rule 4 forbids.
   */
  private async api<T>(method: string, path: string, body?: unknown): Promise<T> {
    const badge = await this.ensureBadge();
    if (!badge) throw new HomeUnreachableError(this.homeUrl, "the door did not answer");
    const send = async (held: StoredBadge) =>
      this.fetchHome(path, {
        method,
        headers: {
          ...bearerHeader(held),
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
    let res = await send(badge);
    if (res.status === 401) {
      const fresh = await this.reBadge();
      if (fresh) res = await send(fresh);
    }
    const json = (await res.json().catch(() => null)) as
      | { error?: string; code?: string }
      | null;
    if (!res.ok) {
      throw new HomeRefusedError(res.status, json?.error ?? `HTTP ${res.status}`, json?.code);
    }
    return json as T;
  }

  /**
   * Every HTTP call to the home goes through here, so "the home is down" has
   * one spelling and one message naming the address.
   *
   * Two signals, not one: the timeout, and this link's own shutdown. A daemon
   * closing while a forwarded write is in flight would otherwise wait out the
   * full timeout before its process could exit — the same class of "a socket
   * left open is a process that never exits" that phase 4 paid for once.
   */
  private async fetchHome(path: string, init: RequestInit): Promise<Response> {
    try {
      return await fetch(`${this.homeUrl}${path}`, {
        ...init,
        signal: AbortSignal.any([this.aborter.signal, AbortSignal.timeout(30_000)]),
      });
    } catch (err) {
      throw new HomeUnreachableError(this.homeUrl, (err as Error).message);
    }
  }

  /** Is the home answering at all? Uses `healthPath`, never a literal: against
   * a hosted home the bare `/healthz` is swallowed by Google's frontend and a
   * live home reads as dead (phase 5's finding). */
  async reachable(timeoutMs = 2000): Promise<boolean> {
    try {
      const res = await fetch(`${this.homeUrl}${healthPath(this.homeUrl)}`, {
        signal: AbortSignal.timeout(timeoutMs),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
