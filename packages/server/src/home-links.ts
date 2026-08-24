import { normalizeHomeUrl } from "@isocan/core";
import type { Engine } from "./engine.ts";
import type { PresenceHub } from "./presence.ts";
import {
  HomeLink,
  type HomeConnection,
  type HomeDirectory,
  type HomeRegistry,
} from "./home-link.ts";
import { readHomes, writeHomes, type HomeAssignments } from "./homes.ts";

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
 * **And no new `Operation`, deliberately** — `docs/design`'s §8.1, written
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
}

export class HomeLinks implements HomeDirectory, HomeRegistry {
  /** The birth default, normalized. Null when a canvas born here stays here. */
  readonly birthHome: string | null;

  private readonly options: HomeLinksOptions;
  private rows: HomeAssignments = {};
  private readonly open = new Map<string, HomeLink>();
  /** Writes to `homes.json`, serialized. Two concurrent births would otherwise
   * both read the record, both add their row, and the second write would
   * erase the first — the same read-modify-write hazard `blobs.json` is on the
   * single-writer chain for. */
  private writes: Promise<unknown> = Promise.resolve();
  private stopped = false;
  /** Which (canvas, home) disagreements have already been said out loud. A
   * sweep runs every couple of seconds forever; a contested canvas would
   * otherwise print a line per poll until somebody killed the daemon. */
  private complained = new Set<string>();

  constructor(options: HomeLinksOptions) {
    this.options = options;
    this.birthHome = options.birthHome === null ? null : normalizeHomeUrl(options.birthHome);
  }

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
  async start(): Promise<void> {
    this.rows = await readHomes(this.options.home);
    const addresses = new Set<string>();
    for (const value of Object.values(this.rows)) if (value !== null) addresses.add(value);
    if (this.birthHome !== null) addresses.add(this.birthHome);
    // Started in parallel: each `start()` takes a sweep's round trip, and a
    // machine with three homes must not spend three timeouts booting when one
    // of them is down.
    await Promise.all([...addresses].map((address) => this.linkFor(address).start()));
  }

  /**
   * Shut every link down with the daemon.
   *
   * Where `homeLink.close()` used to be in `startDaemon` — before the store,
   * because a link is the one thing here that is still WRITING (an entry may
   * be mid-apply), and phase 4's finding already paid once for a socket left
   * open being a process that never exits.
   */
  async close(): Promise<void> {
    this.stopped = true;
    const links = [...this.open.values()];
    this.open.clear();
    await Promise.allSettled(links.map((link) => link.close()));
    await this.writes.catch(() => {});
  }

  // ---- the record ----

  /** Where this canvas lives, as this machine has recorded it: a normalized
   * address, or null for "this daemon is its home". Absent and null are the
   * same answer — see `homes.ts` for why both spellings exist. */
  homeOf(projectId: string): string | null {
    return this.rows[projectId] ?? null;
  }

  /** Every row, for `GET /api/homes`. A copy: the caller is a route handler
   * serializing it, and handing out the live object is how a reader becomes a
   * writer by accident. */
  assignments(): HomeAssignments {
    return { ...this.rows };
  }

  idsFor(homeUrl: string): string[] {
    const key = normalizeHomeUrl(homeUrl);
    return Object.entries(this.rows)
      .filter(([, value]) => value === key)
      .map(([projectId]) => projectId);
  }

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
  async mayDial(projectId: string, homeUrl: string): Promise<boolean> {
    const key = normalizeHomeUrl(homeUrl);
    const row = this.rows[projectId];
    if (row === undefined) {
      await this.record(projectId, key);
      return true;
    }
    if (row === key) return true;
    // `\u0000` as the separator, written as an ESCAPE and never as a raw
    // byte: a canvas id cannot contain one, so the key is unambiguous, and a
    // literal NUL in a source file makes it non-text — `grep` skips it in
    // silence, and this repo greps its own sources in anger.
    const said = `${projectId}\u0000${key}`;
    if (!this.complained.has(said)) {
      this.complained.add(said);
      console.error(
        `[isocan] ${key} offers ${projectId}, but this machine has recorded that canvas as ` +
          `${row === null ? "local (this daemon is its home)" : `living at ${row}`} — not ` +
          "dialling it. Two homes holding one canvas id is a twin, and moving a canvas " +
          "between homes is a deliberate act (re-homing), never something a poll does.",
      );
    }
    return false;
  }

  /** One row, written through the serialized chain. */
  private record(projectId: string, homeUrl: string | null): Promise<void> {
    return this.enqueue(async () => {
      if (this.rows[projectId] === homeUrl && projectId in this.rows) return;
      this.rows = { ...this.rows, [projectId]: homeUrl };
      await writeHomes(this.options.home, this.rows);
    });
  }

  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const next = this.writes.then(work, work);
    this.writes = next.catch(() => {});
    return next;
  }

  // ---- HomeDirectory ----

  for(projectId: string): HomeConnection | null {
    const address = this.homeOf(projectId);
    return address === null ? null : this.linkFor(address);
  }

  all(): readonly HomeConnection[] {
    return [...this.open.values()];
  }

  birth(): HomeConnection | null {
    return this.birthHome === null ? null : this.linkFor(this.birthHome);
  }

  async bind(projectId: string, homeUrl: string | null): Promise<HomeConnection | null> {
    const target = homeUrl !== null ? normalizeHomeUrl(homeUrl) : this.birthHome;
    // Written BEFORE the write is forwarded, not after: the answer landing
    // locally fires the engine's op-applied event, and a link deciding whether
    // to open a socket for this canvas reads exactly this row. A row written
    // after the round trip would be read a moment too late.
    await this.record(projectId, target);
    return target === null ? null : this.linkFor(target);
  }

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
  async release(projectId: string): Promise<void> {
    const address = this.rows[projectId];
    if (address === undefined) return;
    await this.enqueue(async () => {
      const { [projectId]: _gone, ...rest } = this.rows;
      this.rows = rest;
      await writeHomes(this.options.home, this.rows);
    });
    if (address === null) return;
    await this.dropIfUnused(address);
  }

  /**
   * Close the link to this address if nothing needs it any more — no row names
   * it and it is not the birth default.
   *
   * Called after a delete and after a join that the far door refused, and
   * **never on the poll**: a poll returning nothing is a home being quiet, not
   * a home being gone, and a link closed for a slow afternoon is a laptop that
   * has forgotten where its work lives.
   */
  async dropIfUnused(homeUrl: string): Promise<void> {
    const key = normalizeHomeUrl(homeUrl);
    if (key === this.birthHome) return;
    if (this.idsFor(key).length > 0) return;
    const link = this.open.get(key);
    if (!link) return;
    this.open.delete(key);
    await link.close().catch(() => {});
  }

  // ---- the links themselves ----

  /**
   * The link to one address, opened on first ask.
   *
   * Four callers create links this way and all four know an address for a
   * reason: boot (one per distinct row), a birth naming one, a join, and a
   * redeemed pass. Lazily, because the alternative is a daemon that dials
   * every address it has ever heard of at boot whether or not anything needs
   * it — and the poll it would start is the expensive half.
   */
  linkFor(homeUrl: string): HomeLink {
    const key = normalizeHomeUrl(homeUrl);
    const existing = this.open.get(key);
    if (existing) return existing;
    const link = new HomeLink({
      homeUrl: key,
      home: this.options.home,
      engine: this.options.engine,
      presence: this.options.presence,
      registry: this,
      ...(this.options.pollMs !== undefined ? { pollMs: this.options.pollMs } : {}),
    });
    this.open.set(key, link);
    // Not awaited: `start()` costs a sweep's round trip, and the caller here is
    // a person's write waiting on a birth. `boot` awaits its own; everybody
    // else gets a link that works immediately (the badge is fetched on the
    // first call) and a poll that begins a moment later.
    if (!this.stopped) void link.start().catch(() => {});
    return link;
  }

  /** One link by address, or undefined when this daemon has never dialled it.
   * Exposed for the tests that assert what a link did NOT do — see
   * `HomeHandshakes`, whose interesting question is negative. */
  link(homeUrl: string): HomeLink | undefined {
    return this.open.get(normalizeHomeUrl(homeUrl));
  }

  /** Every open link, as links rather than as connections. */
  links(): readonly HomeLink[] {
    return [...this.open.values()];
  }

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
  homeScoped(): HomeConnection | null {
    if (this.birthHome !== null) return this.linkFor(this.birthHome);
    const links = [...this.open.values()];
    return links.length === 1 ? links[0]! : null;
  }

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
  homeScopedAmbiguity(): string[] | null {
    if (this.birthHome !== null) return null;
    const links = [...this.open.values()];
    if (links.length <= 1) return null;
    return links.map((link) => link.homeUrl).sort();
  }
}
