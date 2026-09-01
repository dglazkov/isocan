import { type UpgradeVerdict } from "../../core/src/index.js";
import type { Engine } from "./engine.js";
import type { PresenceHub } from "./presence.js";
import { HomeLink, type HomeConnection, type HomeDirectory, type HomeRegistry } from "./home-link.js";
import { type HomeAssignments } from "./homes.js";
import type { RcHolds } from "./rc-holds.js";
/**
 * **Every home this daemon dials, and which canvas belongs to which** — phase
 * 10.3's registry.
 *
 * One object owns three things that must not drift apart: the durable record
 * (`homes.json`), the live links, and the arbitration rule that decides what a
 * link may dial. They are together because they are one question asked from
 * three directions — the engine asks "where does this write go", a link asks
 * "which canvases are mine", and the boot asks "who do I dial at all" — and
 * splitting them would put the same lookup in three files with three chances
 * to disagree.
 *
 * **`homes.json` is daemon-owned and this class is its only runtime writer.**
 * (The boot migration in `migrations.ts` is the other, and it runs before this
 * exists.) The file next door, `dirs.json`, is a CLI-owned discovery cache and
 * is deliberately not the model: this is routing state the daemon needs at
 * boot with no CLI running, and two writers on one file is how a file drifts.
 * The CLI's way to change a row is `POST /api/home/join`, which already goes
 * through the daemon.
 *
 * **Still no `--home` flag on any verb, and this is the file where somebody
 * would add one.** Phase 7.5 refused a per-invocation override and the refusal
 * stands: what travels beside an op is not a flag, it is **the marker's
 * assertion** — committed configuration, read from `.isocan/project.json`,
 * which is why an agent can only ever say "the canvas I am creating right now
 * is born at X" and never "point this machine somewhere else for one command".
 * A flag would be a surface an agent could use to send a write to a home
 * nobody chose, one command at a time, with nothing written down afterwards.
 *
 * **And no new `Operation`, deliberately** — the design docs' rule, written
 * here because this is where the proposal would arrive. The home assignment is
 * not canvas state: no reducer produces it, a hosted home cannot state its own
 * public address (so it could never write one truthfully for a canvas born
 * there), and a replicated field would let one machine rewrite another
 * machine's routing. It rides beside the op in `PostOpRequest.home` as request
 * metadata, the same category as `opId` and `clientId`.
 */
export interface HomeLinksOptions {
    /** This machine's isocan home directory — where `homes.json` and the badges
     * live. */
    home: string;
    engine: Engine;
    presence: PresenceHub;
    /**
     * **Where a canvas born here, naming nothing, is born** — `config.json`'s
     * `home` key, re-purposed rather than renamed (see `HomeConfig`).
     *
     * Not "the home this daemon answers to": that sentence is what phase 10.3
     * deleted. Nothing already on this machine moves when this changes.
     */
    birthHome: string | null;
    /** How often each link re-reads its home's canvas list. Tests turn it down. */
    pollMs?: number;
    /** How often each link re-asks its home which build it is. See
     * `HomeLinkOptions.probeMs`. */
    probeMs?: number;
    /** The daemon's rc hold registry, whose local holds each link relays up as
     * `rc-relay` and whose asks arrive back down as `rc-ask` (agent-custody). */
    rc?: RcHolds;
}
export declare class HomeLinks implements HomeDirectory, HomeRegistry {
    /** The birth default, normalized. Null when a canvas born here stays here. */
    readonly birthHome: string | null;
    private readonly options;
    private rows;
    private readonly open;
    /** Writes to `homes.json`, serialized. Two concurrent births would otherwise
     * both read the record, both add their row, and the second write would
     * erase the first — the same read-modify-write hazard `blobs.json` is on the
     * single-writer chain for. */
    private writes;
    private stopped;
    /** Which (canvas, home) disagreements have already been said out loud. A
     * sweep runs every couple of seconds forever; a contested canvas would
     * otherwise print a line per poll until somebody killed the daemon. */
    private complained;
    constructor(options: HomeLinksOptions);
    /**
     * Read the record, open a link per distinct address, and start dialling.
     *
     * **The birth default gets a link even with zero canvases assigned to it**,
     * and that is a deliberate exception rather than an oversight. It costs a
     * badge fetch and a poll, and it dials nothing at all — its `wanted` set is
     * empty. What it buys is three things that would otherwise silently stop
     * working on a machine that has a home configured and has not yet made a
     * canvas there: `runDaemon`'s "home X is answering" boot line, `isocan
     * home`'s reachability report, and `Engine.preferredName`'s upward question,
     * which is the whole of phase 7.5's scope-mismatch fix.
     */
    /**
     * **Read the routing table. Dial nothing.**
     *
     * Split out of `start()` because the two halves want opposite timing, and
     * bundling them cost real bytes. Dialling must wait until the daemon is
     * serving — the first thing down a canvas socket is written through the
     * engine. But the TABLE must be loaded before the daemon answers anything,
     * because `homeOf` is how every write decides where it goes.
     *
     * While it was unloaded, every canvas looked homeless. `Engine.putBlob`
     * reads exactly this to decide whether to push bytes up
     * (`if (home) await home.putBlob(...)`), so an upload landing in that
     * window skipped the home SILENTLY while its `item.addVersion` replicated
     * normally — a teammate got the item, its title and its version, with no
     * bytes behind it and a "blob not found" where the screen should be. It
     * never repairs itself, because nothing ever notices.
     *
     * The window was small — between `listen` and this line — but the clients
     * most likely to be inside it are precisely the ones that reconnect the
     * instant the port opens: a parked agent resuming its lap, a browser tab
     * retrying. On a machine whose daemon restarts often (a dev watcher will
     * do it on every save) that is not a rare shape at all.
     */
    load(): Promise<void>;
    start(): Promise<void>;
    /**
     * Shut every link down with the daemon.
     *
     * Where `homeLink.close()` used to be in `startDaemon` — before the store,
     * because a link is the one thing here that is still WRITING (an entry may
     * be mid-apply), and phase 4's finding already paid once for a socket left
     * open being a process that never exits.
     */
    close(): Promise<void>;
    /** Where this canvas lives, as this machine has recorded it: a normalized
     * address, or null for "this daemon is its home". Absent and null are the
     * same answer — see `homes.ts` for why both spellings exist. */
    homeOf(canvasId: string): string | null;
    /** Every row, for `GET /api/homes`. A copy: the caller is a route handler
     * serializing it, and handing out the live object is how a reader becomes a
     * writer by accident. */
    assignments(): HomeAssignments;
    idsFor(homeUrl: string): string[];
    /**
     * **The arbitration rule**, in the one place it is applied: a home has
     * offered this canvas in its admitted listing — may this link dial it?
     *
     * - **No row** → write one naming this home, and dial. This is how the sweep
     *   still discovers what a pass admitted, and what keeps `letBIn()` working:
     *   a machine let into a canvas it has never held learns where that canvas
     *   lives from the only party that could have told it.
     * - **The row names this home** → dial. The ordinary case.
     * - **The row names a DIFFERENT home, or `null`** → do not dial, and say so
     *   once, loudly, naming both addresses and the id.
     *
     * That third branch is the one worth arguing about, and the argument is that
     * **two homes claiming one canvas id is the twin case**, which is phase 13's
     * (adoption and re-homing) and which cannot be resolved by a poll. Silently
     * adopting either one is the worst available outcome: the loser's work is
     * overwritten by `adoptRemoteSnapshot` and nothing anywhere says so.
     *
     * **A log line, not a throw.** A sweep must not die of this — the other
     * canvases at this home are innocent, and a link that stopped sweeping would
     * turn one contested id into a whole home going quiet.
     */
    mayDial(canvasId: string, homeUrl: string): Promise<boolean>;
    /** One row, written through the serialized chain. */
    private record;
    private enqueue;
    for(canvasId: string): HomeConnection | null;
    all(): readonly HomeConnection[];
    birth(): HomeConnection | null;
    /**
     * **Does this daemon disagree with its home about which build to be?**
     * (auto-upgrade phase 2.) Null for no verdict, which is the answer whenever
     * anything in the chain cannot say.
     *
     * **Which home answers, on a machine with several.** The birth default, and
     * failing that the single home if there is exactly one. That rule is
     * deliberately narrow: phase 10.3 made the home a property of the CANVAS, so
     * "which build should this machine run" has no forced answer on a machine
     * answering to three homes — picking the newest would be silently choosing
     * a distribution channel on someone's behalf, which is the flapping the
     * design warns about. Until that is decided (it is on this project's
     * Deliberately-open list), an ambiguous machine gets no verdict rather than
     * a guess, and every verdict that IS produced names the home it came from.
     */
    upgrade(): UpgradeVerdict | null;
    bind(canvasId: string, homeUrl: string | null): Promise<HomeConnection | null>;
    /**
     * That canvas is gone. Drop its row, or a re-created id inherits a dead
     * routing — the same class of bug as a stale pidfile, and harder to see.
     *
     * An orphaned link goes with it: no row names its address any more and it is
     * not the birth default, so nobody will ask it anything again. Checked HERE
     * rather than on the poll, deliberately — **a poll returning nothing is a
     * home being quiet, not a home being gone**, and closing a link because its
     * home had a slow afternoon is how a replica forgets.
     */
    release(canvasId: string): Promise<void>;
    /**
     * Close the link to this address if nothing needs it any more — no row names
     * it and it is not the birth default.
     *
     * Called after a delete and after a join that the far door refused, and
     * **never on the poll**: a poll returning nothing is a home being quiet, not
     * a home being gone, and a link closed for a slow afternoon is a laptop that
     * has forgotten where its work lives.
     */
    dropIfUnused(homeUrl: string): Promise<void>;
    /**
     * The link to one address, opened on first ask.
     *
     * Four callers create links this way and all four know an address for a
     * reason: boot (one per distinct row), a birth naming one, a join, and a
     * redeemed pass. Lazily, because the alternative is a daemon that dials
     * every address it has ever heard of at boot whether or not anything needs
     * it — and the poll it would start is the expensive half.
     */
    linkFor(homeUrl: string): HomeLink;
    /** One link by address, or undefined when this daemon has never dialled it.
     * Exposed for the tests that assert what a link did NOT do — see
     * `HomeHandshakes`, whose interesting question is negative. */
    link(homeUrl: string): HomeLink | undefined;
    /** Every open link, as links rather than as connections. */
    links(): readonly HomeLink[];
    /**
     * **The home to ask about something that is not about a canvas** — badges,
     * attestations, a pass being redeemed.
     *
     * A named seam rather than a solved problem. These acts are home-scoped and
     * carry no canvas: `isocan badges` asks "what surfaces of mine exist THERE",
     * and a redeemed pass names a home only implicitly, in the token's own
     * provenance, which nothing here can read. With one home the question did
     * not arise; with several there is no honest local answer.
     *
     * What is answered instead is the narrow case that is honest: the birth
     * default when there is one (where this machine is heading, and on a pure
     * replica the only home there is), else the single link when there is
     * exactly one, else nothing. On a pure replica and on a pure home this is
     * byte-for-byte today's behaviour. On a mixed rig it is a refusal from the
     * wrong home rather than a wrong answer, which is the right side of the
     * cheerful-wrong-address line — and the real fix, when a scene forces it, is
     * for a pass token to name its home the way a canvas address does.
     */
    homeScoped(): HomeConnection | null;
    /**
     * **The homes that make `homeScoped` unanswerable**, or null when it has an
     * answer — the difference between "this daemon is the desk" and "this daemon
     * cannot tell which desk you mean".
     *
     * It exists because `homeScoped()` returning null is two completely
     * different situations wearing one shape, and a caller that treated them
     * alike would ship the wrong one:
     *
     * - **No links at all** — a plain home. The local desk IS the answer, which
     *   is what every daemon in this repo was before phase 10.3 and what a
     *   hosted home is now. Null here, and the caller answers locally.
     * - **Several links and no birth default** — a mixed rig with work at two
     *   homes. The local desk is emphatically NOT the answer: a person asking
     *   which of their surfaces exist would be handed this laptop's own ledger,
     *   which is short, plausible and wrong, with nothing saying so. Their real
     *   badges are at the homes named here.
     *
     * So this returns the addresses, the route refuses with `AMBIGUOUS_HOME`,
     * and the person picks. The real fix — for a pass, already made — is for the
     * request to carry its home; `RedeemPassRequest.home` is what that looks
     * like, and a badge route could grow the same field the day a scene wants
     * it.
     */
    homeScopedAmbiguity(): string[] | null;
}
