import { Readable } from "node:stream";
import { WebSocket } from "ws";
import type {
  Actor,
  AttestOffer,
  AttestRequest,
  AttestResponse,
  BadgesResponse,
  BlobUploadResponse,
  Capability,
  CanvasLinkState,
  FreeNameResponse,
  GrantResponse,
  GrantsResponse,
  GrantSubject,
  KillBadgeResponse,
  LogEntry,
  MintPassResponse,
  PostOpRequest,
  PostOpResponse,
  PresenceSession,
  Canvas,
  RedeemPassResponse,
  ServerMessage,
  SpaceCanvasResponse,
  SpaceLinkRequest,
  SpaceLinkResponse,
  SpaceResponse,
  SpacesResponse,
  GroupResponse,
  GroupsResponse,
  UndoRedoRequest,
} from "@isocan/core";
import {
  ATTEST_ROUTE,
  narrowed,
  groupActingRoute,
  groupMemberRoute,
  groupRoute,
  GROUPS_ROUTE,
  spaceActingRoute,
  spaceCanvasRoute,
  spaceGrantRevokeRoute,
  spaceGrantsRoute,
  spaceLinkRoute,
  spaceRoute,
  SPACES_ROUTE,
  BADGES_ROUTE,
  badgeRoute,
  encodeFilename,
  FILENAME_HEADER,
  FREE_NAME_ROUTE,
  grantRevokeRoute,
  grantsRoute,
  healthPath,
  normalizeHomeUrl,
  PASS_REDEEM_ROUTE,
  passesRoute,
  canvasesRoute,
  WS_BEHIND,
  WS_NO_CANVAS,
  WS_NOT_ADMITTED,
  WITHDRAWN,
} from "@isocan/core";
import type { Engine } from "./engine.ts";
import type { PresenceHub } from "./presence.ts";
import { bearerHeader, knockOnDoor, readBadge, writeBadge, type StoredBadge } from "./badge-store.ts";
import { plausibleSha, type HomeBuild } from "./build.ts";
import type { RcHolds } from "./rc-holds.ts";

/**
 * The home connection: what turns a local daemon into a **syncing replica**.
 *
 * **One link per home, not one per daemon** (phase 10.3). Phase 6 built this
 * in the singular — "the local daemon grows its home connection" — and phase
 * 10.3 found that the singular was never a property of the daemon at all: the
 * home is a property of the CANVAS, which the `.isocan/project.json` marker
 * has asserted since Scene 0 by carrying an address. So a daemon is now the
 * home of some canvases and a replica for others, holding one of these per
 * distinct address, and `HomeLinks` (`home-links.ts`) is the registry that
 * owns them. What each link does is unchanged; what changed is that it does it
 * for **the canvases `homes.json` assigns to it**, and no others — see
 * `sweep()`, which is the phase's central change and a data-loss fix.
 *
 * A canvas that is local-only while its own home exists is still offline birth,
 * which is phase 13's, and half-building it here would still be worse than not
 * building it.
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

/**
 * **How often a link re-asks its home which build it is** (auto-upgrade
 * phase 2).
 *
 * An hour, and deliberately nowhere near the poll. `DEFAULT_POLL_MS` is 2000,
 * so riding the sweep would be 1,800 requests an hour for an answer that
 * changes about twice a day. The other half of the schedule is the one that
 * makes an hour tolerable: a link that starts answering again re-asks at once,
 * so a laptop that opened its lid does not wait out the interval.
 */
const BUILD_PROBE_MS = 60 * 60 * 1000;

/** The build probe's own timeout. Short, because nothing waits on the answer:
 * a home that is slow to say which build it is simply has not said yet, and
 * the next probe asks again. */
const BUILD_PROBE_TIMEOUT_MS = 5000;

/** Presence beats are coalesced before they go up, exactly as `ws.ts`
 * coalesces roster broadcasts and for the same reason: a cursor stream would
 * otherwise put one WS frame on the wire per mouse move, per canvas. */
const RELAY_COALESCE_MS = 40;

/**
 * **How many failed dials in a row before a canvas link says so out loud.**
 *
 * Not one: a socket dropping and coming back is ordinary — a home redeploying,
 * a laptop changing networks — and a line per blip would train everybody to
 * ignore the line. Three consecutive failures with the backoff between them is
 * ten seconds of a canvas whose presence and incoming ops are not moving, and
 * that is worth a sentence.
 */
const COMPLAIN_AFTER_FAILURES = 3;

/**
 * **How long a dial may sit unfinished before the sweep treats it as stuck.**
 *
 * `dial()` awaits two things before it ever reaches `new WebSocket` — the
 * badge, and `localSeq`, which awaits the engine's writer chain. Neither is
 * bounded by this link. A dial that never finishes leaves a link in the map
 * with no socket and no retry timer, which every other repair path reads as
 * "somebody is on it" — the exact shape of a canvas that is silently never
 * connected. Past this, the sweep dials again and the older attempt is
 * superseded (`dialSeq`).
 */
const DIAL_STUCK_MS = 30_000;

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
    // **Which home**, since phase 10.3, and the wording changed with it: it
    // used to open "this daemon is a replica of X", which was true when a
    // daemon had one home and is now a sentence about the wrong subject. This
    // canvas lives at X; other canvases on this machine live elsewhere or
    // right here, and they are still taking writes. On a machine with three
    // homes, "the home is unreachable" is unanswerable.
    super(
      `that canvas lives at ${homeUrl}, and this daemon cannot reach it (${cause}) — ` +
        "the write was NOT made. Canvases whose home is elsewhere (or here) are " +
        "unaffected. Offline writes are queued in the browser (phase 10) and at " +
        "birth (phase 13); a replica's CLI writes are not.",
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
  undo(canvasId: string, body: UndoRedoRequest): Promise<LogEntry>;
  redo(canvasId: string, body: UndoRedoRequest): Promise<LogEntry>;
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
   *
   * A WRITE names the person acting (roles design, "Over a replica, the
   * write names the person"): this daemon's badge at the home claims everyone
   * it has relayed, and `own` is held by a person, so the home is told which
   * one — after the claim goes up, as it does before a forwarded op.
   */
  grants(canvasId: string): Promise<GrantsResponse>;
  createGrant(
    canvasId: string,
    subject: GrantSubject,
    capability?: Capability,
    actor?: Actor,
    /** A bar rather than an invitation (roles phase 3): carried up as
     * `bars: true`, the way the rung is carried only when it narrows. */
    bars?: boolean,
  ): Promise<GrantResponse>;
  /** `bar` is the DELETE's `?bar=1` — revoke and keep them out, one request
   * at the home, so the sweep that expels them meets the bar. */
  revokeGrant(canvasId: string, grantId: string, actor?: Actor, bar?: boolean): Promise<GrantResponse>;
  /**
   * Your surfaces at the HOME, and ending one there — forwarded for the grant
   * routes' reason, arriving at the machine it is most obviously about.
   *
   * A stolen laptop holds two badges: one at its own daemon and one at the
   * home. Killing the local one accomplishes nothing anybody cares about —
   * the thief has the whole machine, and a local desk is not a boundary
   * against somebody sitting at the keyboard. What stops the laptop is that
   * its badge AT THE HOME is ended: ops are refused, replication goes stale,
   * and the copy on its disk is a snapshot instead of a canvas.
   *
   * `grants.ts` has said since phase 7 that this is what the local ledger's
   * deliberate non-inheritance of revocation rests on — *"what actually stops
   * that laptop is that its badge is expelled at the home and replication
   * stops"*. This is the verb that does it.
   */
  badges(): Promise<BadgesResponse>;
  killBadge(badgeId: string): Promise<KillBadgeResponse>;
  /**
   * The space routes, forwarded (roles phase 4) — for the grant routes'
   * reason, because a space is part of what a grant means: it is desk state
   * at the home, and a laptop holds no row for it. Every write carries the
   * actor acting, as a grant write does, so the home asks `own` of the person
   * and not of the machine.
   */
  spaces(): Promise<SpacesResponse>;
  createSpace(name: string, actor?: Actor): Promise<SpaceResponse>;
  deleteSpace(spaceId: string, actor?: Actor): Promise<SpaceCanvasResponse>;
  addToSpace(spaceId: string, canvasId: string, actor?: Actor): Promise<SpaceCanvasResponse>;
  removeFromSpace(spaceId: string, canvasId: string, actor?: Actor): Promise<SpaceCanvasResponse>;
  spaceGrants(spaceId: string): Promise<GrantsResponse>;
  createSpaceGrant(
    spaceId: string,
    subject: GrantSubject,
    capability?: Capability,
    actor?: Actor,
    bars?: boolean,
  ): Promise<GrantResponse>;
  revokeSpaceGrant(spaceId: string, grantId: string, actor?: Actor, bar?: boolean): Promise<GrantResponse>;
  setSpaceLink(spaceId: string, capability: SpaceLinkRequest["capability"], actor?: Actor): Promise<SpaceLinkResponse>;
  /** The group routes, forwarded (roles phase 5), for the space routes'
   * reason. Every write carries the actor acting. */
  groups(): Promise<GroupsResponse>;
  createGroup(name: string, actor?: Actor): Promise<GroupResponse>;
  group(groupId: string): Promise<GroupResponse>;
  addGroupMember(groupId: string, attribute: string, actor?: Actor): Promise<GroupResponse>;
  removeGroupMember(groupId: string, attribute: string, actor?: Actor): Promise<GroupResponse>;
  deleteGroup(groupId: string, actor?: Actor): Promise<GroupResponse>;
  /**
   * The attest routes, forwarded — for the badge routes' reason, and it is the
   * same sentence one word further on.
   *
   * An attestation rides a BADGE, and a laptop holds two of them: one at its
   * own daemon and one at the home. The door that reads attestations is the
   * home's, so a proof written into the local desk would have convinced the
   * only party that was already trusting this machine, while the home went on
   * refusing. What the local ledger is for is who on THIS machine may reach
   * the local copy; who may enter the canvas is the home's row and the home's
   * badge.
   */
  attestOffer(): Promise<AttestOffer>;
  attest(body: AttestRequest): Promise<AttestResponse>;
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
  mintPass(canvasId: string, actor?: Actor): Promise<MintPassResponse>;
  redeemPass(token: string): Promise<RedeemPassResponse>;
  /**
   * Ask the home for ONE canvas by name, so this replica starts carrying it.
   *
   * The counterpart of the sweep's narrowing (`sync()`): the sweep asks "what
   * was I let into", and this is how a machine that was handed nothing but an
   * ADDRESS gets let in. See `HOME_JOIN_ROUTE` for which arrivals those are
   * and why they are not a new privilege.
   */
  join(canvasId: string): Promise<Canvas>;
  /** Blob bytes go where the ops that name them go. */
  putBlob(
    canvasId: string,
    data: Buffer,
    meta: { mimeType: string; filename: string },
  ): Promise<BlobUploadResponse>;
  /**
   * Does the home hold these bytes? A HEAD — no body, no stream to drain.
   *
   * The question nothing could ask before, which is why bytes could fall
   * behind the ops that name them and stay behind forever: a teammate saw the
   * item and "blob not found" underneath it, and no command on either machine
   * could tell you that was the shape of the problem.
   *
   * Null means the home could not be reached — deliberately not `false`,
   * because "it is not there" and "I could not ask" are different answers and
   * only one of them means push.
   */
  hasBlob(canvasId: string, blobHash: string): Promise<boolean | null>;
  /** Hand this home a canvas whole — its log, verbatim. The receiving half of
   *  a teleport; see `Engine.adopt` for why it is not a replay of ops. */
  adopt(canvasId: string, entries: readonly LogEntry[]): Promise<{ seqs: number }>;
  /** Bytes this replica has never seen, read straight from the home. Null when
   * the home does not have them either. */
  openBlob(
    canvasId: string,
    blobHash: string,
    range?: { start: number; end: number },
  ): Promise<{ stream: Readable; mimeType: string; size: number } | null>;
}

/**
 * **What the engine needs when there is more than one home** (phase 10.3).
 *
 * The engine used to hold a single `HomeConnection | null`, and that one field
 * WAS the demotion: set it and the daemon stops assigning seqs. Under many
 * homes the demotion is per canvas, so the field becomes a lookup — but not a
 * bigger one than it has to be. Three questions, because there turn out to be
 * exactly three kinds of act:
 *
 * - **canvas-scoped** (a write, a blob, an undo): `for(canvasId)`.
 * - **home-scoped** (a colour, an actor announcement): `all()`, because the
 *   actors log lives at each home and never replicates down, so telling one
 *   home leaves the other wrong forever.
 * - **not yet about any canvas** (a nameless claim, a birth naming nothing):
 *   `birth()`, the home this machine's NEXT canvas goes to.
 *
 * The engine is handed this rather than the registry itself so it still learns
 * "there is somewhere else to send this" and never how a link is opened,
 * closed, or written down — the same narrowness `HomeConnection` has always
 * had.
 */
export interface HomeDirectory {
  /** The connection this canvas's writes go to; null when this daemon is its
   * home. */
  for(canvasId: string): HomeConnection | null;
  /** Every open link — for the acts that are home-scoped rather than
   * canvas-scoped. */
  all(): readonly HomeConnection[];
  /** A link to an address, opened if this daemon has not dialled it before.
   *  For the acts that name a home rather than inheriting one — teleport
   *  names where a canvas is going. */
  linkFor(homeUrl: string): HomeConnection;
  /** Where a canvas born now, naming nothing, would live. */
  birth(): HomeConnection | null;
  /**
   * **A canvas is being born here: record where it lives, and hand back the
   * connection its writes go to.**
   *
   * Beyond the three questions above because a birth is the one moment a row
   * is CREATED rather than consulted, and `submit` is where a `project.create`
   * passes through. `homeUrl` is the address stated in the request (the
   * marker's assertion, ridden up beside the op), or null to let the birth
   * default decide.
   *
   * **It always writes a row, `null` included.** An explicit null is not
   * cosmetic: it is what stops a link's sweep later claiming a locally-born
   * canvas under the "this id has no row, so it must be mine" rule.
   */
  bind(canvasId: string, homeUrl: string | null): Promise<HomeConnection | null>;
  /** That canvas is gone; drop its row, or a re-created id inherits a dead
   * routing. */
  release(canvasId: string): Promise<void>;
}

/**
 * What one link needs to know from the registry that owns it — the sweep's
 * half of `homes.json`.
 *
 * An interface rather than a direct reference to `HomeLinks` so the dependency
 * runs one way: the registry knows about its links, and a link knows only that
 * something can answer two questions about assignments. It is also what lets a
 * test drive `sweep()` with a hand-written record.
 */
export interface HomeRegistry {
  /** The canvas ids this record assigns to this address, and nothing else.
   * The local half of the sweep. */
  idsFor(homeUrl: string): string[];
  /**
   * The home offered this canvas: may this link dial it?
   *
   * The arbitration rule, in the one place it can be applied consistently —
   * see `HomeLinks.mayDial` for the three branches and why the third one logs
   * rather than throws.
   */
  mayDial(canvasId: string, homeUrl: string): Promise<boolean>;
}

/** What a canvas socket was told when it connected — the observable half of
 * the lid-close beat, so a test can assert a RESUME happened and not a
 * re-snapshot, which is the thing this phase is about. */
export interface HomeHello {
  canvasId: string;
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
  /** The address of the home — `https://isocan.io`. Normalized on the way in
   * (`normalizeHomeUrl`), because this string is simultaneously the registry's
   * key, the badge's key in `identity.json`, and the presence mirror's key,
   * and two spellings of one address would be two of each. */
  homeUrl: string;
  /** This machine's isocan home directory: where the badge is kept, beside
   * the CLI's own, in `identity.json`'s `auth` block. */
  home: string;
  engine: Engine;
  presence: PresenceHub;
  /** Which canvases are this link's, per `homes.json`. See `sweep()`. */
  registry: HomeRegistry;
  /** How often to re-read the home's canvas list. Tests turn it down. */
  pollMs?: number;
  /** How often to re-ask the home which build it is. An hour by default —
   * `BUILD_PROBE_MS`, and see it for why an hour. A knob for the same reason
   * `gcIntervalMs` is one: a proof that the timer FIRES cannot be written
   * against an interval a test would have to wait out. */
  probeMs?: number;
  /** The daemon's rc hold registry (agent-custody): local holds relay up
   * beside the faces, and the home's `rc-ask` lands back in it. */
  rc?: RcHolds;
}

interface CanvasLink {
  canvasId: string;
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
  /**
   * Which dial attempt owns this link right now.
   *
   * `dial()` is async before it has a socket, so two attempts can be in flight
   * at once — the sweep's stuck-dial repair is what makes that deliberate
   * rather than accidental. The counter is how a finished attempt discovers it
   * has been superseded and terminates the socket it just made, instead of two
   * sockets both relaying presence for one canvas.
   */
  /** Has the home said hello on the socket this link is holding? Reset by
   * each dial. A socket that closes without one was never carrying this
   * canvas, however cleanly it upgraded — see `noteCarrying`. */
  carried: boolean;
  dialSeq: number;
  /** When the attempt currently in flight started, or null between attempts.
   * Read only by the sweep, to tell "somebody is dialling" from "somebody has
   * been dialling for half a minute". */
  dialledAt: number | null;
}

/**
 * **What this daemon knows about one canvas's link to one home** — kept
 * per canvas ID rather than on the `CanvasLink`, deliberately.
 *
 * A `CanvasLink` does not survive a 4404: the close handler drops it from the
 * map and the next sweep makes a fresh one. Counting failures on the object
 * would therefore reset the count every two seconds in exactly the case worth
 * complaining about — a canvas the home will not serve, re-dialled forever.
 * The history has to outlive the object it is a history of.
 */
interface CanvasHealth {
  /** How many times this canvas's socket has opened, ever. Zero is the
   * interesting number: it means presence for this canvas has never once
   * moved, however healthy the home's HTTP side looks. */
  opens: number;
  connectedAt: string | null;
  /** When a presence relay last went UP for this canvas, and how many faces
   * it carried. Null means this daemon has never told the home who is here. */
  relayedAt: string | null;
  facesRelayed: number;
  /** Consecutive failures since the last time the home answered for it. */
  failures: number;
  /** When the last attempt ended badly. The sweep reads it to stop re-dialling
   * a canvas the home refuses several times a second, forever. */
  attemptedAt: number | null;
  /** Why the last attempt ended — a close code, or the error that stopped it
   * before there was ever a socket. Everything on this path used to be
   * swallowed; this is where it goes instead. */
  lastFailure: string | null;
  /** Has the failure above already been said out loud? Reset by an open, so a
   * link that comes back and fails again complains again. */
  complained: boolean;
}

export class HomeLink implements HomeConnection {
  readonly homeUrl: string;
  private readonly home: string;
  private readonly engine: Engine;
  private readonly presence: PresenceHub;
  private readonly registry: HomeRegistry;
  private readonly pollMs: number;
  private readonly probeMs: number;

  /**
   * Did the last poll of this home get an answer? Null until one has been
   * tried.
   *
   * Kept as a by-product of the sweep rather than probed on demand, because
   * the caller that wants it is `GET /api/homes`, which feeds `isocan status`'s
   * role line — a command an agent runs dozens of times. A reachability probe
   * per home per status call would put a network round trip behind `isocan
   * status` on a machine with three homes. `reachable()` below is still there
   * for the caller that genuinely wants to ask NOW (`isocan home <url>`, once,
   * before it changes anything).
   */
  answering: boolean | null = null;

  /**
   * **Which build this home last said it was**, or null for every way of not
   * knowing at once: never asked, asked and got nothing, asked and the home
   * could not say.
   *
   * Read by `HomeLinks.upgrade()` and turned into the health body's `upgrade`
   * field. Cleared on a failed probe rather than left holding the last good
   * answer, because a verdict is a statement about NOW: an oracle that cannot
   * answer must produce no verdict, and a cached one would go on asserting a
   * comparison nobody re-made.
   */
  homeBuild: HomeBuild | null = null;

  private badge: StoredBadge | null = null;
  private readonly rc: RcHolds | null;
  private links = new Map<string, CanvasLink>();
  private poll: ReturnType<typeof setInterval> | null = null;
  /** A self-rescheduling timeout, `gc.ts`'s pattern — never a second
   * `setInterval`, which would keep firing into a home that stopped answering
   * and would pile up if a probe ever outran its own interval. */
  private probe: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  private syncing: Promise<void> | null = null;
  private handshakeLog = new Map<string, HomeHandshakes>();
  /** Per canvas, whether its socket has ever carried anything — see
   * `CanvasHealth` for why this outlives the `CanvasLink` it describes. */
  private health = new Map<string, CanvasHealth>();
  /** Which (canvas, actor) faces the home has already refused to vouch for.
   * `relay()` drops such a face on every beat; a parked agent beats every few
   * seconds, and a line per beat would bury the one that matters. */
  private unvouched = new Set<string>();
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
    this.homeUrl = normalizeHomeUrl(options.homeUrl);
    this.home = options.home;
    this.engine = options.engine;
    this.presence = options.presence;
    this.registry = options.registry;
    this.rc = options.rc ?? null;
    this.pollMs = options.pollMs ?? DEFAULT_POLL_MS;
    this.probeMs = options.probeMs ?? BUILD_PROBE_MS;
    // Local faces going up. Coalesced per canvas; see `scheduleRelay`.
    this.presence.onChange((canvasId) => this.scheduleRelay(canvasId));
    // And the rc's liveness beside them (agent-custody mechanism 1): a hold
    // opening or closing re-relays. Fires for every canvas on the machine;
    // `scheduleRelay` ignores the ones this link does not carry.
    this.rc?.onChange((canvasId) => this.scheduleRelay(canvasId));
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
     *
     * **The row is consulted here too** (phase 10.3), and it has to be: this
     * event is the ENGINE's, so it fires for every canvas on this machine on
     * every link. Without the check, an op applied to a canvas that lives at
     * dev would open a socket for it at prod, and prod would answer 4404 at
     * best — or, in the clone-and-twin case, with a snapshot. The row exists by
     * the time a birth's answer lands, because `bind()` writes it before the
     * forward goes out.
     */
    this.engine.onEvent((canvasId, message) => {
      if (message.type !== "op-applied") return;
      if (this.stopped || this.links.has(canvasId)) return;
      if (!this.registry.idsFor(this.homeUrl).includes(canvasId)) return;
      this.openCanvas(canvasId);
    });
  }

  /**
   * Open the connection and keep it open. Never throws: a home that is down
   * at boot must not stop a daemon from serving its local CLIs — the retry
   * loop is the whole point.
   *
   * **Idempotent, and it has to be.** `HomeLinks.linkFor` fires `start()` on a
   * link the moment it creates one, and `HomeLinks.start()` then awaits
   * `start()` on every address it dials — so every link created at boot was
   * being started TWICE. That is two `setInterval` polls, of which `close()`
   * can only clear the one the field still holds, and it doubled the sweep
   * rate against every home for the life of the daemon. Measured
   * 2026-08-28 while adding the build probe, which would otherwise have
   * inherited the same doubling; `upgrade-probe.test.ts` counts it now.
   */
  start(): Promise<void> {
    return (this.starting ??= this.boot());
  }

  private starting: Promise<void> | null = null;

  private async boot(): Promise<void> {
    // Both round trips at once. The build probe is awaited so that a daemon
    // which has finished booting has already asked — the CLI's very first
    // command reads the health body, and a verdict that arrived a moment later
    // would be a verdict that missed the session it was for. It costs nothing
    // extra against a home that is down: `sync()` is already a request to the
    // same address, and this one gives up in five seconds.
    await Promise.all([this.sync().catch(() => {}), this.askBuild()]);
    this.poll = setInterval(() => void this.sync().catch(() => {}), this.pollMs);
    this.poll.unref?.();
    this.scheduleProbe();
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
    if (this.probe) clearTimeout(this.probe);
    this.probe = null;
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
   * **What it asks for, and why that sentence changed in phase 8.** Phase 6
   * asked the home-wide question and said so out loud: "a replica of a
   * MULTI-TENANT home pulls down more than it should". Phase 7 narrowed the
   * route to the door's own test and found it could go no further, because a
   * fresh replica's badge had no admissions and nothing ever gave it one.
   *
   * The pass gives it one. So this caller now states the narrow question —
   * `?reach=admitted`, see `CanvasesReach` — and a replica mirrors **what it
   * was let into** rather than everything a home will show it. Enumeration
   * was never the design; it was the easiest thing that worked when a home
   * had one member.
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
    /**
     * **The canvases this machine has RECORDED as this home's**, first and
     * unconditionally — `homes.json`, and nothing else on this disk.
     *
     * **This one line is the phase's central change, and it is a data-loss
     * fix rather than a tidy-up.** It used to be every canvas the local store
     * held, which was correct exactly as long as a daemon had one home: with
     * one home, "on this disk" and "this home's" were the same set. With two
     * they are not, and the old line has a dev link dialling a prod canvas. A
     * 404 is the good outcome. The bad one is the clone-and-twin shape — one
     * canvas id present at both homes — where the wrong home answers with a
     * **snapshot** and `adoptRemoteSnapshot` overwrites the local copy with a
     * stranger's canvas of the same name.
     *
     * What the line still buys is unchanged and still load-bearing: **a home
     * that is down must not make a replica forget what it holds.** The record
     * is on this disk, so the guarantee got STRONGER — it used to be derived
     * from a listing, and it is now a durable row.
     *
     * **It also still keeps a canvas born HERE**, and the reason changed. It
     * used to survive on two independent legs — "it is in the local store" and
     * "the home admitted the badge that created it" (`{root: "created"}`). The
     * first of those is gone; a locally-born canvas is in the local store too,
     * and that is precisely what must no longer be enough. What replaced it is
     * better: `bind()` wrote the row at birth, naming this home, so the canvas
     * is here BY THE RECORD. The admission leg is untouched.
     */
    for (const canvasId of this.registry.idsFor(this.homeUrl)) wanted.add(canvasId);
    /**
     * **And what the home says this badge was let into** — admissions alone,
     * not what a door would open. That is the whole of phase 8 stage 4: a
     * replica is TOLD what it carries instead of enumerating a home.
     *
     * Still best-effort, for the reason above. Note also what a re-badge
     * costs and does not: a badge that had to go back to the door holds no
     * admissions, so this half comes back empty until the replica is let in
     * again — and the local half above means nothing already here is dropped.
     *
     * **Each one is arbitrated before it is dialled** (phase 10.3). A home
     * offering a canvas is not the same as a canvas being this home's: two
     * homes can offer one id, and `mayDial` is where that is decided once,
     * with the record, instead of by whichever poll ran first.
     */
    const theirs = await this.api<Canvas[]>("GET", canvasesRoute("admitted")).catch(() => null);
    const was = this.answering;
    this.answering = theirs !== null;
    /**
     * **Reconnect**, at the granularity that matters here: not a canvas socket
     * coming back — there are many of those and they say nothing about the
     * home as a whole — but this home starting to answer AGAIN. A laptop that
     * was asleep, or a home that was redeploying, gets its build re-read now
     * instead of at the top of the next hour.
     *
     * `false` and not "anything but true": at boot `answering` is null and
     * `boot()` has already asked, so treating null as a reconnect would probe
     * every home twice on every daemon start. The one case that falls between
     * them — the home answers its canvas list but not its health route, so the
     * boot probe missed and no reconnect ever follows — waits out the hour,
     * which is the right price for not putting a probe on the poll.
     */
    if (this.answering && was === false) void this.askBuild();
    if (theirs) {
      for (const canvas of theirs) {
        if (this.stopped) return;
        if (await this.registry.mayDial(canvas.id, this.homeUrl)) wanted.add(canvas.id);
      }
    }
    for (const canvasId of wanted) {
      if (this.stopped) return;
      this.repair(canvasId);
    }
  }

  /**
   * **One canvas, brought back to what it should be** — the sweep's third job,
   * and the one it did not have.
   *
   * It used to open a socket for a canvas that had no link and stop there:
   * `links.has(canvasId)` was read as "this canvas is fine". A map entry is
   * not a connection, and the gap between those two sentences is where a
   * canvas can sit for hours — a dial that hung before it ever made a socket
   * leaves an entry with no socket, no retry timer, and nothing that will ever
   * touch it again.
   *
   * **Presence is the reason this matters more than it looks.** Everything
   * else about a home link is level-triggered: the poll re-reads the canvas
   * set, the tail is re-requested from a seq cursor, a write is retried by its
   * caller. The relay alone was edge-triggered — it went up when a face
   * changed or a socket opened, and if that one send was lost or refused,
   * nothing ever tried again. So the repair below re-states the roster on
   * every poll for any canvas that has local faces: it is a few hundred bytes
   * every couple of seconds, and it converts "your face never went up" from a
   * permanent condition into a two-second one.
   *
   * A canvas with no local faces is deliberately left alone. An empty roster
   * that failed to go up costs nothing — the home's own TTL and the socket's
   * close both clear this daemon's mirror without being told.
   */
  private repair(canvasId: string): void {
    const link = this.links.get(canvasId);
    if (!link) {
      /**
       * **A canvas the home keeps refusing is re-dialled slowly, not every
       * poll.** The 4404 close drops the link deliberately — "retrying forever
       * would be a socket storm about a canvas nobody can serve" — and this
       * sweep is what re-creates it, which quietly undid that intent: at the
       * poll interval, forever, on a laptop left open for days.
       *
       * It is not abandoned, because a canvas CAN appear at a home later
       * (offline birth adopts one, a grant arrives). It is just asked at the
       * rate a reconnect would ask, rather than at the rate a poll runs.
       */
      const health = this.healthOf(canvasId);
      if (
        health.opens === 0 &&
        health.failures >= COMPLAIN_AFTER_FAILURES &&
        health.attemptedAt !== null &&
        Date.now() - health.attemptedAt < RECONNECT_MAX_MS
      ) {
        return;
      }
      return this.openCanvas(canvasId);
    }
    if (link.closed) return;
    if (link.socket?.readyState === WebSocket.OPEN) {
      if (this.presence.localRoster(canvasId).length > 0) this.scheduleRelay(canvasId);
      return;
    }
    // Not connected. Somebody is on it if a retry is armed, or if a dial is
    // in flight and has not been in flight absurdly long.
    if (link.retry) return;
    if (link.dialledAt !== null && Date.now() - link.dialledAt < DIAL_STUCK_MS) return;
    if (link.dialledAt !== null) {
      this.noteFailure(
        canvasId,
        `a dial has been unfinished for over ${Math.round(DIAL_STUCK_MS / 1000)}s`,
      );
    }
    void this.dial(link);
  }

  // ---- one canvas, one socket ----

  private openCanvas(canvasId: string): void {
    const link: CanvasLink = {
      canvasId,
      socket: null,
      work: Promise.resolve(),
      retry: null,
      backoffMs: RECONNECT_MIN_MS,
      relay: null,
      closed: false,
      carried: false,
      dialSeq: 0,
      dialledAt: null,
    };
    this.links.set(canvasId, link);
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
    // Whose attempt this is. Everything below checks it before touching the
    // link, because the sweep may have given up on a dial that hung and
    // started another — see `DIAL_STUCK_MS`.
    const attempt = ++link.dialSeq;
    link.carried = false;
    /**
     * **An attempt is in flight from here until it has a socket that opened,
     * or has failed** — including while the socket is still CONNECTING.
     *
     * The repair below reads this as "somebody is on it". Clearing it any
     * earlier — when the socket object exists but has not connected — would
     * have the next poll supersede every dial two seconds in, so a home a
     * slow network takes three seconds to reach would never connect at all.
     */
    link.dialledAt = Date.now();
    const gaveUp = (why: string) => {
      if (link.dialSeq !== attempt) return;
      link.dialledAt = null;
      this.noteFailure(link.canvasId, why);
      this.reconnect(link);
    };
    const badge = await this.ensureBadge();
    if (link.dialSeq !== attempt) return;
    if (!badge) {
      return gaveUp("the door did not answer, so there is no badge to dial with");
    }
    const since = await this.localSeq(link.canvasId);
    if (link.dialSeq !== attempt) return;
    const wsBase = this.homeUrl.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
    const url = `${wsBase}/ws?canvasId=${encodeURIComponent(link.canvasId)}&since=${since}`;
    let socket: WebSocket;
    try {
      socket = new WebSocket(url, { headers: bearerHeader(badge) });
    } catch (err) {
      return gaveUp((err as Error).message);
    }
    /**
     * **The error listener goes on FIRST — before anything can terminate this
     * socket, and before it is even adopted.**
     *
     * Without a listener an abrupt death raises an unhandled `error` on the
     * EventEmitter and takes the daemon with it, which is why `ws.ts` installs
     * one on every accepted socket. The subtlety that cost a CI run: `ws`
     * treats terminating a socket that is still CONNECTING as an error
     * ("WebSocket was closed before the connection was established"), so the
     * supersede branch below is itself a way to raise one. Attaching after the
     * branch left a window in which the daemon could be killed by its own
     * tidying up — and the shutdown path walks straight through it, since a
     * closing daemon is exactly when dials are in flight with nowhere to land.
     *
     * The message is kept rather than discarded: the close that follows
     * reports it, so a refused dial can say WHY instead of only that it
     * happened.
     */
    let failure: string | null = null;
    socket.on("error", (err: Error) => {
      failure = err.message;
    });
    if (link.closed || link.dialSeq !== attempt) {
      // Superseded while we were getting here. Terminate rather than adopt:
      // two sockets on one canvas would relay presence twice and apply the
      // tail twice.
      socket.terminate();
      return;
    }
    link.socket = socket;
    socket.on("open", () => {
      link.dialledAt = null;
      this.scheduleRelay(link.canvasId);
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
    socket.on("close", (code, reason) => {
      if (link.socket !== socket) return; // superseded
      link.socket = null;
      // A socket that died before it ever opened leaves the attempt marked in
      // flight; the retry armed below is what is on it now.
      link.dialledAt = null;
      this.presence.mirror(link.canvasId, this.origin(), []);
      // 4402: the home will not have this machine on that canvas — and, when
      // the reason says `withdrawn`, it HAD it and put it out (roles design,
      // "Reaching an open socket"). Not redialled: a refusal is not a blip,
      // and dialling a door that just said no is the socket storm the 4404
      // branch below already refuses to make. Said once, here, rather than
      // after the several failures an unexplained close earns, because this
      // one is explained. The next poll re-creates the link only if the home
      // lists the canvas for this badge again, which is the home letting it
      // back in.
      if (code === WS_NOT_ADMITTED) {
        const why =
          String(reason) === WITHDRAWN
            ? `the home withdrew this machine's access to ${link.canvasId} (${WS_NOT_ADMITTED} ${WITHDRAWN})`
            : `the home does not admit this machine to ${link.canvasId} (${WS_NOT_ADMITTED})`;
        const health = this.healthOf(link.canvasId);
        health.failures += 1;
        health.attemptedAt = Date.now();
        health.lastFailure = why;
        if (!health.complained) {
          health.complained = true;
          console.error(
            `[isocan] ${this.homeUrl}: ${why} — this canvas is not redialled; ` +
              "ops written here stay here until an owner lets this machine back in. " +
              "`isocan home` shows this per canvas.",
          );
        }
        link.closed = true;
        this.links.delete(link.canvasId);
        return;
      }
      // 4404: the home says this canvas is not there. Stop dialling it — a
      // replica holding a canvas the home has never heard of is offline birth
      // (phase 13), and retrying forever would be a socket storm about a
      // canvas nobody can serve.
      //
      // **Recorded before the link is dropped**, because dropping it is
      // exactly what made this case invisible: the next sweep builds a fresh
      // `CanvasLink` with a fresh count, so a canvas the home refuses forever
      // looked like a first attempt every two seconds. `health` outlives the
      // link precisely so this one can be counted.
      if (code === WS_NO_CANVAS) {
        this.noteFailure(
          link.canvasId,
          `the home says it has no canvas ${link.canvasId} (${WS_NO_CANVAS})`,
        );
        link.closed = true;
        this.links.delete(link.canvasId);
        return;
      }
      // 4409: the home's instance found itself behind its store and hung up
      // so we redial — through the load balancer, to whichever instance is
      // current (#85). Not a failure of the link and not counted as one: the
      // home is fine, this socket simply outlived its instance. Dial again
      // from the floor of the backoff rather than wherever it had climbed to.
      if (code === WS_BEHIND) {
        link.backoffMs = RECONNECT_MIN_MS;
        this.reconnect(link);
        return;
      }
      this.noteFailure(
        link.canvasId,
        failure ??
          (link.carried
            ? `the socket closed (${code})`
            : `the socket closed before the home said hello (${code})`),
      );
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
  private async localSeq(canvasId: string): Promise<number> {
    try {
      await this.engine.settled();
      return (await this.engine.getSnapshot(canvasId)).lastSeq;
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
    const { canvasId } = link;
    switch (message.type) {
      case "resumed":
        this.carrying(link);
        this.hello({ canvasId, type: "resumed", since, lastSeq: message.lastSeq });
        await this.engine.mergeRemoteIdentity(message.colors, message.names);
        return;
      case "snapshot":
        this.carrying(link);
        this.hello({ canvasId, type: "snapshot", since, lastSeq: message.lastSeq });
        await this.engine.adoptRemoteSnapshot(canvasId, message);
        await this.engine.mergeRemoteIdentity(message.colors, message.names);
        return;
      case "op-applied": {
        const applied = await this.engine.applyRemote(canvasId, message.entry);
        // A gap means an entry landed at the home that we never saw — the
        // socket dropped mid-tail, or a message was lost. Re-dialling with the
        // cursor we DO hold lets the home decide between a tail and a
        // snapshot, which is the one place that decision belongs.
        if (applied === "gap") this.resync(link);
        return;
      }
      case "canvas-deleted":
        await this.engine.applyRemoteDelete(canvasId);
        link.closed = true;
        this.links.delete(canvasId);
        this.closeLink(link);
        return;
      /**
       * "Someone at the canvas asked to add an agent" (agent-custody
       * mechanism 2), routed here because this link's `rc-relay` said an rc
       * is parked behind it. Handed to the local hold registry: the parked
       * rc's open `/api/rc/hold` carries it the last hop, and the rc makes
       * the same moves `isocan agent add` makes. An ask with nobody parked
       * any more dies in the registry's short queue — the dialog that sent
       * it is already counting down to say nothing answered.
       */
      case "rc-ask": {
        if (this.rc) {
          this.rc.ask(canvasId, {
            askId: message.askId,
            name: message.name,
            from: message.from,
          });
        }
        return;
      }
      case "presence-roster": {
        // Our own relayed faces come back in the merged roster; taking them
        // as mirrored copies would double every face this machine puts up.
        const ours = new Set(
          this.presence.localRoster(canvasId).map((session) => session.sessionId),
        );
        this.presence.mirror(
          canvasId,
          this.origin(),
          message.sessions.filter((session) => !ours.has(session.sessionId)),
        );
        await this.engine.mergeRemoteIdentity(message.colors, message.names);
        return;
      }
    }
  }

  /** This socket is carrying its canvas — the home has answered for it. */
  private carrying(link: CanvasLink): void {
    if (link.carried) return;
    link.carried = true;
    link.backoffMs = RECONNECT_MIN_MS;
    this.noteCarrying(link.canvasId);
  }

  private hello(hello: HomeHello): void {
    const log = this.handshakeLog.get(hello.canvasId) ?? {
      resumed: 0,
      snapshots: 0,
      last: null,
    };
    if (hello.type === "resumed") log.resumed += 1;
    else log.snapshots += 1;
    log.last = hello;
    this.handshakeLog.set(hello.canvasId, log);
  }

  /** How this canvas's socket has been answered, every time it has connected.
   * Never absent for a canvas that has connected; zeroes for one that has
   * not. */
  handshakes(canvasId: string): HomeHandshakes {
    return this.handshakeLog.get(canvasId) ?? { resumed: 0, snapshots: 0, last: null };
  }

  // ---- is this canvas's socket actually carrying anything ----

  private healthOf(canvasId: string): CanvasHealth {
    let health = this.health.get(canvasId);
    if (!health) {
      health = {
        opens: 0,
        connectedAt: null,
        relayedAt: null,
        facesRelayed: 0,
        failures: 0,
        attemptedAt: null,
        lastFailure: null,
        complained: false,
      };
      this.health.set(canvasId, health);
    }
    return health;
  }

  /**
   * **The home said hello for this canvas**, which is the first moment it is
   * true that this link carries anything.
   *
   * Not the socket's `open` event, and the difference is the whole of a real
   * failure mode: a home that has never heard of a canvas ACCEPTS the upgrade
   * and then closes with 4404. Counting that as a success reset the failure
   * count on every attempt, so a canvas being refused several times a second
   * forever reported itself as healthy — a link in perfect health that had
   * never once carried a face.
   *
   * If it had complained, say that it came back: a line that announces trouble
   * and never announces the end of it is how a log teaches people to distrust
   * it.
   */
  private noteCarrying(canvasId: string): void {
    const health = this.healthOf(canvasId);
    health.opens += 1;
    health.connectedAt = new Date().toISOString();
    health.failures = 0;
    health.lastFailure = null;
    if (health.complained) {
      health.complained = false;
      console.error(`[isocan] ${this.homeUrl} is carrying ${canvasId} again`);
    }
  }

  /**
   * An attempt ended without a working socket.
   *
   * **The one place this path is no longer silent.** Every failure here used
   * to be discarded — the `error` listener is empty by necessity (an
   * unhandled one takes the daemon down), `reconnect` backs off without a
   * word, and a 4404 close drops the link for the next sweep to re-make. A
   * canvas could be re-dialled every two seconds for an hour and the only
   * evidence anywhere was a face that never appeared on somebody else's
   * screen.
   */
  private noteFailure(canvasId: string, why: string): void {
    const health = this.healthOf(canvasId);
    health.failures += 1;
    health.attemptedAt = Date.now();
    health.lastFailure = why;
    if (health.complained || health.failures < COMPLAIN_AFTER_FAILURES) return;
    health.complained = true;
    console.error(
      `[isocan] ${this.homeUrl} has not carried ${canvasId} for ${health.failures} attempts ` +
        `(${why}) — ${
          health.opens === 0 ? "it has never connected, so nobody here" : "nobody here"
        } is visible on that canvas, and ops written there are not arriving. ` +
        "`isocan home` shows this per canvas.",
    );
  }

  /** Per canvas, for `GET /api/homes`. Every canvas this link is holding OR
   * has ever held: a canvas whose link was dropped by a 4404 is exactly the
   * one somebody is trying to ask about. */
  canvasStates(): CanvasLinkState[] {
    const ids = new Set([...this.links.keys(), ...this.health.keys()]);
    return [...ids]
      .sort()
      .map((canvasId) => {
        const health = this.healthOf(canvasId);
        const link = this.links.get(canvasId);
        return {
          canvasId,
          // Upgraded AND answered for. A socket the home is about to refuse is
          // open for a few milliseconds; reporting that as connected would put
          // the word "live" next to the exact canvas somebody is asking about.
          connected: link?.socket?.readyState === WebSocket.OPEN && link.carried,
          opens: health.opens,
          connectedAt: health.connectedAt,
          relayedAt: health.relayedAt,
          facesRelayed: health.facesRelayed,
          failures: health.failures,
          lastFailure: health.lastFailure,
        };
      });
  }

  private resync(link: CanvasLink): void {
    const socket = link.socket;
    link.socket = null;
    socket?.terminate();
    link.backoffMs = RECONNECT_MIN_MS;
    this.reconnect(link);
  }

  // ---- presence, going up ----

  private scheduleRelay(canvasId: string): void {
    const link = this.links.get(canvasId);
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
    const sessions = this.presence.localRoster(link.canvasId);
    const vouched: PresenceSession[] = [];
    for (const session of sessions) {
      // Best effort per face: one actor the home will not vouch for must not
      // take the rest of the roster down with it.
      const ok = await this.ensureClaim(session.actor).then(
        () => true,
        (err: unknown) => {
          /**
           * **Said once per face, because it is otherwise perfectly silent.**
           *
           * The home DROPS a relayed session whose actor its `requireActor`
           * refuses, and drops it without a word (`ws.ts`'s `continue`). This
           * end used to be just as quiet: the rejection was folded into a
           * `false` and the face left out. So an agent could sit on a canvas,
           * beating every few seconds, watching its own local roster show it
           * present, while every beat was thrown away at the far end and
           * nothing anywhere said so.
           */
          const key = `${link.canvasId}\u0000${session.actor.id}`;
          if (!this.unvouched.has(key)) {
            this.unvouched.add(key);
            console.error(
              `[isocan] ${this.homeUrl} will not vouch for ${session.actor.name} ` +
                `(${session.actor.id}): ${(err as Error).message} — their face stays off ` +
                `${link.canvasId} until it does`,
            );
          }
          return false;
        },
      );
      if (ok) {
        this.unvouched.delete(`${link.canvasId}\u0000${session.actor.id}`);
        vouched.push(session);
      }
    }
    if (socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: "presence-relay", sessions: vouched }));
    const health = this.healthOf(link.canvasId);
    health.relayedAt = new Date().toISOString();
    health.facesRelayed = vouched.length;
    /**
     * **The rc's liveness, beside the faces** (agent-custody mechanism 1).
     * Local holds only — a mirror re-relayed would launder someone else's
     * assertion as this badge's. Each answerable actor must be one this
     * badge can vouch for AND an enrolled agent of the canvas: the hold's
     * ids are the rc's word, and the enrolment record is the check the home
     * cannot make against a set of bare ids. Dropping is not silent — it
     * goes through the same once-per-face `unvouched` line the faces use.
     */
    if (this.rc) {
      const local = this.rc.answeringLocal(link.canvasId);
      const agents =
        (await this.engine.getSnapshot(link.canvasId).catch(() => null))?.canvas.agents ?? {};
      const answerable: string[] = [];
      for (const actorId of local.actorIds) {
        const record = agents[actorId];
        if (!record) continue;
        const key = `${link.canvasId} ${actorId}`;
        const ok = await this.ensureClaim(record.actor).then(
          () => true,
          (err: unknown) => {
            if (!this.unvouched.has(key)) {
              this.unvouched.add(key);
              console.error(
                `[isocan] ${this.homeUrl} will not vouch for ${record.actor.name} ` +
                  `(${actorId}): ${(err as Error).message} — they stay unanswerable at the home until it does`,
              );
            }
            return false;
          },
        );
        if (!ok) continue;
        this.unvouched.delete(key);
        answerable.push(actorId);
      }
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({ type: "rc-relay", parked: local.parked, actorIds: answerable }),
        );
      }
    }
  }

  // ---- the badge, and the claims that ride on it ----

  /**
   * The badge this link presents, fetched at most once even when several
   * callers want it at the same instant.
   *
   * **Measured, phase 10.3.** This used to be two awaits with no gate, and it
   * was safe by accident: a link's `start()` was awaited at boot, before the
   * port was bound, so the first `ensureBadge` always ran alone. Under many
   * homes a link is created LAZILY, by the very write that needs it, and its
   * sweep starts in the background at the same moment — so two callers reached
   * the two awaits together, both saw no badge, and both knocked. The door
   * mints a badge per knock, so the daemon ended up holding two: `ensureClaim`
   * put the actor on one, the forwarded op presented the other, and the home
   * answered `not-your-actor` about an actor this machine had just claimed.
   *
   * It reproduced roughly one run in three and it is exactly the shape a
   * comment would have argued was impossible. The gate is the same one
   * `ensureClaim` next door already uses, for the same reason.
   */
  private badging: Promise<StoredBadge | null> | null = null;

  private ensureBadge(): Promise<StoredBadge | null> {
    if (this.badge) return Promise.resolve(this.badge);
    if (this.badging) return this.badging;
    this.badging = (async () => {
      const stored = await readBadge(this.home, this.homeUrl);
      if (stored) {
        this.badge = stored;
        return stored;
      }
      return this.reBadge();
    })().finally(() => {
      this.badging = null;
    });
    return this.badging;
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
      canvasId: null,
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
  grants(canvasId: string): Promise<GrantsResponse> {
    return this.api<GrantsResponse>("GET", grantsRoute(canvasId));
  }

  async createGrant(
    canvasId: string,
    subject: GrantSubject,
    capability?: Capability,
    actor?: Actor,
    bars?: boolean,
  ): Promise<GrantResponse> {
    if (actor) await this.ensureClaim(actor);
    return this.api<GrantResponse>("POST", grantsRoute(canvasId), {
      subject,
      // Forwarded whenever it is not edit (`narrowed`), so an older home never
      // sees the field for the one value it has always meant by omission —
      // and refuses, with `bad-grant`, a rung it does not know. A bar is
      // forwarded the same way: `bars: true` or nothing, and a home from
      // before bars refuses the field it does not know.
      ...(narrowed(capability) ? { capability } : {}),
      ...(bars ? { bars: true } : {}),
      ...(actor ? { actorId: actor.id } : {}),
    });
  }

  async revokeGrant(
    canvasId: string,
    grantId: string,
    actor?: Actor,
    bar?: boolean,
  ): Promise<GrantResponse> {
    if (actor) await this.ensureClaim(actor);
    return this.api<GrantResponse>(
      "DELETE",
      grantRevokeRoute(canvasId, grantId, { ...(actor ? { actorId: actor.id } : {}), ...(bar ? { bar } : {}) }),
    );
  }

  /** Your surfaces AT THE HOME. This daemon's own badge there is one of them
   * and comes back marked `self` — so `isocan badges` run on a laptop shows
   * that laptop's row as the one it is standing on, which is exactly what a
   * person needs to see before they end the other one. */
  attestOffer(): Promise<AttestOffer> {
    return this.api<AttestOffer>("GET", ATTEST_ROUTE);
  }

  attest(body: AttestRequest): Promise<AttestResponse> {
    return this.api<AttestResponse>("POST", ATTEST_ROUTE, body);
  }

  badges(): Promise<BadgesResponse> {
    return this.api<BadgesResponse>("GET", BADGES_ROUTE);
  }

  killBadge(badgeId: string): Promise<KillBadgeResponse> {
    return this.api<KillBadgeResponse>("DELETE", badgeRoute(badgeId));
  }

  // ---- the space routes, forwarded (roles phase 4) ----
  //
  // The claim goes up before every write, as it does before a grant write:
  // the home checks the actor is among this badge's claims and then asks
  // `own` of that person. Reads carry nothing — a space is about badges.

  spaces(): Promise<SpacesResponse> {
    return this.api<SpacesResponse>("GET", SPACES_ROUTE);
  }

  async createSpace(name: string, actor?: Actor): Promise<SpaceResponse> {
    if (actor) await this.ensureClaim(actor);
    return this.api<SpaceResponse>("POST", SPACES_ROUTE, {
      name,
      ...(actor ? { actorId: actor.id } : {}),
    });
  }

  async deleteSpace(spaceId: string, actor?: Actor): Promise<SpaceCanvasResponse> {
    if (actor) await this.ensureClaim(actor);
    return this.api<SpaceCanvasResponse>("DELETE", spaceActingRoute(spaceRoute(spaceId), actor?.id));
  }

  async addToSpace(spaceId: string, canvasId: string, actor?: Actor): Promise<SpaceCanvasResponse> {
    if (actor) await this.ensureClaim(actor);
    return this.api<SpaceCanvasResponse>("PUT", spaceCanvasRoute(spaceId, canvasId), {
      ...(actor ? { actorId: actor.id } : {}),
    });
  }

  async removeFromSpace(spaceId: string, canvasId: string, actor?: Actor): Promise<SpaceCanvasResponse> {
    if (actor) await this.ensureClaim(actor);
    return this.api<SpaceCanvasResponse>(
      "DELETE",
      spaceActingRoute(spaceCanvasRoute(spaceId, canvasId), actor?.id),
    );
  }

  spaceGrants(spaceId: string): Promise<GrantsResponse> {
    return this.api<GrantsResponse>("GET", spaceGrantsRoute(spaceId));
  }

  async createSpaceGrant(
    spaceId: string,
    subject: GrantSubject,
    capability?: Capability,
    actor?: Actor,
    bars?: boolean,
  ): Promise<GrantResponse> {
    if (actor) await this.ensureClaim(actor);
    return this.api<GrantResponse>("POST", spaceGrantsRoute(spaceId), {
      subject,
      ...(narrowed(capability) ? { capability } : {}),
      ...(bars ? { bars: true } : {}),
      ...(actor ? { actorId: actor.id } : {}),
    });
  }

  async revokeSpaceGrant(
    spaceId: string,
    grantId: string,
    actor?: Actor,
    bar?: boolean,
  ): Promise<GrantResponse> {
    if (actor) await this.ensureClaim(actor);
    return this.api<GrantResponse>(
      "DELETE",
      spaceGrantRevokeRoute(spaceId, grantId, { ...(actor ? { actorId: actor.id } : {}), ...(bar ? { bar } : {}) }),
    );
  }

  async setSpaceLink(
    spaceId: string,
    capability: SpaceLinkRequest["capability"],
    actor?: Actor,
  ): Promise<SpaceLinkResponse> {
    if (actor) await this.ensureClaim(actor);
    return this.api<SpaceLinkResponse>("POST", spaceLinkRoute(spaceId), {
      capability,
      ...(actor ? { actorId: actor.id } : {}),
    } satisfies SpaceLinkRequest);
  }

  // ---- the group routes, forwarded (roles phase 5) ----

  groups(): Promise<GroupsResponse> {
    return this.api<GroupsResponse>("GET", GROUPS_ROUTE);
  }

  async createGroup(name: string, actor?: Actor): Promise<GroupResponse> {
    if (actor) await this.ensureClaim(actor);
    return this.api<GroupResponse>("POST", GROUPS_ROUTE, {
      name,
      ...(actor ? { actorId: actor.id } : {}),
    });
  }

  group(groupId: string): Promise<GroupResponse> {
    return this.api<GroupResponse>("GET", groupRoute(groupId));
  }

  async addGroupMember(groupId: string, attribute: string, actor?: Actor): Promise<GroupResponse> {
    if (actor) await this.ensureClaim(actor);
    return this.api<GroupResponse>("PUT", groupMemberRoute(groupId, attribute), {
      ...(actor ? { actorId: actor.id } : {}),
    });
  }

  async removeGroupMember(groupId: string, attribute: string, actor?: Actor): Promise<GroupResponse> {
    if (actor) await this.ensureClaim(actor);
    return this.api<GroupResponse>(
      "DELETE",
      groupActingRoute(groupMemberRoute(groupId, attribute), actor?.id),
    );
  }

  async deleteGroup(groupId: string, actor?: Actor): Promise<GroupResponse> {
    if (actor) await this.ensureClaim(actor);
    return this.api<GroupResponse>("DELETE", groupActingRoute(groupRoute(groupId), actor?.id));
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
  async mintPass(canvasId: string, actor?: Actor): Promise<MintPassResponse> {
    if (actor) await this.ensureClaim(actor);
    return this.api<MintPassResponse>(
      "POST",
      passesRoute(canvasId),
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

  /**
   * One canvas, asked for by name — the arrival that carries an address and no
   * admission (`HOME_JOIN_ROUTE` says which arrivals those are).
   *
   * **It is an ordinary read, and that is the point.** `GET
   * /api/projects/:id` is a canvas-scoped route, so at the home it passes
   * through the same `admit` hook every other canvas-scoped route does: if a
   * grant admits this badge, the hook writes the admission (`{root: "grant"}`,
   * the provenance phase 9's sweep walks) before the route answers, and if
   * nothing admits it the answer is the door's own 403 — passed back through
   * `HomeRefusedError` with the home's status and code intact, so the person
   * who pasted an address to a canvas whose link is off is TOLD that, rather
   * than watching an empty replica and guessing.
   *
   * Nothing here writes an admission itself, and nothing here decides
   * anything. A replica that granted itself entry to its home's canvases would
   * be a laptop answering a door it does not own.
   *
   * Dialling the socket would ALSO admit — it is how a replica has always got
   * its admissions — but a socket's refusal is a close code arriving some
   * milliseconds later on a connection nobody is awaiting, and the caller here
   * is a person at a terminal waiting for a sentence. So the asking is done
   * with the request that can be answered synchronously, and the sweep kicked
   * below (for `redeemPass`'s reason: somebody just typed the command) opens
   * the socket.
   */
  async join(canvasId: string): Promise<Canvas> {
    const canvas = await this.api<Canvas>(
      "GET",
      `/api/projects/${encodeURIComponent(canvasId)}`,
    );
    void this.sync().catch(() => {});
    return canvas;
  }

  async undo(canvasId: string, body: UndoRedoRequest): Promise<LogEntry> {
    await this.ensureClaim(body.actor);
    return this.api<LogEntry>("POST", `/api/projects/${canvasId}/undo`, body);
  }

  async redo(canvasId: string, body: UndoRedoRequest): Promise<LogEntry> {
    await this.ensureClaim(body.actor);
    return this.api<LogEntry>("POST", `/api/projects/${canvasId}/redo`, body);
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
    canvasId: string,
    data: Buffer,
    meta: { mimeType: string; filename: string },
  ): Promise<BlobUploadResponse> {
    const badge = await this.ensureBadge();
    if (!badge) throw new HomeUnreachableError(this.homeUrl, "no badge");
    const send = async (held: StoredBadge) =>
      this.fetchHome(`/api/projects/${canvasId}/blobs`, {
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

  async adopt(canvasId: string, entries: readonly LogEntry[]): Promise<{ seqs: number }> {
    const badge = await this.ensureBadge();
    if (!badge) throw new HomeUnreachableError(this.homeUrl, "no badge");
    const send = async (held: StoredBadge) =>
      this.fetchHome(`/api/projects/${canvasId}/adopt`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...bearerHeader(held) },
        body: JSON.stringify({ entries }),
      });
    let res = await send(badge);
    if (res.status === 401) {
      const fresh = await this.reBadge();
      if (fresh) res = await send(fresh);
    }
    const json = (await res.json().catch(() => null)) as
      | ({ seqs: number } & { error?: string; code?: string })
      | null;
    if (!res.ok) {
      throw new HomeRefusedError(res.status, json?.error ?? `HTTP ${res.status}`, json?.code);
    }
    return json as { seqs: number };
  }

  async hasBlob(canvasId: string, blobHash: string): Promise<boolean | null> {
    const badge = await this.ensureBadge();
    if (!badge) return null;
    try {
      const res = await this.fetchHome(`/api/projects/${canvasId}/blobs/${blobHash}`, {
        method: "HEAD",
        headers: { ...bearerHeader(badge) },
      });
      if (res.status === 404) return false;
      if (!res.ok) return null; // a refusal is not an answer about the bytes
      return true;
    } catch {
      return null;
    }
  }

  /** Bytes this replica has never held, streamed from the home. What makes an
   * item somebody else added on another machine openable here. */
  async openBlob(
    canvasId: string,
    blobHash: string,
    range?: { start: number; end: number },
  ): Promise<{ stream: Readable; mimeType: string; size: number } | null> {
    const badge = await this.ensureBadge();
    if (!badge) return null;
    const headers: Record<string, string> = { ...bearerHeader(badge) };
    if (range) headers.Range = `bytes=${range.start}-${range.end}`;
    let res: Response;
    try {
      res = await this.fetchHome(`/api/projects/${canvasId}/blobs/${blobHash}`, { headers });
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

  /**
   * **Ask the home which build it is.** Auto-upgrade phase 2's one new
   * request, and the only one this class makes without a badge.
   *
   * The health routes are open by construction — they are the load balancer's
   * probe, and the door cannot ask for what it hands out — so this is a plain
   * `fetch` rather than `api()`. That matters beyond tidiness: a replica whose
   * badge has been swept can still find out that it is behind, which is
   * exactly the machine most likely to be.
   *
   * Every failure is the same answer, null, and null is silence downstream
   * rather than "you are current". A home too old to carry a `commit` reaches
   * here as `{ commit: null }` and is stored as such — the verdict is refused
   * one layer up, in `upgradeVerdict`, so that "the home could not say" and
   * "the home did not answer" stay one behaviour with one test.
   */
  private async askBuild(): Promise<void> {
    if (this.stopped) return;
    try {
      const res = await fetch(`${this.homeUrl}${healthPath(this.homeUrl)}`, {
        signal: AbortSignal.any([
          this.aborter.signal,
          AbortSignal.timeout(BUILD_PROBE_TIMEOUT_MS),
        ]),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { commit?: unknown; builtAt?: unknown };
      this.homeBuild = {
        url: this.homeUrl,
        // Re-gated at this end too. The home already applies `plausibleSha`
        // before it reports, so this is belt to that brace — but the value has
        // crossed a network from a machine this one does not control, and a
        // word arriving where a sha belongs must fall to null here rather than
        // be printed at a person as an identity.
        commit: plausibleSha(typeof body.commit === "string" ? body.commit : undefined),
        builtAt: typeof body.builtAt === "string" ? body.builtAt : null,
      };
    } catch {
      this.homeBuild = null;
    }
  }

  /** The hourly beat. Unref'd, like every other timer here: a probe pending on
   * a home that went away must not be the reason a daemon will not exit. */
  private scheduleProbe(): void {
    if (this.stopped) return;
    this.probe = setTimeout(() => {
      void this.askBuild().finally(() => this.scheduleProbe());
    }, this.probeMs);
    this.probe.unref?.();
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
