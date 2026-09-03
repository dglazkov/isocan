import { Readable } from "node:stream";
import type { Actor, AttestOffer, AttestRequest, AttestResponse, BadgesResponse, BlobUploadResponse, Capability, CanvasLinkState, GrantResponse, GrantsResponse, GrantSubject, KillBadgeResponse, LogEntry, MintPassResponse, PostOpRequest, PostOpResponse, Canvas, RedeemPassResponse, UndoRedoRequest } from "../../core/src/index.js";
import type { Engine } from "./engine.js";
import type { PresenceHub } from "./presence.js";
import { type HomeBuild } from "./build.js";
import type { RcHolds } from "./rc-holds.js";
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
export declare class HomeUnreachableError extends Error {
    readonly code = "home-unreachable";
    constructor(homeUrl: string, cause: string);
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
export declare class HomeRefusedError extends Error {
    readonly status: number;
    readonly code?: string | undefined;
    constructor(status: number, message: string, code?: string | undefined);
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
    createGrant(canvasId: string, subject: GrantSubject, capability?: Capability, actor?: Actor, 
    /** A bar rather than an invitation (roles phase 3): carried up as
     * `bars: true`, the way the rung is carried only when it narrows. */
    bars?: boolean): Promise<GrantResponse>;
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
    putBlob(canvasId: string, data: Buffer, meta: {
        mimeType: string;
        filename: string;
    }): Promise<BlobUploadResponse>;
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
    adopt(canvasId: string, entries: readonly LogEntry[]): Promise<{
        seqs: number;
    }>;
    /** Bytes this replica has never seen, read straight from the home. Null when
     * the home does not have them either. */
    openBlob(canvasId: string, blobHash: string, range?: {
        start: number;
        end: number;
    }): Promise<{
        stream: Readable;
        mimeType: string;
        size: number;
    } | null>;
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
export declare class HomeLink implements HomeConnection {
    readonly homeUrl: string;
    private readonly home;
    private readonly engine;
    private readonly presence;
    private readonly registry;
    private readonly pollMs;
    private readonly probeMs;
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
    answering: boolean | null;
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
    homeBuild: HomeBuild | null;
    private badge;
    private readonly rc;
    private links;
    private poll;
    /** A self-rescheduling timeout, `gc.ts`'s pattern — never a second
     * `setInterval`, which would keep firing into a home that stopped answering
     * and would pile up if a probe ever outran its own interval. */
    private probe;
    private stopped;
    private syncing;
    private handshakeLog;
    /** Per canvas, whether its socket has ever carried anything — see
     * `CanvasHealth` for why this outlives the `CanvasLink` it describes. */
    private health;
    /** Which (canvas, actor) faces the home has already refused to vouch for.
     * `relay()` drops such a face on every beat; a parked agent beats every few
     * seconds, and a line per beat would bury the one that matters. */
    private unvouched;
    /** Cuts every in-flight request to the home when the daemon shuts down, so
     * closing does not wait out a 30-second timeout on a home that has gone. */
    private aborter;
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
    private claimed;
    private claiming;
    constructor(options: HomeLinkOptions);
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
    start(): Promise<void>;
    private starting;
    private boot;
    /**
     * Shut down with the daemon.
     *
     * Phase 4's finding paid for this once already: a socket left open is a
     * process that never exits. Every canvas socket is terminated, every timer
     * cleared, and the mirrored faces are dropped — because with the connection
     * gone, nobody on the other side of it is visibly here any more, and a
     * roster that went on showing them would be presence lying.
     */
    close(): Promise<void>;
    /** The key this link's mirrored faces are held under. One home, one key. */
    private origin;
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
    private sync;
    private sweep;
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
    private repair;
    private openCanvas;
    private closeLink;
    private reconnect;
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
    private dial;
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
    private localSeq;
    /**
     * One message from the home, applied here.
     *
     * The two hellos are the two halves of one contract and a client must handle
     * either: `resumed` means "keep what you have, here comes the evening",
     * `snapshot` means "what you have cannot be caught up from my live log —
     * take this instead". Treating the fallback as a failure is the misreading
     * `protocol.ts` warns about.
     */
    private receive;
    /** This socket is carrying its canvas — the home has answered for it. */
    private carrying;
    private hello;
    /** How this canvas's socket has been answered, every time it has connected.
     * Never absent for a canvas that has connected; zeroes for one that has
     * not. */
    handshakes(canvasId: string): HomeHandshakes;
    private healthOf;
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
    private noteCarrying;
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
    private noteFailure;
    /** Per canvas, for `GET /api/homes`. Every canvas this link is holding OR
     * has ever held: a canvas whose link was dropped by a 4404 is exactly the
     * one somebody is trying to ask about. */
    canvasStates(): CanvasLinkState[];
    private resync;
    private scheduleRelay;
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
    private relay;
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
    private badging;
    private ensureBadge;
    private reBadge;
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
    announceActor(actor: Actor): Promise<void>;
    /**
     * "What name is free where this is going to land?"
     *
     * No claim goes up first, and there is nothing to cache: the answer is about
     * a namespace other machines are also writing to, and a remembered one would
     * be a reservation this link is in no position to hold. The engine treats
     * what comes back as a preference and re-checks it locally, so a stale answer
     * is cheap and an unreachable home costs nothing at all.
     */
    freeName(): Promise<string>;
    private ensureClaim;
    submitOp(body: PostOpRequest): Promise<PostOpResponse>;
    /** Who may enter this canvas, as the HOME has it. No claim goes up first:
     * a grant is about badges, never about actors. */
    grants(canvasId: string): Promise<GrantsResponse>;
    createGrant(canvasId: string, subject: GrantSubject, capability?: Capability, actor?: Actor, bars?: boolean): Promise<GrantResponse>;
    revokeGrant(canvasId: string, grantId: string, actor?: Actor, bar?: boolean): Promise<GrantResponse>;
    /** Your surfaces AT THE HOME. This daemon's own badge there is one of them
     * and comes back marked `self` — so `isocan badges` run on a laptop shows
     * that laptop's row as the one it is standing on, which is exactly what a
     * person needs to see before they end the other one. */
    attestOffer(): Promise<AttestOffer>;
    attest(body: AttestRequest): Promise<AttestResponse>;
    badges(): Promise<BadgesResponse>;
    killBadge(badgeId: string): Promise<KillBadgeResponse>;
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
    mintPass(canvasId: string, actor?: Actor): Promise<MintPassResponse>;
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
    redeemPass(token: string): Promise<RedeemPassResponse>;
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
    join(canvasId: string): Promise<Canvas>;
    undo(canvasId: string, body: UndoRedoRequest): Promise<LogEntry>;
    redo(canvasId: string, body: UndoRedoRequest): Promise<LogEntry>;
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
    putBlob(canvasId: string, data: Buffer, meta: {
        mimeType: string;
        filename: string;
    }): Promise<BlobUploadResponse>;
    adopt(canvasId: string, entries: readonly LogEntry[]): Promise<{
        seqs: number;
    }>;
    hasBlob(canvasId: string, blobHash: string): Promise<boolean | null>;
    /** Bytes this replica has never held, streamed from the home. What makes an
     * item somebody else added on another machine openable here. */
    openBlob(canvasId: string, blobHash: string, range?: {
        start: number;
        end: number;
    }): Promise<{
        stream: Readable;
        mimeType: string;
        size: number;
    } | null>;
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
    private api;
    /**
     * Every HTTP call to the home goes through here, so "the home is down" has
     * one spelling and one message naming the address.
     *
     * Two signals, not one: the timeout, and this link's own shutdown. A daemon
     * closing while a forwarded write is in flight would otherwise wait out the
     * full timeout before its process could exit — the same class of "a socket
     * left open is a process that never exits" that phase 4 paid for once.
     */
    private fetchHome;
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
    private askBuild;
    /** The hourly beat. Unref'd, like every other timer here: a probe pending on
     * a home that went away must not be the reason a daemon will not exit. */
    private scheduleProbe;
    /** Is the home answering at all? Uses `healthPath`, never a literal: against
     * a hosted home the bare `/healthz` is swallowed by Google's frontend and a
     * live home reads as dead (phase 5's finding). */
    reachable(timeoutMs?: number): Promise<boolean>;
}
