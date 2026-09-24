import type {
  Actor,
  ActorBindingRecord,
  ActorClaimOp,
  ActorJoins,
  Canvas,
  CanvasContents,
  CanvasSnapshotResponse,
  CreateSessionResponse,
  EnrolledAgent,
  LogEntry,
  Operation,
  ParkAdvanceRequest,
  ParkClaimRequest,
  ParkClaimResponse,
  ParkDeliveredRequest,
  PostOpResponse,
  PresenceActivity,
  RcAsk,
  RcHoldRequest,
  RcHoldResponse,
  RcPolicy,
  RollKind,
  UpdateSessionRequest,
  WatchLogRequest,
  WatchLogResponse,
  WatchedLogEntry,
} from "@isocan/core";
import {
  ApiError,
  CLAIM_REFUSAL,
  PARK_ADOPTED_CODE,
  SYSTEM_ACTOR,
  answerPolicy,
  canvasUrl,
  dispatchReason,
  gateSetAside,
  isSystemActor,
  lapsedFor,
  lastRoll,
  mayWake,
  newId,
  ownersWord,
  policyWords,
  rollDue,
  rollOp,
  rollWords,
  rulesOf,
  speakersFor,
  turnedAway,
  turnedAwayLine,
} from "@isocan/core";
import { gateTurn, type GuardLimits, type GuardState } from "./guards.ts";
import { itemCenter, nameResolver, summonsPrompt, threadLocus } from "./helpers.ts";
import type { RcAgentRow } from "./rows.ts";

/**
 * **The rc's room, over what a host hands it** (docs/projects/room/design.md,
 * "`runRoom(deps): Room`").
 *
 * This is `runRcRoom` from `packages/cli/src/main.ts` with the laptop taken
 * out: every line it narrates, every call it makes to the daemon, and every
 * decision it takes is the same, and everything it used to reach for on the
 * machine — the disk, the process table, the terminal, the clock — arrives in
 * `RoomDeps`. The laptop's `isocan rc` builds the deps from its context and is
 * one host of this; a test builds them in memory and runs a night by a clock
 * it advances by hand.
 *
 * What the room does not know, by name: the upgrade window, the sandbox fence,
 * the harness scan and the default-harness question, the session pointer file
 * and the daemon restart. A lost connection is retried; restarting whatever
 * was not answering is the host's (the laptop's routes do it).
 */

/**
 * The daemon calls the room makes, as `@isocan/api`'s `DaemonRoutes` spells
 * them — declared here over core's wire types, so the module reaches nothing
 * of `@isocan/api` (docs/projects/room/design.md, `routes`). The laptop hands
 * its `DaemonClient`, and the compiler holds the two shapes together at that
 * call; a host or a test hands exactly these. A refusal the home answered
 * throws core's `ApiError`; anything else thrown is a connection that never
 * got an answer, and the room retries it.
 */
export interface RoomRoutes {
  actorBindings(keys?: string[]): Promise<ActorBindingRecord[]>;
  claimActor(op: ActorClaimOp): Promise<PostOpResponse>;
  createSession(
    canvasId: string,
    actor: Actor,
    label?: string,
    harness?: string,
    kind?: "cli" | "rc",
  ): Promise<CreateSessionResponse>;
  endSession(canvasId: string, sessionId: string): Promise<{ ok: true }>;
  getLog(canvasId: string, since: number, waitMs?: number): Promise<LogEntry[]>;
  parkAdvance(request: ParkAdvanceRequest): Promise<{ ok: true }>;
  parkClaim(request: ParkClaimRequest): Promise<ParkClaimResponse>;
  parkDelivered(request: ParkDeliveredRequest): Promise<{ ok: true }>;
  rcHold(request: RcHoldRequest, signal?: AbortSignal): Promise<RcHoldResponse>;
  /** Explicit release when the room stops (issue #308). */
  rcRelease?(request: { canvasId: string }): Promise<{ ok: true; released?: number }>;
  /** The room writes as the system voice only; `DaemonRoutes.sendOp`'s later
   * parameters (client id, home, group…) it never passes. */
  sendOp(canvasId: string | null, actor: Actor, op: Operation): Promise<PostOpResponse>;
  snapshot(canvasId: string, signal?: AbortSignal): Promise<CanvasSnapshotResponse>;
  updateSession(
    canvasId: string,
    sessionId: string,
    patch: UpdateSessionRequest,
  ): Promise<{ ok: true; cancelled?: { threadId: string; by: string; at: string } }>;
  watchLog(request: WatchLogRequest, signal?: AbortSignal): Promise<WatchLogResponse>;
}

/** The rc half of the enrolment record, as the verbs the room uses. The
 * laptop keeps it in `~/.isocan/rc-agents.json` (`packages/cli/src/rc.ts`). */
export interface RoomRows {
  /** Every row this machine keeps, on every canvas: the owner's hands are all
   * of them, and the room picks its canvas's rows out itself. */
  list(): Promise<RcAgentRow[]>;
  /** Write the row only when none exists for its canvas and actor; whether it
   * wrote. */
  adopt(row: RcAgentRow): Promise<boolean>;
  remove(canvasId: string, actorId: string): Promise<void>;
  /** Record the session a turn ran in. Whether the row was still there to
   * write. */
  setSessionId(canvasId: string, actorId: string, sessionId: string): Promise<boolean>;
}

/** One beat of a running turn, as the adapter streams it. */
export interface RoomTurnEvent {
  kind: string;
  text?: string;
  detail?: string;
}

/** What runs one turn: the shape `AcpAgentProcess` has. */
export interface RoomAdapter {
  ensureSession(cwd: string, stored: string | null): Promise<{ sessionId: string; resumed: boolean }>;
  prompt(sessionId: string, text: string, onEvent: (event: RoomTurnEvent) => void): Promise<{ stopReason: string }>;
  /** The turn is over, whichever way; awaited before the face comes off. */
  close(): void | Promise<void>;
}

/** A row's harness, resolved: the name the face carries, and how to start it. */
export interface RoomHarness {
  readonly harness: string;
  /** Start the adapter for one turn, after the face is on. */
  open(turn: RoomTurn): Promise<RoomAdapter>;
}

export interface RoomTurn {
  /** Who this turn is for, by id (#333): the canvas, the agent summoned, and
   * the person the room answers to. The laptop reads these from `cwd`, the
   * environment and `isocan whoami`; a host that serves many people has none
   * of the three, and files its records and counts its quota by these. */
  canvasId: string;
  agent: Actor;
  owner: Actor;
  /** The face this turn's presence runs under, or null when none was made. */
  face: string | null;
  /** The thread the summons came from, when it came from one. */
  threadId: string | null;
  /** A line of this agent's narration: the room prefixes the agent's name. */
  narrate(line: string): void;
}

/**
 * **A turn the host holds, in the host's own words** (#333). Thrown from
 * `adapterFor` or `open` when the turn is not to start yet and nothing is
 * broken: an allowance spent, a quota reached. The room says `line` in the
 * thread in the system voice, as it says the guard's ceiling, keeps the
 * summons pending and asks again at `retryAfter` (the host's clock, ms).
 * Anything else thrown is a failed turn: "couldn't answer", and a retry in a
 * minute.
 */
export class RoomHold extends Error {
  constructor(
    /** The whole sentence the person reads; the room adds nothing to it. */
    readonly line: string,
    readonly retryAfter: number,
  ) {
    super(line);
    this.name = "RoomHold";
  }
}

/** A key-value for what the room would like to survive a restart. String
 * keys, JSON values. A host that persists it gets a room that does not repeat
 * itself; the laptop hands it a `Map` (`mapState`). */
export interface RoomState {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface RoomDeps {
  /** The daemon routes, over a `fetch`. */
  routes: RoomRoutes;
  /** What the room is parked on. */
  canvas: Pick<Canvas, "id" | "title">;
  /** Who it answers to: the person whose machine this is. */
  owner: Actor;
  /** The address the canvas lives at, for the line that says where it is. */
  origin: string;
  /** Where an agent that arrives with no rc half runs: the directory the
   * room was started in. */
  cwd: string;
  rows: RoomRows;
  /** The harness a row runs on. Throws, in the words of what is missing, when
   * there is none. The row carries the name the roster gives the agent now. */
  adapterFor(row: RcAgentRow): Promise<RoomHarness>;
  /** The last hop of the web's "add an agent", on this machine: prepare the
   * directory an ask names, claim the actor, write its row, enroll it. */
  enrol(ask: RcAsk): Promise<void>;
  /**
   * The session key an agent's actor is claimed under on this machine, and
   * the key a turn's injected environment presents. The host derives it from
   * a secret it keeps and the agent's name, so the same machine derives the
   * same key every time and nobody else can: a name is visible to anyone
   * admitted to the canvas, and the desk resumes an actor for whoever
   * presents the key it was claimed under.
   */
  agentKey(name: string): Promise<string>;
  /** One line, no level. */
  narrate(line: string): void;
  state: RoomState;
  /** The guard limits: turns per agent per hour, and agent-to-agent chains. */
  limits: GuardLimits;
  clock: { now(): number };
  /** Resolves after `ms`, or as soon as `signal` aborts. Never rejects. */
  sleep(ms: number, signal: AbortSignal): Promise<void>;
  /**
   * **Whether this agent's arrivals are said in the Chat** — the roll call
   * (`roll.ts` in core): "Percy is here", "Percy is back", and "Percy
   * stepped away" when the room stops on purpose. Absent: never, so a host
   * opts in; the laptop's `isocan rc` does only under `--announce` or
   * `config.json`'s `rcAnnounce`. When the host persists
   * `state`, the `seen:` keys are what make a restart within the window quiet.
   */
  announce?: (agent: Actor) => boolean;
}

export interface Room {
  /** Stand down: end the hold, both long polls and every wait, and take the
   * room's announcement off the presence plane. Resolves when that is done. */
  stop(): Promise<void>;
  /** Resolves once the room has stopped; rejects with what ended it otherwise
   * (a daemon refusal the room cannot retry past, as `isocan rc` exits on). */
  readonly done: Promise<void>;
}

/** A `Map` as the room's state — what the laptop hands it, so nothing survives
 * a restart there. Values are kept as they are, so rooms sharing one map share
 * one guard per agent. */
export function mapState(map: Map<string, unknown> = new Map()): RoomState {
  return {
    get: async (key) => map.get(key),
    set: async (key, value) => {
      map.set(key, value);
    },
    delete: async (key) => {
      map.delete(key);
    },
  };
}

/** Where the room keeps each fact under `state`. Per agent: shared by every
 * room of one rc. Per canvas: what one room has said. */
const keys = {
  guard: (actorId: string) => `guard:${actorId}`,
  session: (actorId: string) => `session:${actorId}`,
  origins: (actorId: string) => `origins:${actorId}`,
  gateSaid: (canvasId: string, key: string) => `said:${canvasId}:gate:${key}`,
  turnedAwaySaid: (canvasId: string, key: string) => `said:${canvasId}:turned-away:${key}`,
  /** An agent another badge holds: its cursor was refused `not-your-actor`,
   * and that was said. Deleted when a later start parks it. */
  notHeldSaid: (canvasId: string, actorId: string) => `said:${canvasId}:not-held:${actorId}`,
  /** When this agent was last held on this canvas (ms) — the roll call's
   * memory across a restart, written at most once a minute. */
  seen: (canvasId: string, actorId: string) => `seen:${canvasId}:${actorId}`,
};

/** How stale the persisted `seen` may run: a minute against a five-minute
 * window, so one write a minute per agent and canvas is plenty. */
const SEEN_EVERY_MS = 60_000;

/** The desk's refusal for an actor the presenting badge does not hold. */
const NOT_YOUR_ACTOR = "not-your-actor";

/**
 * **A claim refused because another badge holds the actor** (the claim rule,
 * "Dual-held agents"): the desk's `name-taken` with the reason
 * `held-elsewhere`. It does not pass on its own, so the agent is not held
 * here. The minute after this badge's own claim and a live face come back
 * as `name-taken` with other reasons, and are retried as before.
 */
const heldElsewhere = (err: unknown): boolean =>
  err instanceof ApiError && err.code === "name-taken" && err.reason === CLAIM_REFUSAL.heldElsewhere;

/** One canvas's whole rc — holds, cursors, dispatch, narration. */
export function runRoom(deps: RoomDeps): Room {
  const life = new AbortController();
  let announcement: { sessionId: string } | null = null;
  let leave: (() => Promise<void>) | null = null;
  const stop = async (): Promise<void> => {
    life.abort();
    const announced = announcement;
    announcement = null;
    const leaving = leave;
    leave = null;
    await Promise.all([
      deps.routes.rcRelease?.({ canvasId: deps.canvas.id }).catch(() => {}),
      announced ? deps.routes.endSession(deps.canvas.id, announced.sessionId).catch(() => {}) : undefined,
      leaving?.().catch(() => {}),
    ]);
  };
  const done = room(
    deps,
    life.signal,
    (made) => {
      announcement = made;
    },
    (say) => {
      leave = say;
    },
  );
  return { stop, done };
}

async function room(
  deps: RoomDeps,
  life: AbortSignal,
  announce: (made: { sessionId: string } | null) => void,
  onLeave: (say: () => Promise<void>) => void,
): Promise<void> {
  const { routes, rows, state, clock } = deps;
  const p = deps.canvas;
  const narrate = deps.narrate;
  const sleep = (ms: number) => deps.sleep(ms, life);
  const rosterOf = async () => {
    const snapshot = await routes.snapshot(p.id);
    return snapshot.canvas.agents ?? {};
  };
  const rcCwd = deps.cwd;
  // The rc supplies WHERE and HOW for enrolments that arrived without an
  // rc half — the web's adds, and any it missed while down. Quiet: this is
  // record housekeeping, not an event. The home half stays authoritative:
  // rc rows for this canvas with no standing enrolment are dead, reaped.
  const reap = async (roster: Record<string, EnrolledAgent>) => {
    for (const row of await rows.list()) {
      if (row.canvasId === p.id && !roster[row.actorId]) await rows.remove(p.id, row.actorId);
    }
  };
  const reconcile = async (roster: Record<string, EnrolledAgent>) => {
    for (const record of Object.values(roster)) {
      if (notHeld.has(record.actor.id)) continue;
      await rows.adopt({
        canvasId: p.id,
        actorId: record.actor.id,
        name: record.actor.name,
        harness: null,
        cwd: rcCwd,
        sessionId: null,
      });
    }
    await reap(roster);
  };
  // Names for the withdraw narration: state drops the row before the op is
  // read here, so remember every name this process has seen.
  const known = new Map<string, string>();
  const opening = await rosterOf();
  for (const [id, row] of Object.entries(opening)) known.set(id, row.actor.name);

  /**
   * **Dispatch** (on-demand phase 4). One quiet connection, fanned out: the
   * room holds a cursor row per enrolled agent (adopting it — a plain `wait`
   * park as the same actor is displaced), reads the log once per lap from the
   * earliest of them, and applies core's `dispatchReason` per agent — the same
   * composition `wait` imports, so the park and the dispatcher cannot drift. A
   * summons carries every pending matched entry; ops landing mid-turn sit
   * behind the cursor and become the next summons when the turn completes.
   * The room sees `end_turn` directly, so completion is an explicit advance,
   * not the park's inferred evidence.
   */
  interface AgentDispatch {
    parkId: string;
    cursor: number;
    redeliverUpTo: number | null;
    /** Matched entries awaiting a turn, in log order. */
    pending: WatchedLogEntry[];
    scannedTip: number;
    busy: boolean;
    /** After a failed turn: hold the pending batch until this passes —
     * a broken adapter must not hot-loop; the thread already carries the
     * refusal (phase 5). */
    retryAfter: number;
  }
  const dispatches = new Map<string, AgentDispatch>();
  /**
   * **Not held by this machine** (docs/projects/room/design.md, the claim
   * rule). The room claims, faces and dispatches only agents its badge may
   * speak as. The cursor route requires the actor, so an agent another badge
   * holds (or an orphan nobody holds, which the room cannot tell apart without
   * claiming) comes back from `parkClaim` as `not-your-actor`: read once, at
   * start or at the adoption that first meets it, and kept here for the room's
   * life. Such an agent has no cursor, no row, no place in the hold, no face
   * and no turn, and is said once, under `state`. A pass that hands it over is
   * picked up at the next start; the room does not ask again before then.
   */
  const notHeld = new Set<string>();
  const sayNotHeld = async (actorId: string): Promise<void> => {
    const key = keys.notHeldSaid(p.id, actorId);
    if (await state.get(key)) return;
    await state.set(key, true);
    const name = known.get(actorId) ?? actorId;
    narrate(`${name} is not held by this machine — a pass from whoever holds ${name} hands it over`);
  };
  /** A held agent found held by another badge too: out of the hold and the
   * dispatch, what waited for it dropped, and said once. Its row stays. */
  const standDownNotHeld = async (actorId: string): Promise<void> => {
    dispatches.delete(actorId);
    notHeld.add(actorId);
    await sayNotHeld(actorId);
  };
  // Where each standing began — the floor for a cursor row that does not
  // exist yet (a web add with no rc parked, and nothing to claim it since).
  // One log read at start; the enrol verb and the live enroll event carry
  // their own seqs.
  const enrolSeqs = new Map<string, number>();
  for (const entry of await routes.getLog(p.id, 0)) {
    if (entry.envelope.op.type === "agent.enroll") {
      enrolSeqs.set(entry.envelope.op.agent.id, entry.seq);
    }
  }
  /**
   * Park one agent's cursor. For an agent in this machine's own rows the
   * actor is claimed first, under its own key, so a machine that re-badged
   * still takes up its own agents; for any other, the park alone asks. What
   * came back: held, not held by this badge, or a refusal of some other kind for
   * the caller to say.
   */
  const parkAgent = async (
    actorId: string,
    own: boolean,
    seedAt?: number,
  ): Promise<"held" | "not-held" | { error: Error }> => {
    if (dispatches.has(actorId)) return "held";
    if (notHeld.has(actorId)) return "not-held";
    const name = known.get(actorId);
    if (own && name !== undefined) {
      // A refusal here is read from the park that follows — save one: another
      // badge holding the actor (dual-held) is not held here, even though
      // this badge may still hold it under an old key and the park would
      // take it.
      let elsewhere = false;
      await deps
        .agentKey(name)
        .then((sessionKey) => routes.claimActor({ type: "actor.claim", sessionKey, as: actorId }))
        .catch((err: unknown) => {
          elsewhere = heldElsewhere(err);
        });
      if (elsewhere) {
        notHeld.add(actorId);
        return "not-held";
      }
    }
    try {
      const floor = seedAt ?? enrolSeqs.get(actorId);
      const claim = await routes.parkClaim({
        canvasId: p.id,
        actorId,
        ...(floor !== undefined ? { seedAt: floor } : {}),
      });
      dispatches.set(actorId, {
        parkId: claim.parkId,
        cursor: claim.cursor,
        redeliverUpTo: claim.redeliverUpTo,
        pending: [],
        scannedTip: claim.cursor,
        busy: false,
        retryAfter: 0,
      });
      await state.delete(keys.notHeldSaid(p.id, actorId));
      return "held";
    } catch (err) {
      if (err instanceof ApiError && err.code === NOT_YOUR_ACTOR) {
        notHeld.add(actorId);
        return "not-held";
      }
      return { error: err as Error };
    }
  };
  const couldNotHold = (actorId: string, error: Error): void =>
    narrate(`could not hold ${known.get(actorId) ?? actorId}'s cursor — ${error.message}`);
  const ownRow = async (actorId: string): Promise<boolean> =>
    (await rows.list()).some((r) => r.canvasId === p.id && r.actorId === actorId);
  // Each agent's cursor is parked before anything else is done for it, so an
  // agent this badge does not hold gets no row here and is never one of this
  // machine's hands. What the parks have to say waits for the opening lines.
  const openingSays: (() => Promise<void>)[] = [];
  {
    const mine = new Set((await rows.list()).filter((r) => r.canvasId === p.id).map((r) => r.actorId));
    for (const actorId of Object.keys(opening)) {
      const parked = await parkAgent(actorId, mine.has(actorId));
      if (parked === "not-held") openingSays.push(() => sayNotHeld(actorId));
      else if (parked !== "held") openingSays.push(async () => couldNotHold(actorId, parked.error));
    }
  }
  await reconcile(opening);

  /**
   * **Owner-only summons** (decided 11 Sep 2026 — issue #238, the rc
   * research note's recommendation 6). A summoned turn runs on this person's
   * machine and this person's tokens, so whose word may start one is this
   * machine's to decide, and the default is this person alone.
   *
   * The owner is the rc's own person. Their hands are every actor this
   * machine's badge speaks as (the agents it answers for, the person's own
   * interactive sessions): run here, spending the same tokens, so their word
   * counts as the owner's. Read again at most every ten seconds on a lap that
   * carries something, because a new agent session on this machine is a new
   * hand. `answerPolicy` (core) turns an enrolment's stored gate into what
   * this rc does, and the same value is announced with the hold so the web
   * and `isocan who` can say it.
   */
  const owner: Actor = { id: deps.owner.id, name: deps.owner.name };
  const keeping: { owner: Actor; hands: string[] } = { owner, hands: [owner.id] };
  let handsAt = 0;
  const refreshHands = async (): Promise<void> => {
    if (clock.now() - handsAt < 10_000) return;
    handsAt = clock.now();
    const bound = await routes.actorBindings().catch(() => [] as { actor: Actor }[]);
    const mine = await rows.list().catch(() => [] as { actorId: string }[]);
    keeping.hands = [...new Set([owner.id, ...mine.map((r) => r.actorId), ...bound.map((b) => b.actor.id)])];
  };
  await refreshHands();
  /** The roster and joins the hold's announcement reads — kept here because
   * the hold loop starts before the dispatch loop's own variables exist. */
  const policyState: {
    roster: Record<string, EnrolledAgent>;
    joined: ActorJoins | undefined;
    nameOf: (actorId: string) => string | undefined;
  } = {
    roster: opening,
    joined: undefined,
    nameOf: (id) => known.get(id),
  };
  {
    const first = await routes.snapshot(p.id).catch(() => null);
    policyState.joined = first?.joined;
    if (first) policyState.nameOf = nameResolver(first);
  }
  const policyOf = (record: EnrolledAgent): RcPolicy =>
    answerPolicy(rulesOf(record.rules), keeping, record.writtenBy?.id, policyState.joined);
  const policyLine = (record: EnrolledAgent): string =>
    policyWords(policyOf(record), (id) => known.get(id) ?? policyState.nameOf(id), owner.id, policyState.joined) ??
    "listens to everyone";
  /** Said once per agent per change, so a gate someone else wrote is never
   * silently set aside. Kept under `state`, so a room that persists it does
   * not say it again after a restart. */
  const sayPolicy = async (record: EnrolledAgent): Promise<void> => {
    const key = keys.gateSaid(
      p.id,
      `${record.actor.id} ${record.writtenBy?.id ?? ""} ${JSON.stringify(rulesOf(record.rules).listen ?? null)}`,
    );
    if (await state.get(key)) return;
    await state.set(key, true);
    if (gateSetAside(rulesOf(record.rules), keeping, record.writtenBy?.id, policyState.joined)) {
      narrate(
        `${record.actor.name}'s gate was last written by ${record.writtenBy?.name ?? "somebody else"}, not you — ` +
          `answering only you until you say otherwise: isocan rc listen ${record.actor.name} --to <names|everyone>`,
      );
    }
  };
  /**
   * The parked rc announces itself: a presence session of kind "rc" —
   * rendered nowhere (no cursor, no face, no roster row), it exists so the
   * add-agent dialog can say "an rc is parked here" instead of guessing.
   * TTL retires it if the room's host dies rudely; the heartbeat below keeps
   * it alive while parked, and `stop()` ends it. This is a convenience signal,
   * NOT the "answerable" truth — that is the hold's, connection-bound.
   */
  const announced = await routes.createSession(p.id, deps.owner, undefined, undefined, "rc").catch(() => null);
  if (announced && life.aborted) {
    await routes.endSession(p.id, announced.sessionId).catch(() => {});
    return;
  }
  announce(announced);
  // Quiet at start, the way `claude rc` is — but never mute about WHERE.
  // The first real user's first stumble was exactly this: a title with no
  // address is a place you cannot get to. Two lines: where this is, and
  // what happens next (with the door named when the roster is empty — a
  // how-to-add is not a roster listing). Names stay unlisted; `isocan
  // who` is where rosters are read.
  narrate(`answering on "${p.title}" — ${canvasUrl(deps.origin, p.id)}`);
  const enrolledCount = Object.keys(opening).length;
  narrate(
    enrolledCount === 0
      ? "nobody is enrolled yet — Add an agent in the tray at that address; this rc picks it up without a restart"
      : `${enrolledCount} ${enrolledCount === 1 ? "agent" : "agents"} enrolled (\`isocan who\` names them) — quiet until something arrives (Ctrl-C stops answering)`,
  );
  /**
   * Whose word wakes them, said at start and grouped — the one place the
   * person who pays is guaranteed to look, and the line that tells somebody
   * upgrading past 11 Sep that their agents now answer them alone. Names
   * are listed here, unlike the roster, because this is a consent fact and
   * a count would hide whose it is.
   */
  if (enrolledCount > 0) {
    const byWords = new Map<string, string[]>();
    for (const record of Object.values(opening)) {
      // Whose word wakes an agent is this machine's to say only for its own.
      if (notHeld.has(record.actor.id)) continue;
      const words = policyLine(record);
      byWords.set(words, [...(byWords.get(words) ?? []), record.actor.name]);
      await sayPolicy(record);
    }
    for (const [words, names] of byWords) {
      const narrowed = words !== "listens to everyone";
      narrate(
        `${names.join(", ")} ${names.length === 1 ? words : words.replace(/^listens/, "listen")}` +
          (narrowed ? " — `isocan rc listen <name> --to <names|everyone>` widens one" : ""),
      );
    }
  }
  for (const say of openingSays) await say();

  /** The ceiling's memory and the cycle guard's count — per AGENT, not per
   * room (standing agents phase 2): one key under `state` that every room
   * holding this agent hands to `gateTurn`, so six canvases are not six
   * budgets. Read at the gate and written back after it. */
  const guardOf = async (actorId: string): Promise<GuardState> =>
    ((await state.get(keys.guard(actorId))) as GuardState | undefined) ?? { turnTimes: [], agentChain: 0, held: null };
  /** Whose word an agent's latest turn carries (owner-only summons), per
   * agent across rooms. */
  const originsOf = async (actorId: string): Promise<ReadonlySet<string> | undefined> => {
    const said = (await state.get(keys.origins(actorId))) as string[] | undefined;
    return said ? new Set(said) : undefined;
  };
  const TURNS_PER_HOUR = deps.limits.turnsPerHour;
  const AGENT_CHAIN = deps.limits.agentChain;
  /** The system voice, into the thread where the person is looking —
   * journey 5's acceptance. Never authored as the agent (words in a dead
   * agent's mouth) and never as the person (sentences no person wrote). */
  const sayInThread = async (threadId: string | null, body: string): Promise<void> => {
    if (!threadId) return;
    await routes
      .sendOp(p.id, SYSTEM_ACTOR, {
        type: "thread.reply",
        threadId,
        comment: { id: newId("cmt"), body },
      })
      .catch(() => {});
  };
  const threadOf = (entries: WatchedLogEntry[]): string | null => {
    const comment = entries.find(
      (e) => e.envelope.op.type === "thread.create" || e.envelope.op.type === "thread.reply",
    );
    return comment ? (comment.envelope.op as { threadId: string }).threadId : null;
  };
  /** Whether this agent's standing here is gone, read from the home rather
   * than from this room's dispatch table: the withdraw op and the turn it
   * stopped reach the room in either order. */
  const withdrawnHere = async (actorId: string): Promise<boolean> => {
    const snapshot = await routes.snapshot(p.id).catch(() => null);
    return snapshot !== null && !snapshot.canvas.agents?.[actorId];
  };

  /**
   * **The roll call** (`roll.ts` in core): each agent says in the Chat, in
   * its own name, that it is here — once a hold naming it has come back, so
   * it is never said of an agent that did not become answerable — and that it
   * is back after being gone longer than `ROLL_AWAY_MS`, whether the gap was a
   * restart (the `seen` memory and the Chat's own last line say how long) or
   * a connection lost inside this room (the last hold that came back does).
   * A quick reconnect says nothing. On a deliberate stop it says it stepped
   * away; a dismissal says nothing, because the withdraw op already did.
   */
  const rolls = new Map<string, { last: { kind: RollKind; at: number } | null; seen: number | undefined; kept: number }>();
  const sayRoll = async (record: EnrolledAgent, kind: RollKind, canvas: CanvasContents | null): Promise<boolean> => {
    const words =
      policyWords(policyOf(record), (id) => known.get(id) ?? policyState.nameOf(id), undefined, policyState.joined) ??
      "listens to everyone";
    const body = rollWords(kind, record.actor.name, words);
    // Twice at most: the second time over a fresh read, for the race where
    // somebody else birthed the Chat between the read and the write.
    for (let attempt = 0; attempt < 2; attempt++) {
      const at = attempt === 0 && canvas ? canvas : (await routes.snapshot(p.id).catch(() => null))?.canvas;
      if (!at) break;
      try {
        await routes.sendOp(p.id, record.actor, rollOp(at, kind, body));
        narrate(`${record.actor.name} · said in the Chat — ${body}`);
        return true;
      } catch (err) {
        if (attempt === 1 || !(err instanceof ApiError && err.code === "main-exists")) {
          narrate(`${record.actor.name} · could not say "${kind}" in the Chat — ${(err as Error).message}`);
          return false;
        }
      }
    }
    return false;
  };
  const rollCall = async (actorIds: readonly string[], began: number): Promise<void> => {
    if (!deps.announce) return;
    const ended = clock.now();
    let canvas: CanvasContents | null = null;
    for (const actorId of actorIds) {
      const record = policyState.roster[actorId];
      if (!record || !dispatches.has(actorId)) continue;
      let mine = rolls.get(actorId);
      if (!mine) {
        // First hold for this agent in this room: what the Chat and the
        // host remember say whether this is news.
        canvas ??= (await routes.snapshot(p.id).catch(() => null))?.canvas ?? null;
        if (!canvas) continue;
        const seen = await state.get(keys.seen(p.id, actorId));
        mine = { last: lastRoll(canvas, actorId), seen: typeof seen === "number" ? seen : undefined, kept: 0 };
        rolls.set(actorId, mine);
      }
      const due = deps.announce(record.actor) ? rollDue({ last: mine.last, seen: mine.seen, now: began }) : null;
      if (due && (await sayRoll(record, due, canvas))) {
        mine.last = { kind: due, at: ended };
        canvas = null;
      }
      mine.seen = ended;
      if (ended - mine.kept >= SEEN_EVERY_MS) {
        mine.kept = ended;
        await state.set(keys.seen(p.id, actorId), ended);
      }
    }
  };
  let rolling: Promise<void> = Promise.resolve();
  onLeave(async () => {
    if (!deps.announce) return;
    await rolling;
    const now = clock.now();
    for (const [actorId, mine] of rolls) {
      const record = policyState.roster[actorId];
      if (!record) continue;
      await state.set(keys.seen(p.id, actorId), now);
      // Only an agent that is said to be here is said to have left.
      if (mine.last && mine.last.kind !== "away" && deps.announce(record.actor)) {
        await sayRoll(record, "away", null);
      }
    }
  });

  /**
   * **The connection IS the fact** (on-demand phase 6). This hold, re-issued
   * back-to-back until the room stops, is what makes the roster's
   * `answerable` true: the daemon counts these agents answerable exactly while
   * a hold is open, and a dead room's socket closes instantly — no window, no
   * TTL lie. Ten-second holds so a fresh enrolment joins the claim within
   * seconds; the gap between holds can only err toward "not answerable", the
   * permitted direction.
   */
  const holdOnce = (actorIds: string[] = [...dispatches.keys()]): Promise<RcHoldResponse> => {
    // The policy rides the hold (owner-only summons): the web and
    // `isocan who` read whose word this rc takes from the same value
    // dispatch applies, so the two cannot differ.
    const policies: Record<string, RcPolicy> = {};
    for (const actorId of actorIds) {
      const record = policyState.roster[actorId];
      if (record) policies[actorId] = policyOf(record);
    }
    return routes.rcHold({ canvasId: p.id, actorIds, waitMs: 10_000, owner, policies }, life);
  };
  /**
   * **A hold refused `not-your-actor` mid-room** (the claim rule). The hold
   * names only agents this room parked, so the refusal means the badge lost
   * claims it had: a re-badge at the door re-claims the person alone. The
   * room re-claims the agents in this machine's own rows under their keys and
   * asks once more. Still refused, it says so once and keeps asking; these
   * are its own agents, and they are not said to be not held — unless the
   * re-claim itself is refused because another badge holds the agent
   * (dual-held), which is.
   */
  let holdRefusedSaid = false;
  const holdAfterRefusal = async (): Promise<RcHoldResponse | null> => {
    const mine = (await rows.list().catch(() => [] as RcAgentRow[])).filter(
      (r) => r.canvasId === p.id && dispatches.has(r.actorId),
    );
    for (const row of mine) {
      const name = known.get(row.actorId) ?? row.name;
      let elsewhere = false;
      await deps
        .agentKey(name)
        .then((sessionKey) => routes.claimActor({ type: "actor.claim", sessionKey, as: row.actorId }))
        .catch((err: unknown) => {
          elsewhere = heldElsewhere(err);
        });
      // Another badge holds it: not this room's to hold any more.
      if (elsewhere) await standDownNotHeld(row.actorId);
    }
    try {
      return await holdOnce();
    } catch (again) {
      if (life.aborted) return null;
      if (!holdRefusedSaid) {
        holdRefusedSaid = true;
        const why = (again as Error).message;
        const named = [...dispatches.keys()].find((id) => why.includes(id));
        const who = named
          ? (known.get(named) ?? named)
          : [...dispatches.keys()].map((id) => known.get(id) ?? id).join(", ");
        narrate(`could not hold ${who}'s cursor — ${why}`);
      }
      await sleep(10_000);
      return null;
    }
  };
  void (async () => {
    while (!life.aborted) {
      try {
        let held: RcHoldResponse | null;
        const began = clock.now();
        const holding = [...dispatches.keys()];
        try {
          held = await holdOnce(holding);
        } catch (err) {
          if (!(err instanceof ApiError && err.code === NOT_YOUR_ACTOR) || life.aborted) throw err;
          held = await holdAfterRefusal();
        }
        if (!held) continue;
        holdRefusedSaid = false;
        // Off the hold's path: the next hold goes out now, and what the roll
        // call reads and writes happens beside it, one lap at a time.
        if (!life.aborted) rolling = rolling.then(() => rollCall(holding, began)).catch(() => {});
        /**
         * **The handshake's last hop** (agent-custody mechanism 2): the Web
         * UI's "add an agent" arrives inside the hold, and the host that will
         * answer for the agent makes the same moves `isocan agent add` makes,
         * so the actor is born first-claim on this machine's badge and the
         * relayed face vouches. The web dialog watches for the enroll op to
         * land; a refusal here (a name already worn) is narrated where the
         * rc's person is looking and surfaces at the dialog as its countdown
         * running out.
         */
        for (const ask of held.asks ?? []) {
          // Adding an agent to this machine is its owner's gesture. The
          // home already routes only the owner's asks here; this is the
          // same rule held where the machine is, for a home too old to.
          if (!ownersWord(keeping, ask.from.id, policyState.joined)) {
            narrate(`${ask.from.name} asked from the canvas to add ${ask.name} — this rc takes that only from you; nothing enrolled`);
            continue;
          }
          const via = ask.template ? ` from the template ${ask.template}` : "";
          narrate(`${ask.from.name} asked from the canvas to add ${ask.name}${via} — enrolling here`);
          try {
            await deps.enrol(ask);
          } catch (err) {
            narrate(`could not enrol ${ask.name} — ${(err as Error).message}`);
          }
        }
      } catch {
        if (life.aborted) return;
        await sleep(400);
      }
    }
  })();

  /** One summoned turn: adapter up, session loaded-or-new, presence on
   * while it runs and gone when it ends (journey 2's acceptance — the
   * summoned equivalent of the park's `landPresence`). */
  const runSummons = async (record: EnrolledAgent, dispatch: AgentDispatch): Promise<void> => {
    const entries = dispatch.pending.splice(0);
    const tip = dispatch.scannedTip;
    try {
      await runSummonsInner(record, dispatch, entries, tip);
    } catch (err) {
      // The batch goes back on the shelf: in-process it retries after the
      // pause below; across a crash the un-advanced cursor row redelivers
      // it marked. Either way nothing is silently dropped.
      dispatch.pending.unshift(...entries);
      throw err;
    }
  };

  const runSummonsInner = async (
    record: EnrolledAgent,
    dispatch: AgentDispatch,
    entries: WatchedLogEntry[],
    tip: number,
  ): Promise<void> => {
    const flagged =
      dispatch.redeliverUpTo === null
        ? entries
        : entries.map((e) => (e.seq <= dispatch.redeliverUpTo! ? { ...e, redelivered: true } : e));
    dispatch.redeliverUpTo = null;
    const summoned = flagged.some(
      (e) => e.envelope.op.type === "thread.create" || e.envelope.op.type === "thread.reply",
    );
    const reason = summoned ? "summons" : "change";
    const from = flagged[0]?.envelope.actor.name ?? "someone";
    // Whose word this turn carries, recorded before anything it writes can
    // land — what the gate reads when this agent's replies reach a sibling
    // that listens only to its owner (owner-only summons).
    const authors = flagged.map((e) => e.envelope.actor.id);
    const carried = new Map<string, ReadonlySet<string> | undefined>();
    for (const id of new Set(authors)) carried.set(id, await originsOf(id));
    await state.set(keys.origins(record.actor.id), [...speakersFor(authors, (id) => carried.get(id))]);
    const say = (line: string) => narrate(`${record.actor.name} · ${line}`);
    // The binding (on-demand phase 3): idempotent for CLI-added agents, the
    // one rebinding a web-added one needs. Made before anything is said: an
    // agent another badge holds (dual-held) is not held here, and gets the
    // one line, no turn, and nothing in the thread.
    try {
      await routes.claimActor({
        type: "actor.claim",
        sessionKey: await deps.agentKey(record.actor.name),
        as: record.actor.id,
      });
    } catch (err) {
      if (!heldElsewhere(err)) throw err;
      await standDownNotHeld(record.actor.id);
      return;
    }
    say(`${reason} from ${from}, ${flagged.length} ${flagged.length === 1 ? "entry" : "entries"} — starting a session`);
    try {
      await routes.parkDelivered({
        canvasId: p.id,
        actorId: record.actor.id,
        parkId: dispatch.parkId,
        tip,
      });
    } catch (err) {
      if (err instanceof ApiError && err.code === PARK_ADOPTED_CODE) {
        narrate(`another park adopted ${record.actor.name}'s cursor — standing down for it`);
        dispatches.delete(record.actor.id);
        return;
      }
      throw err;
    }
    const row =
      (await rows.list()).find((r) => r.canvasId === p.id && r.actorId === record.actor.id) ?? {
        canvasId: p.id,
        actorId: record.actor.id,
        name: record.actor.name,
        harness: null,
        cwd: rcCwd,
        sessionId: null,
      };
    const harness = await deps.adapterFor({ ...row, name: record.actor.name });
    // Presence: the summoned session is SEEN — it appears when the turn
    // starts and fades when it ends, because the session ends, not a TTL.
    const firstComment = flagged.find(
      (e) => e.envelope.op.type === "thread.create" || e.envelope.op.type === "thread.reply",
    );
    const face = await routes.createSession(p.id, record.actor, undefined, harness.harness).catch(() => null);
    // Where the summons points, so the face lands somewhere rather than
    // floating unplaced: the summoning thread, or (a routed change) the
    // first changed item. `working` is re-asserted on every beat below —
    // it is what animates the cursor, and each applied op retires it.
    const threadId = firstComment ? (firstComment.envelope.op as { threadId: string }).threadId : null;
    const changedItemId = (flagged[0]?.envelope.op as { itemId?: string }).itemId ?? null;
    let working: PresenceActivity | null = null;
    if (face) {
      const snapshot = await routes.snapshot(p.id).catch(() => null);
      const thread = threadId ? snapshot?.canvas.threads[threadId] : undefined;
      const item = !threadId && changedItemId ? snapshot?.canvas.items[changedItemId] : undefined;
      working = threadId ? { kind: "working", threadId } : item ? { kind: "working", itemId: item.id } : null;
      await routes
        .updateSession(p.id, face.sessionId, {
          status: threadId ? "reading your comment…" : "looking at what changed…",
          statusSource: "lifecycle",
          ...(working ? { activity: working } : {}),
          ...(threadId ? { onThread: threadId } : {}),
          ...(snapshot && thread ? { cursor: threadLocus(snapshot, thread) } : {}),
          ...(item ? { cursor: itemCenter(item) } : {}),
        })
        .catch(() => {});
    }
    const beat = (patch: UpdateSessionRequest): void => {
      if (!face) return;
      void routes.updateSession(p.id, face.sessionId, { actor: record.actor, ...patch }).catch(() => {});
    };
    // A turn's ceiling (10 min) outlives the presence TTL (5), so a face
    // with no beats would be swept away mid-work — the "mostly idle" bug's
    // silent half. The heartbeat is the floor under everything else.
    const heartbeat = new AbortController();
    const endHeartbeat = () => heartbeat.abort();
    life.addEventListener("abort", endHeartbeat, { once: true });
    void (async () => {
      for (;;) {
        await deps.sleep(60_000, heartbeat.signal);
        if (heartbeat.signal.aborted) return;
        beat({});
      }
    })();
    // The host starts the adapter: on the laptop, the session pointer loaned
    // to the agent's own CLI, the fence, and the spawn.
    let agent: RoomAdapter | null = null;
    try {
      agent = await harness.open({
        canvasId: p.id,
        agent: record.actor,
        owner,
        face: face?.sessionId ?? null,
        threadId,
        narrate: say,
      });
      // One session handle per AGENT (standing agents phase 2): a summons on
      // any canvas resumes the same conversation — this row's handle, else the
      // one another room minted for the same actor.
      const storedSession = (await state.get(keys.session(record.actor.id))) as string | undefined;
      const session = await agent.ensureSession(row.cwd, row.sessionId ?? storedSession ?? null);
      await state.set(keys.session(record.actor.id), session.sessionId);
      await rows.setSessionId(p.id, record.actor.id, session.sessionId);
      say(`session ${session.resumed ? "resumed" : "started"} in ${row.cwd}`);
      // The event stream the adapter is already sending, spent on the face:
      // each tool call becomes an inferred status (so it never displaces
      // anything the agent said with `--say`) and re-asserts `working`.
      // Throttled — a busy turn fires tools faster than a status is worth
      // repainting.
      let lastToolBeat = 0;
      const turn = await agent.prompt(
        session.sessionId,
        summonsPrompt(p.title, record.actor.name, { reason, entries: flagged }),
        (event) => {
          if (event.kind === "permission") say(`permission ${event.detail}`);
          if (event.kind === "tool" && event.detail && clock.now() - lastToolBeat >= 2_000) {
            lastToolBeat = clock.now();
            const title = event.detail.length > 80 ? `${event.detail.slice(0, 79)}…` : event.detail;
            beat({
              status: title,
              statusSource: "inferred",
              ...(working ? { activity: working } : {}),
            });
          }
        },
      );
      /**
       * **A turn stopped by withdrawal is not a failed turn.** A turn that
       * ends some other way than `end_turn` under a summons whose agent is
       * already gone is said as that: no failure, no system voice in the
       * thread, nothing held for a retry. A dispatch the withdraw branch
       * already dropped says the same, whatever the stop reason.
       */
      if (!dispatches.has(record.actor.id) || (turn.stopReason !== "end_turn" && (await withdrawnHere(record.actor.id)))) {
        say(`turn stopped — ${record.actor.name} was withdrawn`);
        return;
      }
      say(`turn ended — ${turn.stopReason}`);
      // Completion, explicitly: the room SAW the turn end, so the cursor
      // advances now rather than waiting for the park's inferred evidence.
      await routes
        .parkAdvance({ canvasId: p.id, actorId: record.actor.id, parkId: dispatch.parkId, to: tip })
        .then(() => {
          dispatch.cursor = tip;
        })
        .catch(() => {});
    } finally {
      endHeartbeat();
      life.removeEventListener("abort", endHeartbeat);
      if (agent) await agent.close();
      if (face) await routes.endSession(p.id, face.sessionId).catch(() => {});
    }
  };

  let cursors: Record<string, number> = { [p.id]: 0 };
  const lapFrom = () => {
    // One shared read from the earliest cursor any agent still needs;
    // narration (enrolments, withdrawals) keys off startTip below so old
    // history is never re-told.
    let from = startTip;
    for (const d of dispatches.values()) if (d.scannedTip < from) from = d.scannedTip;
    return from;
  };
  /** Anybody the roster names that this room is not answering for, and has
   * not been told another badge holds: claimed and adopted, the same two
   * things the enrol branch below does. Run on every lap that reads a roster,
   * and once at start (below). */
  const takeUp = async (roster: Record<string, EnrolledAgent>): Promise<void> => {
    for (const record of Object.values(roster)) {
      if (dispatches.has(record.actor.id) || notHeld.has(record.actor.id)) continue;
      known.set(record.actor.id, record.actor.name);
      // The cursor first: an agent this badge does not hold gets no row here.
      const parked = await parkAgent(record.actor.id, await ownRow(record.actor.id));
      if (parked === "not-held") {
        await sayNotHeld(record.actor.id);
        continue;
      }
      /**
       * The SAME two things the enrol branch below does, and the first
       * version of this did only one of them.
       *
       * Claiming a cursor makes the room dispatch to the agent; adopting the
       * row records where and how it runs. An agent picked up here without the
       * adoption has a cursor and no record — which is why the test watching
       * for "· where and how supplied" kept timing out with the fix in
       * place, and it was right to: the line is missing because the RECORD
       * is missing, not because the narration is.
       */
      const adopted = await rows.adopt({
        canvasId: p.id,
        actorId: record.actor.id,
        name: record.actor.name,
        harness: null,
        cwd: rcCwd,
        sessionId: null,
      });
      if (adopted) narrate(`${record.actor.name} · where and how supplied — ${rcCwd}`);
      if (parked !== "held") couldNotHold(record.actor.id, parked.error);
    }
  };
  const startTip = (await routes.watchLog({ only: [p.id] })).cursors[p.id] ?? 0;
  /**
   * **The startup window, closed from both sides.**
   * `opening` was read before this tip, and the enrol and withdraw branches
   * below only read ops above it, so an enrolment or a withdrawal landing
   * between the two was seen by neither. A withdrawal left its row. An
   * enrolment waited for
   * the first lap that read a roster, which on a quiet canvas is the end
   * of a thirty-second poll: `rc.test.ts`'s "a web add gets its rc half"
   * failed on CI twice in three runs of phase 2's commit on exactly that.
   * The roster read now includes both, so it is reaped and taken up here.
   */
  const settled = await rosterOf();
  policyState.roster = settled;
  for (const [id, row] of Object.entries(settled)) known.set(id, row.actor.name);
  await reap(settled);
  for (const actorId of [...dispatches.keys()]) if (!settled[actorId]) dispatches.delete(actorId);
  for (const actorId of [...notHeld]) if (!settled[actorId]) notHeld.delete(actorId);
  await takeUp(settled);
  cursors = { [p.id]: lapFrom() };
  let lastRoster = settled;
  let offlineSince: number | null = null;
  while (!life.aborted) {
    let batch;
    try {
      // A held or busy agent must not wait a full poll window for its
      // next chance: an op is not the only thing that changes the answer
      // — a turn ending does too, and the log says nothing about that.
      const eager = [...dispatches.values()].some((d) => d.busy || d.pending.length > 0);
      batch = await routes.watchLog({ cursors, waitMs: eager ? 2_000 : 30_000, only: [p.id] }, life);
      if (offlineSince !== null) {
        narrate(`daemon back after ${Math.round((clock.now() - offlineSince) / 1000)}s — nothing missed`);
        offlineSince = null;
      }
    } catch (err) {
      if (life.aborted) return;
      // The same pause-not-end rule the park earned: a daemon restart
      // severs the poll under a room that did nothing wrong. The room
      // retries; starting a daemon that is gone is the host's.
      if (err instanceof ApiError) throw err;
      if (offlineSince === null) {
        offlineSince = clock.now();
        narrate("the daemon stopped answering — retrying, and starting it if it is gone");
      }
      await sleep(400);
      continue;
    }
    cursors = batch.cursors;
    // The announcement's heartbeat, every lap (≤30s against a 5-minute
    // TTL) — and re-made when a daemon restart took the session with it.
    if (announced) {
      await routes.updateSession(p.id, announced.sessionId, {}).catch(async () => {
        const again = await routes.createSession(p.id, deps.owner, undefined, undefined, "rc").catch(() => null);
        if (again) {
          announced.sessionId = again.sessionId;
          announce(announced);
        }
      });
    }
    const lapTip = batch.cursors[p.id] ?? 0;
    /**
     * **Also when we are answering for nobody** (7 Sep 2026).
     *
     * The roster is otherwise only re-read on a lap that carried entries,
     * and that leaves the startup window unrecoverable. `opening` is read
     * well before `startTip`; an enrolment landing between them is absent
     * from `opening` AND at or below the tip, so the long-poll delivers
     * nothing for it — no entries, no snapshot, and `lastRoster` stays as the
     * roster that never had them.
     *
     * A room with no dispatches is doing nothing else, so re-reading costs
     * nothing where it matters, and "nobody is enrolled yet" is exactly the
     * state that has to be able to heal itself — the line the room says
     * promises it does.
     */
    const snapshot = batch.entries.length > 0 || dispatches.size === 0 ? await routes.snapshot(p.id) : null;
    // The roster survives quiet laps. The instrumented CI failure that
    // forced this: both agents mid-turn, both replies landing in ONE lap
    // — consumed into pending — and every later lap empty, so a
    // lap-scoped roster read as {} and the dispatch loop below skipped
    // every agent forever.
    if (snapshot) {
      lastRoster = snapshot.canvas.agents ?? {};
      policyState.roster = lastRoster;
      policyState.joined = snapshot.joined;
      policyState.nameOf = nameResolver(snapshot);
      for (const [id, row] of Object.entries(lastRoster)) known.set(id, row.actor.name);
      // A word from somebody this room does not know yet may be a new
      // session on this very machine — its hands are read again first.
      if (batch.entries.some((e) => !ownersWord(keeping, e.envelope.actor.id, snapshot.joined))) {
        await refreshHands();
      }
    }
    const roster = lastRoster;
    /**
     * **Anybody the roster names and nobody has claimed** (6 Sep 2026).
     * Reconciling from the roster closes the startup window whatever the
     * ordering, because it asks the question that actually matters — *is
     * anybody enrolled here that I am not answering for?* — rather than
     * trying to catch every path by which they could have arrived.
     * `parkAgent` returns early when a dispatch exists, so this costs
     * nothing on a settled lap.
     */
    await takeUp(roster);
    for (const entry of batch.entries) {
      const op = entry.envelope.op;
      const by = entry.envelope.actor;
      if (op.type === "agent.enroll") {
        known.set(op.agent.id, op.agent.name);
        if (entry.seq > startTip) {
          // Parked before anything is said or written for it (the lap's
          // take-up above has usually done it already, and this is then
          // nothing). An agent this badge does not hold is not "answerable here".
          const parked = await parkAgent(op.agent.id, await ownRow(op.agent.id), entry.seq);
          if (parked === "not-held") {
            await sayNotHeld(op.agent.id);
            continue;
          }
          // Whose word wakes it, said with the enrolment — a gate changed
          // by `rc listen` arrives as exactly this op.
          const record = roster[op.agent.id];
          narrate(`${by.name} enrolled ${op.agent.name} — answerable here${record ? ` · ${policyLine(record)}` : ""}`);
          if (record) await sayPolicy(record);
          const adopted = await rows.adopt({
            canvasId: p.id,
            actorId: op.agent.id,
            name: op.agent.name,
            harness: null,
            cwd: rcCwd,
            sessionId: null,
          });
          if (adopted) narrate(`${op.agent.name} · where and how supplied — ${rcCwd}`);
          if (parked !== "held") couldNotHold(op.agent.id, parked.error);
        }
        continue;
      }
      if (op.type === "agent.withdraw" && entry.seq > startTip && notHeld.delete(op.actorId)) {
        // An agent this machine does not hold, withdrawn: nothing here
        // answered it.
        continue;
      }
      if (op.type === "agent.withdraw" && entry.seq > startTip) {
        const name = known.get(op.actorId) ?? op.actorId;
        narrate(`${by.name} dismissed ${name} — no longer answering here`);
        await rows.remove(p.id, op.actorId);
        dispatches.delete(op.actorId);
        rolls.delete(op.actorId);
        await state.delete(keys.session(op.actorId));
        continue;
      }
      // Route to every enrolled agent whose composition matches — the
      // same `dispatchReason` a `wait` park applies.
      for (const record of Object.values(roster)) {
        const dispatch = dispatches.get(record.actor.id);
        if (!dispatch || entry.seq <= dispatch.scannedTip) continue;
        const joined = snapshot?.joined;
        // An agent this room runs speaks with the word of whoever started
        // its turn (`origins`), so a stranger turned away here is not let in
        // one hop later by an open sibling's reply.
        const carried = await originsOf(by.id);
        const agent = {
          actorId: record.actor.id,
          names: [{ id: record.actor.id, name: record.actor.name }],
          rules: rulesOf(record.rules),
          policy: policyOf(record),
          hands: keeping.hands,
          ...(joined ? { joined } : {}),
          ...(carried && carried.size > 0 ? { onBehalfOf: [...carried] } : {}),
        };
        const reason = dispatchReason(op, by.id, agent, snapshot?.canvas ?? null);
        if (reason) {
          dispatch.pending.push(entry);
          continue;
        }
        /**
         * **Turned away, in words** (owner-only summons). A mention the
         * gate refused is answered in the thread by the system voice —
         * never the agent's (it did not run) and never silence. Once per
         * thread, asker and agent — kept under `state`, so a room that
         * persists it does not narrate it again — and not again in the thread
         * if the thread already says it. Nothing is pending, nothing counts
         * against the ceiling, and nothing was spent.
         */
        if (turnedAway(op, by.id, agent) && (op.type === "thread.create" || op.type === "thread.reply")) {
          const key = keys.turnedAwaySaid(p.id, `${op.threadId} ${by.id} ${record.actor.id}`);
          if (await state.get(key)) continue;
          await state.set(key, true);
          const nameOf = snapshot ? nameResolver(snapshot) : (id: string) => known.get(id);
          // Through an agent, the asker is whoever that agent speaks for.
          const askers = agent.onBehalfOf
            ? agent.onBehalfOf.filter((id) => !mayWake(agent.policy, id, joined, keeping.hands)).map((id) => nameOf(id) ?? id)
            : [by.name];
          const asker = askers.join(",") || by.name;
          // A grant that ran out refuses in the same words as a gate that
          // never had one, plus the one clause that says which this is.
          const askerIds = agent.onBehalfOf ?? [by.id];
          const ran = askerIds.map((id) => lapsedFor(agent.policy, id, joined)).find((at) => at !== undefined);
          const line = turnedAwayLine(record.actor.name, agent.policy, nameOf, asker, { lapsed: ran });
          const already = snapshot?.canvas.threads[op.threadId]?.comments.some(
            (c) => isSystemActor(c.author.id) && c.body === line,
          );
          const who = agent.onBehalfOf ? `${by.name}, for ${askers.join(" and ")},` : by.name;
          narrate(`${record.actor.name} · ${who} asked; ${policyLine(record)} — said so in the thread, nothing started`);
          if (!already) await sayInThread(op.threadId, line);
        }
      }
    }
    // Every agent has now been shown everything up to the lap tip — the
    // evaluated watermark moves for busy agents too, or a long turn would
    // re-read (and re-queue) the same entries every lap. The park ROW
    // settles only for quiet, idle agents; a busy agent's row advances at
    // its turn's end.
    for (const [actorId, dispatch] of dispatches) {
      const before = dispatch.scannedTip;
      dispatch.scannedTip = Math.max(dispatch.scannedTip, lapTip);
      if (!dispatch.busy && dispatch.pending.length === 0 && dispatch.scannedTip > before) {
        await routes
          .parkAdvance({ canvasId: p.id, actorId, parkId: dispatch.parkId, to: dispatch.scannedTip })
          .then(() => {
            dispatch.cursor = dispatch.scannedTip;
          })
          .catch(() => {});
      }
    }
    for (const [actorId, dispatch] of dispatches) {
      if (dispatch.busy || dispatch.pending.length === 0) continue;
      if (clock.now() < dispatch.retryAfter) continue;
      const record = roster[actorId];
      if (!record) continue;

      /**
       * **A limit and a reason** (on-demand phase 5). The decision is
       * `gateTurn` — pure arithmetic, unit-tested — and this loop only
       * gathers the inputs and obeys: every hold leaves its trace where
       * somebody is looking (the system voice in the thread, the same fact
       * in the narration, once per hold), and nothing is dropped — a held
       * batch stays pending and dispatches the moment the limit lifts.
       */
      const enrolledIds = new Set(Object.keys(roster));
      const hasPersonWord = dispatch.pending.some(
        (e) => !enrolledIds.has(e.envelope.actor.id) && !isSystemActor(e.envelope.actor.id),
      );
      const guard = await guardOf(actorId);
      const wasHeld = guard.held !== null;
      const verdict = gateTurn(guard, hasPersonWord, { turnsPerHour: TURNS_PER_HOUR, agentChain: AGENT_CHAIN }, clock.now());
      await state.set(keys.guard(actorId), guard);
      if (verdict.verdict === "hold-cycle") {
        if (verdict.announce) {
          const line = `${record.actor.name} paused after ${guard.agentChain} agent-to-agent ${guard.agentChain === 1 ? "turn" : "turns"} with no person in the conversation — a human word resumes it.`;
          narrate(`${line}`);
          await sayInThread(threadOf(dispatch.pending), line);
        }
        continue;
      }
      if (verdict.verdict === "hold-ceiling") {
        dispatch.retryAfter = verdict.retryAfter;
        if (verdict.announce) {
          const line = `${record.actor.name} is at its ceiling — ${TURNS_PER_HOUR} turns in the past hour. This summons waits (about ${Math.max(1, Math.round((verdict.freesAt - clock.now()) / 60_000))} min).`;
          narrate(`${line}`);
          await sayInThread(threadOf(dispatch.pending), line);
        }
        continue;
      }
      if (wasHeld) {
        narrate(`${record.actor.name}'s hold lifted — dispatching what waited`);
      }
      const failedThread = threadOf(dispatch.pending);
      dispatch.busy = true;
      void runSummons(record, dispatch)
        .catch(async (err) => {
          // Withdrawn under the turn: not a failure, and nothing is held for
          // a retry.
          if (await withdrawnHere(actorId)) {
            dispatch.pending.length = 0;
            narrate(`${record.actor.name} · turn stopped — ${record.actor.name} was withdrawn`);
            return;
          }
          // Held by the host, not failed: its sentence, and its time to ask
          // again. The batch is not advanced, as under the guard's ceiling.
          if (err instanceof RoomHold) {
            narrate(`${record.actor.name} · turn held — ${err.line}`);
            await sayInThread(failedThread, err.line);
            dispatch.retryAfter = err.retryAfter;
            return;
          }
          // Silence surfaced (journey 5): the failure reaches the thread
          // it failed FOR, in the system voice — never as the agent, which
          // never ran, and never silently. The batch is not advanced; a
          // minute's pause keeps a broken adapter off a hot loop.
          const why = (err as Error).message;
          narrate(`${record.actor.name} · turn FAILED — ${why} (retrying in 60s)`);
          await sayInThread(
            failedThread,
            `${record.actor.name} couldn't answer — ${why}. The summons is held and will be retried; \`isocan rc\`'s log has the detail.`,
          );
          dispatch.retryAfter = clock.now() + 60_000;
        })
        .finally(() => {
          dispatch.busy = false;
        });
    }
  }
}
