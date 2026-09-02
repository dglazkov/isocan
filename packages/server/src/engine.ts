import { createHash } from "node:crypto";
import type {
  Actor,
  ActorBindingRecord,
  ActorClaim,
  ActorClaimOp,
  ActorColors,
  ActorJoinOp,
  ActorJoins,
  ActorMarks,
  ActorNames,
  ActorRegistry,
  ActorSetColorOp,
  ActorSetMarkOp,
  CanvasSnapshotResponse,
  ClaimContext,
  LogEntry,
  NameHolder,
  OpEnvelope,
  Operation,
  PresenceSession,
  Canvas,
  CanvasState,
  ServerMessage,
  SlashCommand,
  UploadTicket,
} from "@isocan/core";
import {
  INTERNAL_OP_TYPES,
  OplogFencedError,
  OpValidationError,
  DEFAULT_COMMANDS,
  actorAliases,
  actorColors,
  actorJoins,
  actorMarks,
  actorNames,
  allocateName,
  applyActorColor,
  applyActorJoin,
  applyActorMark,
  mergeCommands,
  applyClaim,
  applyOperation,
  bindHandoff,
  bindName,
  claimsActor,
  collectCanvasNames,
  invertOperation,
  isSystemActor,
  newOpId,
  notBothActors,
  notYourActor,
  resolveActor,
  positionIsMeaningful,
  resolvePlacement,
  SHELF,
} from "@isocan/core";
import type { BlobUploadRequest, Store } from "./store.ts";
import type { Desk } from "./desk.ts";
import { admittingGrant, ensureHomeLinkGrant, ensureLinkGrant } from "./grants.ts";
import type { HomeConnection, HomeDirectory } from "./home-link.ts";
import { UndoStacks } from "./undo.ts";
import {
  DEFAULT_GRACE_MS,
  DEFAULT_KEEP_OPS,
  chooseRetained,
  reachableHashes,
  type GcOptions,
  type GcReport,
} from "./gc.ts";

/**
 * The session key `freeName` asks with. A claim context is gathered for a
 * specific key, and this question is asked for nobody in particular — so it is
 * asked under a key no client can send. Clients namespace theirs by harness
 * (`claude-code:s-1`, `codex:s-2`); the leading space here is not a
 * namespace anything can produce, and matching no row is the whole point.
 */
const FREE_NAME_PROBE = " free-name probe";

/**
 * **How long a claim on THIS badge is presumed to be about to go live.**
 *
 * `wornLive` answers "is somebody working as this actor" with presence, which
 * is the real question and needs no clock. The gap it cannot see is the
 * moment between claiming a name and reaching a canvas: for a second or two
 * an agent is nobody's face and is about to be somebody's.
 *
 * A minute covers that gap with room. Thirty minutes — what
 * `CLAIM_STANDS_MS` gives a claim on ANOTHER badge, where liveness is
 * invisible and the caution is right — was what made `identity --as`
 * unusable for the reincarnation `--agent-help` documents (#89): a harness
 * hands each conversation a new session key, so a fresh conversation on the
 * same machine was told it "is somebody else here" for half an hour, after a
 * clean `session end`, with the old agent demonstrably gone.
 */
const OWN_CLAIM_FRESH_MS = 60_000;

/** Is this claim recent enough to be an agent that has not reached a canvas
 *  yet, rather than one that is gone? */
function fresh(boundAt: string, now: string): boolean {
  return Date.parse(now) - Date.parse(boundAt) < OWN_CLAIM_FRESH_MS;
}

/**
 * How far a name question may see, gathered in `claimContext`.
 *
 * - `"admitted"` — the rooms this badge has actually been let into (plus, for
 *   a claim, the one room it names, if a grant would admit it). What a CLAIM
 *   is judged in: a claim is judged where it is made.
 * - `"admissible"` — those, plus every canvas a grant would admit this badge
 *   to. What ALLOCATION asks in, because the badge doing the asking has
 *   typically been nowhere yet. The door's own test, asked without opening
 *   the door; `claimContext` says why, and where the same trick is already
 *   played.
 */
type NameReach = "admitted" | "admissible";

interface CanvasRuntime {
  state: CanvasState;
  lastSeq: number;
  entries: LogEntry[];
  undo: UndoStacks;
}

/** What a teleport did, or would do. */
export interface TeleportReport {
  canvasId: string;
  to: string;
  entries: number;
  blobs: number;
  bytes: number;
  /** False for a dry run, and for nothing else. */
  moved: boolean;
}

interface ActorsRuntime {
  registry: ActorRegistry;
  lastSeq: number;
}

export interface EngineOptions {
  /** Who is visibly on a canvas right now — presence, which lives outside
   * the engine. Claims consult it so a live face holds its name. */
  liveness?: (canvasId: string) => PresenceSession[];
}

export class CanvasNotFoundError extends Error {
  constructor(id: string) {
    super(`canvas not found: ${id}`);
    this.name = "CanvasNotFoundError";
  }
}

export class NothingToUndoError extends Error {
  constructor(kind: "undo" | "redo", actorName?: string) {
    super(actorName ? `nothing to ${kind} for ${actorName}` : `nothing to ${kind}`);
    this.name = "NothingToUndoError";
  }
}

export interface SubmitRequest {
  canvasId: string | null;
  actor: Actor;
  clientId?: string;
  /** The client's own name for this op — the idempotency key. See
   * `PostOpRequest.opId` in core for what it is for, and `alreadyWritten`
   * below for what the engine does with it. */
  opId?: string;
  /** **One gesture, one undo** — see `LogEntry.group`. Carried through to the
   *  entry, and read by `UndoStacks` when deciding what one ⌘Z reverses. */
  group?: string;
  /**
   * **Where this canvas is being born** — meaningful for `project.create`
   * alone, and refused by the route on anything else (phase 10.3).
   *
   * See `PostOpRequest.home` in core for the whole argument. The short version
   * is that it is WRITE-ONCE and about one canvas: it establishes a row for a
   * canvas coming into existence and can never re-point one that already
   * exists, because a second create for an existing id is `duplicate-id` or a
   * replay. That bound is what makes it safe as request metadata beside `opId`
   * and `clientId` rather than a `--home` flag on every verb, which phase 7.5
   * refused and phase 10.3 goes on refusing.
   */
  home?: string;
  op: Operation;
  /**
   * The badge that presented this request — resolved by the transport and
   * handed to the engine BESIDE the request, never inside it (mechanism 5).
   *
   * It stops here. `envelope()` builds the log entry field by field and this
   * is not one of them: the oplog is shared state every replica sees, and
   * which badge issued which op is the home's private audit, not the canvas's
   * history. Same instinct as "the oplog never records grants".
   */
  badgeId: string;
}

export interface ClaimRequest {
  op: ActorClaimOp;
  clientId?: string;
  /** The badge presenting the claim. `actor.claim` is "add an actor to THIS
   * badge's claims", so the transport has to say which badge. */
  badgeId: string;
}

type EventListener = (canvasId: string, message: ServerMessage) => void;

/**
 * An entry as it arrives from a home — a `LogEntry` whose `inverse` may not be
 * known yet.
 *
 * Two shapes reach a replica for the SAME entry: the WS broadcast carries the
 * whole `LogEntry` the home built (inverse and cause included), while
 * `POST /api/ops` answers with `{ seq, envelope }` only. The second is
 * complete enough: the inverse is `invertOperation` of the op against the
 * pre-state, the reducer is the same reducer on both machines, and the entry
 * is only ever applied when the local state IS the pre-state (see
 * `applyRemoteEntry`'s contiguity guard) — so recomputing it produces the
 * bytes the home produced. That is the isomorphism contract doing work rather
 * than being admired.
 */
type IncomingEntry = Omit<LogEntry, "inverse"> & { inverse?: Operation | null };

/** What `applyRemoteEntry` did, so the caller knows whether to resync.
 * "skipped" is the ordinary case, not an error: the POST answer and the
 * broadcast are the same entry arriving twice. */
export type RemoteApply = "applied" | "skipped" | "gap";

/**
 * The single op engine. ALL mutations — from the CLI, the web app, and
 * undo/redo — funnel through one promise chain, giving single-writer
 * discipline over both the in-memory state and the files.
 *
 * Per mutation: validate → invert (from pre-state) → apply → append+fsync
 * oplog → atomically rewrite snapshots → broadcast.
 */
export class Engine {
  private canvases = new Map<string, CanvasRuntime>();
  private actorsRuntime: ActorsRuntime | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private listeners = new Set<EventListener>();
  private colorListeners = new Set<(colors: ActorColors, actorId: string) => void>();

  /**
   * The homes this engine is a REPLICA of, per canvas — empty (or null) when
   * this daemon is the home of everything it holds.
   *
   * This one field is the demotion, and phase 10.3 made the demotion **per
   * canvas** rather than per daemon: for a canvas whose row names a home, the
   * engine stops being a writer — the mutation is forwarded, that home assigns
   * the seq, and what comes back is applied here VERBATIM through
   * `applyRemoteEntry`. For a canvas with no row, this daemon IS the home and
   * nothing changes at all. Both kinds of canvas can sit in one store, which
   * is the whole of the phase.
   *
   * The single-writer promise chain below is untouched and still does exactly
   * what it always did — it serializes forwarded writes and arriving entries
   * against each other instead of serializing writes against writes. There is
   * still exactly one thing mutating this daemon's state at a time; what
   * changed is who decides the order, and (now) that the answer to "who"
   * depends on which canvas.
   */
  private homes: HomeDirectory | null = null;

  constructor(
    private readonly store: Store,
    /** The desk. The engine writes the claims half through it and never
     * touches the transport's half (badges, secrets, admissions). */
    private readonly desk: Desk,
    private readonly options: EngineOptions = {},
  ) {}

  /**
   * Point this engine at its homes — the composition root's last wire, set in
   * `startDaemon` before the port is bound, so no request can ever see the
   * engine half-demoted.
   *
   * A setter rather than a constructor argument because the two objects need
   * each other: a home connection applies what it receives THROUGH the engine,
   * and the engine forwards what it is asked THROUGH the connection.
   * Constructing one with the other would be a cycle; one setter at the
   * composition root is the honest cut.
   *
   * It keeps its name under phase 10.3's widening from one connection to a
   * directory, because it still reads correctly — this is still where the
   * engine is told there is somewhere else to send things — and every word of
   * the reasoning above survives with `home` reading `homes`.
   */
  forwardTo(directory: HomeDirectory | null): void {
    this.homes = directory;
  }

  /** Subscribe to canvas events; returns an unsubscribe function. */
  onEvent(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(canvasId: string, message: ServerMessage): void {
    for (const listener of this.listeners) listener(canvasId, message);
  }

  /**
   * Resolves when everything currently on the single-writer chain has run.
   *
   * The replica needed it and the reason is worth keeping: a forwarded write
   * holds the chain across its HTTP round trip, so between "the home has
   * created this canvas" and "this daemon has written it down" there is a real
   * window — and the home connection's dial, which asks the store how far it
   * has got, was reading that store MID-WRITE. It presented `since=0` for a
   * canvas it was in the middle of creating, was correctly answered with a
   * snapshot, and adopted it over the entry that was one line from landing.
   * Waiting for the chain to drain makes the cursor a fact rather than a
   * guess, and it is the same discipline every other reader here already has
   * — it just had no name.
   */
  settled(): Promise<void> {
    return this.enqueue(async () => {});
  }

  /** Serialize all mutations through one chain. */
  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const result = this.queue.then(work);
    this.queue = result.catch(() => {});
    return result;
  }

  async listCanvases(): Promise<Canvas[]> {
    return this.store.listCanvases();
  }

  async getSnapshot(canvasId: string): Promise<CanvasSnapshotResponse> {
    const runtime = await this.runtime(canvasId);
    return {
      project: runtime.state.project,
      canvas: runtime.state.canvas,
      lastSeq: runtime.lastSeq,
      colors: await this.actorColors(),
      names: await this.actorNames(),
      joined: await this.actorJoins(),
    };
  }

  /** Chosen identity colors, actor id → hex. Everything absent is derived
   * from the id, so this map is only ever the exceptions — plus one row per
   * folded actor, wearing the person's colour (multi-identity phase 5). */
  async actorColors(): Promise<ActorColors> {
    const { registry } = await this.actors();
    return actorColors(registry);
  }

  /** Actors folded into others, old id → new id (`actor.join`). */
  async actorJoins(): Promise<ActorJoins> {
    const { registry } = await this.actors();
    return actorJoins(registry);
  }

  /**
   * Presence as a reader should see it after a join (multi-identity phase
   * 5): a session still beating under a folded id is the person it was
   * folded into, so the facepile draws one face and `isocan who` lists one
   * name. The session keeps its id, kind, label and status; only the actor
   * is resolved, and only on the way out — the beat itself is checked
   * against the badge's claims on the id it actually presented.
   */
  async resolveSessions(sessions: PresenceSession[]): Promise<PresenceSession[]> {
    const { registry } = await this.actors();
    const joined = registry.joined ?? {};
    if (Object.keys(joined).length === 0) return sessions;
    return sessions.map((session) => {
      const id = resolveActor(joined, session.actor.id);
      if (id === session.actor.id) return session;
      const name = registry.names[id]?.name ?? session.actor.name;
      return { ...session, actor: { id, name } };
    });
  }

  /**
   * Every slash command available here: what isocan ships with, laid under
   * whatever this home has written. The menu, the CLI, and an agent looking up
   * what `/format` means all read this one list, or they would disagree about
   * what a command does — which is the only thing a command must never do.
   */
  async commands(): Promise<SlashCommand[]> {
    return mergeCommands(DEFAULT_COMMANDS, await this.store.loadCommands());
  }

  /** Write a command for this home. Shadowing a built-in is allowed and is
   * the point: `rm` gives ours back. */
  async saveCommand(name: string, text: string): Promise<void> {
    await this.store.saveCommand(name, text);
  }

  /** Remove a home command. False when there was no file to remove. */
  async deleteCommand(name: string): Promise<boolean> {
    return this.store.deleteCommand(name);
  }

  /** The name every actor goes by now, actor id → name. What a client shows
   * instead of the name stamped on a comment when it was written. */
  async actorNames(): Promise<ActorNames> {
    const { registry } = await this.actors();
    return actorNames(registry);
  }

  /** The mark each actor wears instead of an initial. */
  async actorMarks(): Promise<ActorMarks> {
    const { registry } = await this.actors();
    return actorMarks(registry);
  }

  /**
   * Choosing the color you wear. Home-scoped like a claim: it lands in the
   * actors log, updates the registry, and is not undoable.
   *
   * BOTH actors are checked, and they are two different assertions: `actor`
   * is who is speaking and `op.actorId` is whose face changes. A badge may
   * repaint only actors it claims — a color is the actor's own choice, and
   * choosing it for somebody else is exactly the impersonation mechanism 5
   * exists to stop.
   */
  setActorColor(request: {
    op: ActorSetColorOp;
    actor: Actor;
    clientId?: string;
    badgeId: string;
  }): Promise<LogEntry> {
    return this.enqueue(async () => {
      await this.requireActor(request.badgeId, request.actor.id);
      if (request.op.actorId !== request.actor.id) {
        await this.requireActor(request.badgeId, request.op.actorId);
      }
      /**
       * A color is the actor's own, home-scoped, and every screen that paints
       * that face is at a home — so on a replica it goes up first and is
       * applied here after. It does not come back down: the actors log is
       * home-scoped and `/ws` is per canvas, so nothing replicates it. What
       * brings it to the other replicas is `mergeRemoteIdentity`, off the
       * `colors` map every snapshot, resume and roster already carries.
       *
       * **Every home, not one** (phase 10.3), and that follows directly from
       * the sentence above rather than being a new policy. The actors log is
       * home-scoped and never replicates down, so this face exists separately
       * at each home it has ever appeared at — telling one of them would leave
       * the other painting the old colour forever, on the same person, with
       * nothing to correct it.
       *
       * Best-effort and in parallel, per home. A colour is a preference: one
       * home being unreachable must not refuse a repaint the person can see
       * happening locally the moment this returns.
       */
      const homes = this.homes?.all() ?? [];
      if (homes.length > 0) {
        await Promise.allSettled(
          homes.map((home) =>
            home.submitOp({
              canvasId: null,
              actor: request.actor,
              op: request.op,
              ...(request.clientId !== undefined ? { clientId: request.clientId } : {}),
            }),
          ),
        );
      }
      const runtime = await this.actors();
      const ts = new Date().toISOString();
      const registry = applyActorColor(runtime.registry, request.op);
      const envelope: OpEnvelope = {
        id: newOpId(),
        canvasId: null,
        actor: request.actor,
        ...(request.clientId !== undefined ? { clientId: request.clientId } : {}),
        ts,
        op: request.op,
      };
      const seq = runtime.lastSeq + 1;
      const entry: LogEntry = { seq, envelope, inverse: null };
      await this.appendActorsOrFence(entry);
      runtime.registry = registry;
      runtime.lastSeq = seq;
      await this.store.saveActors(registry, seq);
      this.identityChanged(actorColors(registry), request.op.actorId);
      return entry;
    });
  }

  /**
   * Choosing the mark you wear instead of an initial. The colour's twin in
   * every respect — home-scoped, lands in the actors log, not undoable, both
   * actors checked because choosing a face for somebody else is exactly the
   * impersonation mechanism 5 exists to stop — and forwarded to every home
   * for the same reason: the actors log never replicates down, so a home not
   * told keeps drawing the old face forever with nothing to correct it.
   *
   * **What it does NOT do yet, said plainly:** there is no live broadcast. A
   * colour has `onColors`, which repaints open canvases the moment it
   * changes; a mark reaches other people's screens on their next read of the
   * registry — a reload, or opening a canvas. Your own screen updates at
   * once. That is a real limitation rather than a hidden one, and the fix is
   * a broadcast carrying both facts rather than a second one carrying this.
   */
  setActorMark(request: {
    op: ActorSetMarkOp;
    actor: Actor;
    clientId?: string;
    badgeId: string;
  }): Promise<LogEntry> {
    return this.enqueue(async () => {
      await this.requireActor(request.badgeId, request.actor.id);
      if (request.op.actorId !== request.actor.id) {
        await this.requireActor(request.badgeId, request.op.actorId);
      }
      const homes = this.homes?.all() ?? [];
      if (homes.length > 0) {
        await Promise.allSettled(
          homes.map((home) =>
            home.submitOp({
              canvasId: null,
              actor: request.actor,
              op: request.op,
              ...(request.clientId !== undefined ? { clientId: request.clientId } : {}),
            }),
          ),
        );
      }
      const runtime = await this.actors();
      const registry = applyActorMark(runtime.registry, request.op);
      const envelope: OpEnvelope = {
        id: newOpId(),
        canvasId: null,
        actor: request.actor,
        ...(request.clientId !== undefined ? { clientId: request.clientId } : {}),
        ts: new Date().toISOString(),
        op: request.op,
      };
      const seq = runtime.lastSeq + 1;
      const entry: LogEntry = { seq, envelope, inverse: null };
      await this.appendActorsOrFence(entry);
      runtime.registry = registry;
      runtime.lastSeq = seq;
      await this.store.saveActors(registry, seq);
      return entry;
    });
  }

  /**
   * **Two actors become one person** (`actor.join`, multi-identity phase 5).
   * The colour's and the mark's sibling in every mechanical respect:
   * home-scoped, lands in the actors log, replays on load, not undoable, and
   * forwarded to every home because the actors log never replicates down.
   *
   * **The claim check is the whole authorization**: the presenting badge must
   * claim BOTH actors, through `claimsActor`, or the op is refused with
   * `bad-join`. That is exactly what journey 6 leaves a laptop holding after
   * it proved its address and became Dimitri — its own claim on `Dimitri 2`
   * and its vouched claim on Dimitri — and it means no stranger can fold
   * anybody into anybody. The speaker is checked too, as on every write.
   *
   * On success the rooms where `from` appears are repainted, because that is
   * where the comments now wearing the wrong name are.
   */
  joinActors(request: {
    op: ActorJoinOp;
    actor: Actor;
    clientId?: string;
    badgeId: string;
  }): Promise<LogEntry> {
    return this.enqueue(async () => {
      await this.requireActor(request.badgeId, request.actor.id);
      const { from, into } = request.op;
      const claims = await this.desk.claimsOf(request.badgeId);
      for (const id of [from, into]) {
        if (!claimsActor(claims, id)) throw notBothActors(from, into, id);
      }
      const homes = this.homes?.all() ?? [];
      if (homes.length > 0) {
        await Promise.allSettled(
          homes.map((home) =>
            home.submitOp({
              canvasId: null,
              actor: request.actor,
              op: request.op,
              ...(request.clientId !== undefined ? { clientId: request.clientId } : {}),
            }),
          ),
        );
      }
      const runtime = await this.actors();
      const registry = applyActorJoin(runtime.registry, request.op);
      const envelope: OpEnvelope = {
        id: newOpId(),
        canvasId: null,
        actor: request.actor,
        ...(request.clientId !== undefined ? { clientId: request.clientId } : {}),
        ts: new Date().toISOString(),
        op: request.op,
      };
      const seq = runtime.lastSeq + 1;
      const entry: LogEntry = { seq, envelope, inverse: null };
      await this.appendActorsOrFence(entry);
      runtime.registry = registry;
      runtime.lastSeq = seq;
      await this.store.saveActors(registry, seq);
      this.identityChanged(actorColors(registry), from);
      return entry;
    });
  }

  /**
   * Told when identity changes — a color chosen, or a name taken — so live
   * canvases can repaint their faces and re-letter what people said.
   *
   * The listener is told WHICH ACTOR changed, and that is mechanism 10's one
   * behavioral narrowing: a color travels with its actor (global, per actor),
   * but the BROADCAST does not. This used to flood every room on the home;
   * the transport now asks `appearances()` which of its open rooms that actor
   * is actually in, and repaints those. On a solo home that is every room it
   * was before; on a multi-tenant one it is the difference between a repaint
   * and a roster leak.
   */
  onColors(listener: (colors: ActorColors, actorId: string) => void): () => void {
    this.colorListeners.add(listener);
    return () => this.colorListeners.delete(listener);
  }

  private identityChanged(colors: ActorColors, actorId: string): void {
    for (const listener of this.colorListeners) listener(colors, actorId);
  }

  /**
   * Which of these canvases that actor APPEARS on — the rooms a color change
   * or a rename has any business repainting (mechanism 10).
   *
   * Appearance is deliberately wider than presence. A rename has to reach the
   * comments the renamed actor wrote before it, in rooms where nobody by that
   * name is currently connected — so history counts: the canvas's authors,
   * every name the canvas remembers, and the live roster.
   */
  async appearances(actorId: string, canvasIds: Iterable<string>): Promise<string[]> {
    const found: string[] = [];
    for (const canvasId of canvasIds) {
      let state: CanvasState;
      try {
        state = (await this.runtime(canvasId)).state;
      } catch {
        continue; // a canvas mid-delete has nobody on it
      }
      const here =
        state.project.createdBy.id === actorId ||
        state.project.updatedBy.id === actorId ||
        collectCanvasNames(state.canvas).some((known) => known.id === actorId) ||
        (this.options.liveness?.(canvasId) ?? []).some((s) => s.actor.id === actorId);
      if (here) found.push(canvasId);
    }
    return found;
  }

  /**
   * Mechanism 5's membership check, at the one place the claims registry
   * lives. Public because presence beats are checked too and presence does
   * not live on this chain; the op paths call it INSIDE their queued work, so
   * a claim and an op racing serialize like everything else.
   */
  async requireActor(badgeId: string, actorId: string): Promise<void> {
    if (claimsActor(await this.desk.claimsOf(badgeId), actorId)) return;
    throw notYourActor(actorId);
  }

  /**
   * **How far this canvas has actually got** — the number a tab compares its
   * own cursor against to find out it has stopped hearing (#85).
   *
   * Read from the runtime rather than counted along the broadcast path, and
   * that is the whole point: the failure this answers is broadcasts stopping
   * while the socket stays up, so a tip derived from the thing that stopped
   * would agree with the tab and confirm the freeze.
   *
   * Returns null for a canvas this home cannot produce, because a beat is not
   * the place to raise: the socket is fine, and a heartbeat that threw would
   * take down the one mechanism that is supposed to be steady.
   */
  async tipSeq(canvasId: string): Promise<number | null> {
    try {
      return (await this.runtime(canvasId)).lastSeq;
    } catch {
      return null;
    }
  }

  /**
   * **Send a canvas to another home** — the move half, and a dry run of it.
   *
   * `docs/research/2026-09-01-teleport.md` is the argument. The short form:
   * the log IS the canvas, the reducer is deterministic, so a home holding
   * the same entries holds the same canvas. This is not a data migration, it
   * is a replay — and the order below is chosen so that anything failing
   * before the last step leaves the canvas exactly where it was.
   *
   *   1. bytes — content-addressed, so sending them twice is free
   *   2. the log — verbatim, via `adopt`, which refuses a canvas that exists
   *   3. the routing row — this daemon stops being the home and starts
   *      forwarding, which is what makes it a MOVE rather than a copy
   *
   * Two things deliberately do not travel, and the report says so rather
   * than leaving them to be discovered:
   *
   * **The grants.** Who may enter is a decision about a PLACE, and the new
   * home is a different place with a different operator. A teleport that
   * quietly recreated "anyone with the link can enter" would have widened
   * access without anybody saying so.
   *
   * **The actor registry.** Names, colours and marks are home-scoped and
   * never replicate; the receiving home knows these actors only by what is
   * stamped on their ops. People arrive under the name they had when they
   * wrote, which is a real loss and a visible one.
   */
  teleport(
    canvasId: string,
    toHomeUrl: string,
    options: { dryRun: boolean },
  ): Promise<TeleportReport> {
    return this.enqueue(async () => {
      const already = this.homes?.for(canvasId) ?? null;
      if (already !== null) {
        throw new OpValidationError(
          "bad-op",
          `${canvasId} is not homed here — it belongs to ${already.homeUrl}, and only its home can send it`,
        );
      }
      const link = this.homes?.linkFor(toHomeUrl) ?? null;
      if (!link) {
        throw new OpValidationError("bad-op", `this daemon dials no homes, so it cannot send one`);
      }
      const runtime = await this.runtime(canvasId);
      const archived = await this.store.readArchivedLog(canvasId);
      const entries = [...archived, ...runtime.entries].sort((a, b) => a.seq - b.seq);
      const blobs = await this.store.listBlobs(canvasId);
      const bytes = blobs.reduce((n, b) => n + b.meta.size, 0);
      const report: TeleportReport = {
        canvasId,
        to: link.homeUrl,
        entries: entries.length,
        blobs: blobs.length,
        bytes,
        moved: false,
      };
      if (options.dryRun) return report;

      // Bytes first: an item whose blob has not arrived is the "blob not
      // found" this project has already paid for once.
      for (const blob of blobs) {
        if ((await link.hasBlob(canvasId, blob.hash)) === true) continue;
        const stream = await this.store.openBlob(canvasId, blob.hash);
        if (!stream) continue;
        const chunks: Buffer[] = [];
        for await (const chunk of stream) chunks.push(chunk as Buffer);
        await link.putBlob(canvasId, Buffer.concat(chunks), {
          mimeType: blob.meta.mimeType,
          filename: blob.meta.filename,
        });
      }
      await link.adopt(canvasId, entries);
      // Last, and only once the far end holds everything: from here this
      // daemon is a replica, and every client that asks it is forwarded.
      await this.homes?.bind(canvasId, link.homeUrl);
      return { ...report, moved: true };
    });
  }

  /**
   * **Take a canvas whole, as somebody else's log** — the receiving half of a
   * teleport.
   *
   * A canvas IS its log: the snapshot is what you get by folding it, and the
   * reducer is deterministic, so a home holding the same entries holds the
   * same canvas. This writes them VERBATIM — same seq, same `ts`, same
   * envelope — which is the whole reason it exists rather than a loop over
   * `submitOp`.
   *
   * Replaying through the ordinary write path would look equivalent and
   * quietly is not. `PostOpRequest` carries no timestamp, deliberately: a
   * client that stamps its own time is a client that can lie about when
   * something happened. So a replayed canvas would arrive with every comment,
   * every version and every item dated at the moment of the move — the order
   * intact and the history erased. Seqs would survive by luck (an empty
   * canvas numbers 1..N the same way), but times would not, and nobody would
   * notice until they looked at a thread.
   *
   * **Only into nothing.** This refuses a canvas that already exists here,
   * which keeps the surface narrow: it can create, never overwrite, so no
   * sequence of calls to it can damage a canvas anybody is using. Moving a
   * canvas ONTO a home that has it is not a teleport, it is a merge, and
   * merging two orders is the thing `docs/research/2026-09-01-teleport.md`
   * argues is a different product.
   */
  adopt(canvasId: string, entries: readonly LogEntry[]): Promise<{ seqs: number }> {
    return this.enqueue(async () => {
      if (await this.store.canvasExists(canvasId)) {
        throw new OpValidationError(
          "bad-op",
          `${canvasId} is already here — a teleport creates a canvas, it never merges into one`,
        );
      }
      if (entries.length === 0) {
        throw new OpValidationError("bad-op", "a canvas with no history is not a canvas");
      }
      // The order the sender read them in is the order they mean; sorting here
      // rather than trusting the wire keeps a shuffled body from becoming a
      // differently-folded canvas.
      const inOrder = [...entries].sort((a, b) => a.seq - b.seq);
      await this.store.createCanvasDir(canvasId);
      let state: CanvasState | null = null;
      for (const entry of inOrder) {
        // Folded as we go, so a body that does not apply is refused before it
        // is written rather than leaving half a canvas behind.
        state = applyOperation(state, entry.envelope);
        await this.store.appendLog(canvasId, entry);
      }
      const lastSeq = inOrder[inOrder.length - 1]!.seq;
      await this.store.saveSnapshot(canvasId, state!, lastSeq);
      this.canvases.set(canvasId, {
        state: state!,
        lastSeq,
        entries: [...inOrder],
        undo: new UndoStacks(),
      });
      return { seqs: inOrder.length };
    });
  }

  async getLog(canvasId: string, sinceSeq = 0): Promise<LogEntry[]> {
    const runtime = await this.runtime(canvasId);
    return runtime.entries.filter((entry) => entry.seq > sinceSeq);
  }

  /**
   * What `gc` compacted away, oldest first. Straight from the backing rather
   * than from the runtime — archived entries are exactly the ones the runtime
   * no longer holds. `runtime()` is still called first so an unknown canvas
   * answers "not found" here the same way it does on `getLog`, instead of an
   * empty archive.
   */
  async getArchivedLog(canvasId: string): Promise<LogEntry[]> {
    await this.runtime(canvasId);
    return this.store.readArchivedLog(canvasId);
  }

  submit(request: SubmitRequest): Promise<LogEntry> {
    return this.enqueue(async () => {
      // Mechanism 5's local half, and it runs on a replica exactly as it runs
      // on a home: THIS daemon is the only one that can tell one process on
      // this machine from another, so it checks session-level before anything
      // leaves the machine. The home then checks badge-level, which is all it
      // can honestly see.
      //
      // The SYSTEM voice is the one actor no badge claims (phase 5): any
      // machinery may report as isocan itself, because a system message
      // carries no person's authority — and it may only REPORT, so the
      // exemption is comment-shaped ops and nothing else.
      const systemComment =
        isSystemActor(request.actor.id) &&
        (request.op.type === "thread.create" || request.op.type === "thread.reply");
      if (!systemComment) await this.requireActor(request.badgeId, request.actor.id);
      /**
       * **Which home this op goes to, resolved once** (phase 10.3).
       *
       * A birth is the one op that ESTABLISHES a routing rather than following
       * one, so it is the one that takes the address stated in the request —
       * the marker's assertion, ridden up beside the op. `bind` writes the row
       * (naming the stated address, else the birth default, else null for
       * "here") before anything is forwarded, and hands back the connection.
       *
       * Every other op FOLLOWS the row its canvas already has. A home-scoped
       * op with no canvas (`actor.setColor` never reaches here; a claim goes
       * through `claim()`) resolves to nothing and is applied locally, which is
       * what it always did.
       */
      const home = await this.homeFor(request);
      /**
       * **The answer that never came, asked again** (phase 10).
       *
       * On the writer chain and before anything is forwarded or applied, so a
       * retry and the op it retries can never interleave. For a canvas whose
       * home is elsewhere this is deliberately not consulted — the forward
       * carries `opId` up and that home is the single writer, so that is where
       * the question is answered; asking here as well would be a replica
       * holding an opinion about an order it does not own.
       */
      if (!home && request.opId !== undefined) {
        const already = await this.alreadyWritten(request);
        if (already) return already;
      }
      if (home) return this.forwardSubmit(home, request);
      return this.applyAndPersist(request, undefined);
    });
  }

  /**
   * Where this op's write belongs: a home, or null for "this daemon".
   *
   * On the writer chain by construction (its one caller is inside `enqueue`),
   * which is what makes the row `bind` writes and the forward that follows it
   * one indivisible step. Two births of one id cannot interleave and end up
   * with a row from one and a forward from the other.
   */
  private async homeFor(request: SubmitRequest): Promise<HomeConnection | null> {
    if (!this.homes) return null;
    if (request.op.type === "project.create") {
      return this.homes.bind(request.op.canvasId, request.home ?? null);
    }
    return request.canvasId === null ? null : this.homes.for(request.canvasId);
  }

  /**
   * Has this exact op already been written here? Then hand back the entry it
   * became, and append nothing.
   *
   * **A backwards scan of the live log rather than an index**, and that is a
   * measured choice rather than laziness. The live log is what compaction
   * keeps (`DEFAULT_KEEP_OPS`), a write is a human gesture rather than a
   * packet, and a scan of a few thousand strings costs microseconds — so the
   * index this does not have would be a second copy of the truth to keep in
   * step across four call sites, bought with nothing. Backwards because a
   * replay is by construction the most recent thing that could match: a queue
   * retries within seconds of the answer it lost.
   *
   * **The horizon, said out loud: compaction.** An op whose entry has been
   * compacted out of the live log is not found here and is applied again — and
   * what happens then is exactly what happened before phase 10 and is
   * therefore already safe. Every op that CREATES something carries a
   * client-minted id and the reducer refuses the second one with
   * `duplicate-id`; everything else is absolute-valued (and so idempotent by
   * shape) or refuses on the second pass. Past the horizon a replay degrades
   * from "here is your entry" to "that was refused" — a worse sentence, never
   * a duplicate item.
   *
   * `project.create` is included, and it has to be: its canvas is named in the
   * op rather than in the request, and a create is the one op whose replay
   * would otherwise meet `duplicate-id` at its most confusing — a person told
   * their canvas could not be made, about a canvas that exists.
   */
  private async alreadyWritten(request: SubmitRequest): Promise<LogEntry | null> {
    const canvasId =
      request.op.type === "project.create" ? request.op.canvasId : request.canvasId;
    if (canvasId === null) return null;
    const runtime = await this.runtime(canvasId).catch(() => null);
    if (!runtime) return null;
    for (let i = runtime.entries.length - 1; i >= 0; i--) {
      const entry = runtime.entries[i]!;
      if (entry.envelope.id === request.opId) return entry;
    }
    return null;
  }

  /**
   * Naming yourself, atomically (#57). A writer like any other: two agents
   * claiming at the same moment serialize on this chain, so the second is
   * refused or handed a different name by construction — never by a
   * client-side pre-check both of them can pass at once.
   */
  claim(request: ClaimRequest): Promise<LogEntry> {
    return this.enqueue(async () => {
      const entry = await this.applyClaimAndPersist(request);
      /**
       * A claim does NOT forward, and that is mechanism 5's split rather than
       * an omission. The two hops verify different things and therefore keep
       * different tables: this daemon's claims table is what lets it say "the
       * process holding sessionKey `claude-code:s-1` is Isaac", which the home
       * can never know; the home's is what lets it say "this daemon's badge
       * speaks for Isaac". Forwarding the claim would put the local
       * `sessionKey` — explicitly "never something the home trusts" — into the
       * home's ledger, and leave THIS daemon unable to answer the question
       * only it can.
       *
       * What does travel is the actor, announced onto this daemon's one badge
       * at the home. Fire-and-forget on purpose: the local claim has already
       * succeeded, a replica must stay usable while the home is unreachable,
       * and every forwarded write claims again before it goes (see
       * `HomeLink.ensureClaim`) — so this is a latency saving, never the only
       * chance. A refusal is said out loud because a name collision AT THE
       * HOME is exactly the thing an agent would otherwise meet as a baffling
       * error on its first write.
       *
       * **Phase 7.5 carved out exactly one exception, and it is not a claim.**
       * WHICH name a nameless claimant is handed is not a fact about a local
       * process at all — it is a question about a namespace shared with
       * everybody at the home — so on a replica that one question is asked
       * upward before the claim is applied. See `preferredName`. Everything
       * this comment says about the claim itself is untouched: the session key
       * still never leaves, and the two tables still hold different things.
       *
       * **Every home, not one** (phase 10.3), for `setActorColor`'s reason
       * exactly: a badge at each home has to be made to vouch for this actor
       * separately, because a claim is a fact about one desk's badge and no
       * desk tells another. Announcing at one home would leave a forwarded
       * write to a canvas at the OTHER refused `not-your-actor` until
       * `HomeLink.ensureClaim` re-made the claim on its way — which it does,
       * so this stays what it always was: a latency saving, never the only
       * chance.
       */
      for (const home of this.homes?.all() ?? []) void home.announceActor(entry.envelope.actor);
      return entry;
    });
  }

  /**
   * **The pass's handoff: this badge now speaks as this actor** (phase 8).
   *
   * Small and named rather than a widening of `claim()`, because it is not a
   * claim. A claim is an assertion made by whoever is asking, judged against
   * everything the home can see — names, live faces, other claimants — and
   * `applyClaim` is where that judging lives. A handoff has already been
   * judged, by the only party in a position to: the badge that IS this actor
   * said so when it minted the pass, and the pass's own single use is the
   * receipt. Running it through `applyClaim` would mean sending `as`, and
   * `reincarnate` refuses `as` while the actor is visibly somebody — which,
   * at the exact moment Jordan redeems, it is: her tab is open on the canvas
   * she minted from. The gesture would refuse itself.
   *
   * It is on the writer chain like every other claims write. `Desk.setClaims`
   * says it is "called from the engine's chain", and it means it: a handoff
   * and a claim racing must serialize, or the loser's read-modify-write
   * erases the winner's row.
   *
   * **The name is filled in, never overwritten.** At a home the registry
   * already knows this actor (its minter claimed it there), so there is
   * nothing to write. On a replica the actor may be arriving on this machine
   * for the first time — the redemption is what tells this daemon that
   * `usr_jordan` is called Jordan, before any op she wrote has replicated —
   * and a hole in the registry means her own name renders as nothing. Filling
   * a hole is safe; overwriting is not, because the name that travels with a
   * pass is the name as of REDEMPTION and a roster arriving a second later is
   * the authority.
   */
  endowClaim(badgeId: string, actor: Actor, canvasId?: string): Promise<void> {
    return this.enqueue(async () => {
      const ts = new Date().toISOString();
      await this.desk.setClaims(
        badgeId,
        bindHandoff(await this.desk.claimsOf(badgeId), {
          actor,
          ts,
          ...(canvasId !== undefined ? { canvasId } : {}),
        }),
      );
      if (!actor.name) return;
      const runtime = await this.actors();
      if (runtime.registry.names[actor.id]) return;
      runtime.registry = bindName(runtime.registry, { actor, ts });
      await this.store.saveActors(runtime.registry, runtime.lastSeq);
    });
  }

  /**
   * A name free in the ASKING badge's scope — what a home answers when a
   * replica asks on behalf of a claimant who supplied none. The other end of
   * `preferredName`, and the one thing above that a replica cannot work out
   * for itself.
   *
   * Built from `claimContext`, not from a second gathering that looks like it.
   * The whole point is that the answer comes out of the scope this home would
   * judge the resulting claim in; a lookalike scope here would be the same
   * mismatch again, one layer down.
   *
   * It asks with `"admissible"` reach rather than the claim's `"admitted"`,
   * and that is not a departure from the sentence above — it is what makes it
   * true. The badge asking has been NOWHERE yet; the rooms it is about to be
   * in are the rooms a grant would admit it to, which is where the claim it
   * is allocating for will land. Same reach `GET /api/projects` uses, for the
   * same reason. `claimContext` carries the argument and the disclosure
   * check.
   *
   * One name out, never the taken set. The scope's names are already visible
   * to this badge — a refusal says who holds a name — but a route that handed
   * back a roster on request is the listing `orphanedClaims` refuses to be,
   * and this one has no reason to be it.
   *
   * A read, off the writer chain, like the other reads here: an allocation is
   * advice until a claim acts on it, and the claim that acts on it is
   * serialized like everything else.
   */
  async freeName(badgeId: string): Promise<string> {
    const runtime = await this.actors();
    return allocateName(
      await this.claimContext(
        // A claim that will never be applied. The session key is a probe: it
        // matches no row, so the context is gathered as it would be for a
        // claimant this badge has not seen before — which is exactly who is
        // being allocated for.
        { badgeId, op: { type: "actor.claim", sessionKey: FREE_NAME_PROBE } },
        runtime.registry,
        new Date().toISOString(),
        // The scope this question is actually about. A replica's badge is
        // brand new and admitted to nothing when it asks, so "admitted" is
        // the empty scope that makes every roster name look free — the
        // original bug, one layer down. See `claimContext`.
        "admissible",
      ),
    );
  }

  /**
   * Who the given session keys (or all of them, when omitted) speak as —
   * SCOPED TO ONE BADGE. A badge sees its own claims and nobody else's, which
   * is the re-key showing up on the wire: `sessionKey` is a client's index
   * into its own list, so an answer that crossed badges would be answering a
   * question nobody asked.
   *
   * Naming a key is also how a legacy claim is COLLECTED. A resuming client
   * asks "who is claude-code:s-1?" before it claims anything — `whoami` never
   * writes — so if adoption only happened inside `applyClaim`, every upgraded
   * agent's first command would resolve to the human instead of itself. A
   * named key is a presentation of that key, which is exactly what the shelf
   * waits for; adoption is still one-time and first-come.
   */
  async actorBindings(badgeId: string, keys?: string[] | null): Promise<ActorBindingRecord[]> {
    const { registry } = await this.actors();
    if (keys) {
      const held = new Set((await this.desk.claimsOf(badgeId)).map((row) => row.sessionKey));
      for (const key of keys) {
        if (!held.has(key)) await this.desk.adopt(key, badgeId);
      }
    }
    const wanted = keys ? new Set(keys) : null;
    const claims = await this.desk.claimsOf(badgeId);
    const records: ActorBindingRecord[] = [];
    for (const row of claims) {
      if (row.sessionKey === undefined) continue;
      if (wanted && !wanted.has(row.sessionKey)) continue;
      records.push({
        key: row.sessionKey,
        actor: { id: row.actorId, name: registry.names[row.actorId]?.name ?? "" },
        boundAt: row.boundAt,
        ...(row.canvasId !== undefined ? { canvasId: row.canvasId } : {}),
      });
    }
    return records;
  }

  /**
   * Claims on this home that match the given session keys but are held by a
   * DIFFERENT badge — the answer to "I have no identity here; is there an
   * actor I should be resuming?".
   *
   * Deliberately key-scoped rather than a listing of the home. A client asking
   * about `claude-code:s-1` is asking about a conversation it is already
   * inside; a client that could ask "who is on this home?" would be handed a
   * roster of actors to impersonate, and the answer would encourage exactly
   * the mistake `--as` exists to prevent. Nothing here is adopted: the claim
   * stays where it is, and coming back is a deliberate act.
   */
  async orphanedClaims(badgeId: string, keys: string[]): Promise<ActorBindingRecord[]> {
    if (keys.length === 0) return [];
    const { registry } = await this.actors();
    const records: ActorBindingRecord[] = [];
    // Key by key, which is what makes the narrowing structural: there is no
    // shape of this call that could ever list the home.
    for (const key of new Set(keys)) {
      for (const { badgeId: holder, claim: row } of await this.desk.holdersOf(key)) {
        if (holder === badgeId || row.sessionKey === undefined) continue;
        records.push({
          key: row.sessionKey,
          actor: { id: row.actorId, name: registry.names[row.actorId]?.name ?? "" },
          boundAt: row.boundAt,
          ...(row.canvasId !== undefined ? { canvasId: row.canvasId } : {}),
        });
      }
    }
    return records.sort((a, b) => b.boundAt.localeCompare(a.boundAt));
  }

  /**
   * Upload a blob. Not an Operation — but `blobs.json` is a whole-file
   * read-modify-write, and gc rewrites the same file, so an upload is a
   * writer like any other and belongs on the same chain. Off it, two clients
   * uploading at once both read the pre-upload index and the second write
   * erases the first's entry: bytes on disk that nothing can name, and a
   * permanent 404 for the item pointing at them.
   */
  putBlob(
    canvasId: string,
    data: Buffer,
    meta: { mimeType: string; filename: string },
  ): Promise<{ blobHash: string; size: number; mimeType: string }> {
    return this.enqueue(async () => {
      // On a replica the bytes go where the ops that name them go — the home
      // first, because its refusal is the one that matters, and then here.
      // Both copies, not one: the home is where every browser tab and every
      // other replica will read this blob from, and the local copy is Scene
      // 4's "and in Priya's `~/.isocan` by hash", which is how an agent's
      // hands reach it. Content addressing makes "both" cheap to be right
      // about — the same bytes hash the same on either side.
      //
      // THIS canvas's home, since phase 10.3: bytes follow the ops that name
      // them, and the ops go where the canvas's row says.
      const home = this.homes?.for(canvasId) ?? null;
      if (home) {
        await home.putBlob(canvasId, data, meta);
        /**
         * **And confirm it is actually there.**
         *
         * The upload throws on a refusal, so a clean failure was always
         * loud. What was not covered is a push that ANSWERS well and does
         * not stick — a home mid-restart accepting bytes it never durably
         * writes. That is not hypothetical: two slides lost their bytes in
         * the three minutes before a deploy rolled the home over, with the
         * `item.addVersion` replicating normally, and the first anybody knew
         * was "blob not found" under a screen in somebody else's browser.
         *
         * Asked here because THIS is the moment the bytes are still in hand.
         * A minute later the only copy is on one laptop and the only repair
         * is somebody noticing.
         *
         * `false` is the home saying it does not have them, and that is worth
         * failing the save over — the caller still holds the data and can try
         * again. `null` is "I could not ask", which is not an answer about the
         * bytes and must not be treated as one; the periodic reconcile is the
         * backstop for that, and for everything else this cannot see.
         */
        const blobHash = createHash("sha256").update(data).digest("hex");
        if ((await home.hasBlob(canvasId, blobHash)) === false) {
          throw new Error(
            `${home.homeUrl} took the bytes for ${meta.filename} and does not have them — ` +
              "not saved; try again",
          );
        }
      }
      return this.store.putBlob(canvasId, data, meta);
    });
  }

  /**
   * **Are the bytes where the ops that name them went — and if not, send them.**
   *
   * A blob is not an Operation, so it does not replicate; `putBlob` pushes it
   * to the home by hand. Anything that makes that push not happen — the
   * routing table not yet read, a home that was down for the one second it
   * mattered, a process killed mid-upload — leaves the op replicated and the
   * bytes behind, forever, in silence. A teammate gets the item, its title
   * and its version number, and "blob not found" where the screen should be.
   *
   * It was reported exactly that way, and neither machine could answer the
   * only question that mattered — *are the bytes at the home?* — so the fix
   * was a hand re-upload and the confirmation was somebody else's reload.
   * That is not a repair, it is a guess that happened to work.
   *
   * This asks, per blob, and pushes the missing ones when told to. It is
   * deliberately NOT an Operation: nothing about the canvas changes. It is
   * two copies of the same content-addressed bytes being made to agree, which
   * is why it is safe to run at any time and safe to run twice.
   */
  reconcileBlobs(
    canvasId: string,
    options: { push: boolean },
  ): Promise<{
    home: string | null;
    checked: number;
    missing: string[];
    pushed: string[];
    unknown: string[];
  }> {
    return this.enqueue(async () => {
      const home = this.homes?.for(canvasId) ?? null;
      // No home is not a problem to report: this daemon IS where the bytes
      // live, and there is nothing for them to be behind.
      if (!home) return { home: null, checked: 0, missing: [], pushed: [], unknown: [] };
      const listing = await this.store.listBlobs(canvasId);
      const missing: string[] = [];
      const pushed: string[] = [];
      // "I could not ask" is not "it is not there", and must never be
      // answered by uploading — a home that is down would otherwise have
      // every blob on the canvas pushed at it the moment it came back.
      const unknown: string[] = [];
      for (const blob of listing) {
        const there = await home.hasBlob(canvasId, blob.hash);
        if (there === null) {
          unknown.push(blob.hash);
          continue;
        }
        if (there) continue;
        missing.push(blob.hash);
        if (!options.push) continue;
        const stream = await this.store.openBlob(canvasId, blob.hash);
        if (!stream) continue; // gone locally too; nothing here to send
        const chunks: Buffer[] = [];
        for await (const chunk of stream) chunks.push(chunk as Buffer);
        await home.putBlob(canvasId, Buffer.concat(chunks), {
          mimeType: blob.meta.mimeType,
          filename: blob.meta.filename,
        });
        pushed.push(blob.hash);
      }
      return { home: home.homeUrl, checked: listing.length, missing, pushed, unknown };
    });
  }

  /**
   * Somewhere to put bytes this daemon must not receive, or null when the
   * backing has no such thing (every file home). Deliberately NOT on the
   * single-writer chain: it reads one blob record and mints a URL, writing
   * nothing, and minting can involve a round trip to a signing API — putting
   * it on the chain would stall every op behind somebody's video.
   */
  beginUpload(canvasId: string, request: BlobUploadRequest): Promise<UploadTicket | null> {
    return this.store.beginUpload(canvasId, request);
  }

  /**
   * Name bytes that arrived without us. ON the chain, because GC is on the
   * chain: a register that lands mid-sweep would otherwise re-name a blob the
   * sweep has just decided is garbage, and the item pointing at it would 404
   * forever.
   */
  registerBlob(
    canvasId: string,
    request: BlobUploadRequest,
  ): Promise<{ blobHash: string; size: number; mimeType: string }> {
    return this.enqueue(() => this.store.registerBlob(canvasId, request));
  }

  /**
   * Actor-scoped undo: walk THIS actor's stack. Stored inverses are applied
   * as-is when possible (stale values are accepted — undo restores what you
   * changed); inverses invalidated by other actors' ops are repaired (batch
   * ops shrink to their surviving members) or skipped entirely.
   */
  undo(canvasId: string, actor: Actor, badgeId: string, clientId?: string): Promise<LogEntry> {
    return this.enqueue(async () => {
      // Checked here as well as on `submit`, and for a reason of its own:
      // undo is actor-scoped, so naming somebody else is not a slip, it is
      // undoing their work.
      await this.requireActor(badgeId, actor.id);
      // On a replica the undo STACK is the home's too, and it has to be: it is
      // rebuilt from the log, and a replica whose live log was re-snapshotted
      // (the home could not serve a tail) holds no entries to walk. Choosing
      // what to undo here and forwarding the resulting op would be a second
      // opinion about a stack that has one owner. That reasoning was always
      // per canvas; phase 10.3 is only where the lookup caught up with it.
      const home = this.homes?.for(canvasId) ?? null;
      if (home) {
        return this.landRemote(
          canvasId,
          await home.undo(canvasId, {
            actor,
            ...(clientId !== undefined ? { clientId } : {}),
          }),
        );
      }
      const runtime = await this.runtime(canvasId);
      /**
       * **One ⌘Z reverses one GESTURE**, which is usually one op and is
       * sometimes eight — see `LogEntry.group`.
       *
       * The loop below is unchanged in every particular except that it may
       * run more than once: each member is inverted against the state it
       * actually meets, each lands as its own entry with its own `cause`, and
       * a member whose inverse no longer applies is discarded exactly as a
       * lone op would be. Newest first, because that is the only order in
       * which a sequence of inverses is correct.
       *
       * The LAST entry written is returned, which keeps this method's shape:
       * every op reaches clients by the ordinary broadcast, so the return
       * value is a receipt rather than the payload.
       */
      // Every id this person has written under (multi-identity phase 5): a
      // join folds two actors' stacks into one walk, in log order.
      const person = actorAliases((await this.actors()).registry.joined, actor.id);
      let written: LogEntry | null = null;
      for (;;) {
        const group = runtime.undo.nextUndoGroup(person);
        if (group.length === 0) {
          if (written !== null) return written;
          throw new NothingToUndoError("undo", actor.name);
        }
        const targetSeq = group[0]!;
        const target = runtime.entries.find((entry) => entry.seq === targetSeq)!;
        const op = repairInverse(runtime.state, target.inverse!);
        if (op !== null) {
          try {
            written = await this.applyAndPersist(
              { canvasId, actor, op, badgeId, ...(clientId !== undefined ? { clientId } : {}) },
              { kind: "undo", targetSeq },
            );
            // A lone op is done; a gesture keeps going until its members run
            // out, which `nextUndoGroup` reports by no longer naming them.
            if (group.length === 1) return written;
            continue;
          } catch (err) {
            if (!(err instanceof OpValidationError)) throw err;
          }
        }
        // The inverse no longer applies (its objects were changed by someone
        // else); its effect is already gone, so drop it and try the next.
        runtime.undo.discardUndoTarget(person, targetSeq);
      }
    });
  }

  redo(canvasId: string, actor: Actor, badgeId: string, clientId?: string): Promise<LogEntry> {
    return this.enqueue(async () => {
      await this.requireActor(badgeId, actor.id);
      // This canvas's home; see `undo` above.
      const home = this.homes?.for(canvasId) ?? null;
      if (home) {
        return this.landRemote(
          canvasId,
          await home.redo(canvasId, {
            actor,
            ...(clientId !== undefined ? { clientId } : {}),
          }),
        );
      }
      const runtime = await this.runtime(canvasId);
      // The mirror of `undo` above, member for member: a gesture redone is a
      // gesture, and in the order it was originally written.
      const person = actorAliases((await this.actors()).registry.joined, actor.id);
      let redone: LogEntry | null = null;
      for (;;) {
        const group = runtime.undo.nextRedoGroup(person);
        if (group.length === 0) {
          if (redone !== null) return redone;
          throw new NothingToUndoError("redo", actor.name);
        }
        const next = group[0]!;
        const target = runtime.entries.find((entry) => entry.seq === next.targetSeq)!;
        const undoEntry = runtime.entries.find((entry) => entry.seq === next.undoSeq)!;
        const op = repairInverse(runtime.state, redoOpFor(target, undoEntry));
        if (op !== null) {
          try {
            redone = await this.applyAndPersist(
              { canvasId, actor, op, badgeId, ...(clientId !== undefined ? { clientId } : {}) },
              { kind: "redo", targetSeq: next.targetSeq },
            );
            if (group.length === 1) return redone;
            continue;
          } catch (err) {
            if (!(err instanceof OpValidationError)) throw err;
          }
        }
        runtime.undo.discardRedoTarget(person, next.targetSeq);
      }
    });
  }

  /**
   * Blob garbage collection: compact the oplog to an undo horizon (dropped
   * entries go to the archive), then sweep blobs unreachable from live state,
   * trash, and the retained log. Runs inside the single-writer queue, so it
   * cannot race a mutation; the mtime grace period covers uploads that have
   * not become items yet. Maintenance, not an Operation — never undoable.
   */
  gc(canvasId: string, options: GcOptions = {}): Promise<GcReport> {
    return this.enqueue(async () => {
      const runtime = await this.runtime(canvasId);
      const keepOps = options.keepOps ?? DEFAULT_KEEP_OPS;
      const graceMs = options.graceMs ?? DEFAULT_GRACE_MS;
      const dryRun = options.dryRun ?? false;

      const retained = chooseRetained(runtime.entries, keepOps);
      const retainedSeqs = new Set(retained.map((entry) => entry.seq));
      const dropped = runtime.entries.filter((entry) => !retainedSeqs.has(entry.seq));

      const marked = reachableHashes(runtime.state, retained);
      const listing = await this.store.listBlobs(canvasId);

      const report: GcReport = {
        dryRun,
        retainedEntries: retained.length,
        droppedEntries: dropped.length,
        reachableBlobs: 0,
        reachableBytes: 0,
        sweptBlobs: 0,
        sweptBytes: 0,
        skippedRecentBlobs: 0,
      };

      const sweep: string[] = [];
      for (const { hash, meta, ageMs } of listing) {
        if (marked.has(hash)) {
          report.reachableBlobs += 1;
          report.reachableBytes += meta.size;
          continue;
        }
        if (ageMs !== null && ageMs < graceMs) {
          report.skippedRecentBlobs += 1;
          continue;
        }
        sweep.push(hash);
        report.sweptBlobs += 1;
        report.sweptBytes += meta.size;
      }

      if (dryRun) return report;

      // Order matters for crash safety: compact the log first (which archives
      // before it forgets), and only then delete blob bytes. A crash at any
      // point leaves either extra history or extra garbage — both harmless and
      // re-collectable. What compaction MEANS is the backing's: a rewrite on a
      // disk, an advanced horizon in the cloud, and never a deleted seq.
      if (dropped.length > 0) {
        await this.store.compactOplog(canvasId, retained, dropped);
        runtime.entries = retained;
        runtime.undo = UndoStacks.rebuild(retained);
      }
      if (sweep.length > 0) await this.store.deleteBlobs(canvasId, sweep);
      return report;
    });
  }

  // ---------- the replica side: what arrives from the home ----------
  //
  // Everything below runs on a daemon that has been demoted. Three entry
  // points, all of them queued on the same single-writer chain as a local
  // write, because a forwarded write and an arriving entry are two mutations
  // of one state and letting them interleave is exactly the corruption the
  // chain has always existed to prevent.

  /**
   * One entry from the home, landed here with **the home's seq, verbatim**.
   *
   * The seq is not re-assigned and the entry does not go near
   * `applyAndPersist`'s numbering. That is not an implementation detail, it is
   * the demotion: two machines numbering one log is the disaster the whole
   * design forbids, and a replica that renumbered would make its own oplog
   * un-comparable with the home's — which is the one thing that has to stay
   * true for a seq cursor to mean anything on reconnect.
   *
   * ## The double-application guard
   *
   * A forwarded write's answer and the broadcast of that same write are the
   * SAME entry arriving twice, by two routes, in either order. **Seq is the
   * idempotence key**, and it is the natural one: the home assigns seqs
   * strictly increasing per canvas from one writer, so `seq <= lastSeq` means
   * "already have it" with no bookkeeping to keep, no dedup table to bound,
   * and nothing to get wrong after a restart — the store itself remembers.
   * Whichever route arrives first applies; the other is a no-op. (In practice
   * the broadcast usually wins, because the home broadcasts inside its own
   * write before it writes the HTTP response.)
   *
   * `gap` is the other answer: an entry past `lastSeq + 1` cannot be applied
   * on top of a state that is not its pre-state, so it is refused here and the
   * caller re-dials with the cursor it does hold. Guessing would be the only
   * way to be wrong silently.
   */
  applyRemote(canvasId: string, entry: IncomingEntry): Promise<RemoteApply> {
    return this.enqueue(() => this.applyRemoteEntry(canvasId, entry));
  }

  /**
   * The home could not serve a tail, so it sent state instead — take it.
   *
   * The live log is emptied in the same breath, and that is the load-bearing
   * half. The entries this replica holds are a PREFIX the home has told us it
   * cannot join up to; keeping them beside a snapshot from far past their end
   * would leave `load()` replaying a tail that is not a tail, and `getLog`
   * answering a cursor question with entries from before the gap. Emptying it
   * through `compactOplog` rather than by deletion is deliberate: that method
   * archives before it forgets, so the history is preserved for audit, and a
   * backing where a seq must stay claimed forever (the cloud one) is not asked
   * to free anything.
   */
  adoptRemoteSnapshot(canvasId: string, snapshot: CanvasSnapshotResponse): Promise<void> {
    return this.enqueue(async () => {
      const state: CanvasState = { project: snapshot.project, canvas: snapshot.canvas };
      let held: LogEntry[] = [];
      if (await this.store.canvasExists(canvasId)) {
        const runtime = await this.runtime(canvasId).catch(() => null);
        // Already exactly here. Adopting anyway would EMPTY a live log for
        // nothing — the entries would be archived and `getLog` would answer
        // every cursor with silence — and a snapshot that arrives while the
        // replica is already current is ordinary: a socket that dialled with
        // a cursor of 0 for a canvas the chain was mid-way through creating
        // gets one, correctly, and it must not undo the creation.
        if (runtime && runtime.lastSeq === snapshot.lastSeq) return;
        held = runtime?.entries ?? [];
      } else {
        await this.store.createCanvasDir(canvasId);
      }
      if (held.length > 0) await this.store.compactOplog(canvasId, [], held);
      await this.store.saveSnapshot(canvasId, state, snapshot.lastSeq);
      this.canvases.set(canvasId, {
        state,
        lastSeq: snapshot.lastSeq,
        entries: [],
        undo: UndoStacks.rebuild([]),
      });
      // The OTHER way a canvas arrives on a replica — and the more common
      // one, because a replica that has never held a canvas can only present
      // cursor 0 and can only be answered with state. Same local row, same
      // reason: no row, and this machine's own CLIs are refused a canvas
      // sitting in their store.
      await ensureHomeLinkGrant(this.desk, canvasId);
    });
  }

  /** The home says this canvas is gone. Soft, like every delete here: the
   * directory is moved aside rather than removed, so a replica that was told
   * to forget a canvas can still be asked what it used to hold. */
  applyRemoteDelete(canvasId: string): Promise<void> {
    return this.enqueue(async () => {
      if (!(await this.store.canvasExists(canvasId))) return;
      await this.store.softDeleteCanvas(canvasId);
      this.canvases.delete(canvasId);
      this.emit(canvasId, { type: "canvas-deleted" });
    });
  }

  /**
   * Identity's public face, as the home has it — names and chosen colors.
   *
   * These ride on every `snapshot`, every `resumed` and every
   * `presence-roster` already, for the reason `protocol.ts` gives: nothing in
   * an op tail carries them, and a rename has to reach the words somebody
   * wrote before it. On a replica they are also the ONLY route by which a
   * stranger's name arrives — the actors oplog is home-scoped and `/ws` is per
   * canvas, so `isocan who` and `isocan ls` on this machine would otherwise
   * letter everyone by whatever was stamped on their oldest comment.
   *
   * A merge, never a replacement: an actor the home has not heard of yet (one
   * claimed here a second ago, whose announcement is still in flight) keeps
   * its local row instead of being erased by an answer that simply does not
   * mention it.
   *
   * ---
   *
   * **A RENAME THAT DID NOT REACH A HOME IS LOST WHEN THAT HOME COMES BACK.
   * Measured, 2026-08-24 (phase 10.3), not reasoned about.**
   *
   * The mechanism is the loop below: `at: now` is stamped on whatever a roster
   * carries and a differing name is overwritten unconditionally. The wire
   * carries `names: Record<actorId, string>` with **no timestamps**, so
   * last-writer-wins is not available here without a protocol change — the
   * only thing this code can know about a name is that a home said it just
   * now, which is exactly what makes the stale one win.
   *
   * What the measurement did: two homes, one daemon holding a canvas at each.
   * Kenny renames himself to Isaac while H2 is down. The announcement reaches
   * H1. H2 comes back on the same address. What was observed at the daemon:
   *
   * - `Isaac → Kenny`, within a couple of seconds of H2's first roster, **and
   *   it stayed Kenny.** Five seconds of sampling, one transition, no
   *   recovery. H1 went on saying Isaac and H2 went on saying Kenny, so the
   *   two homes now disagree permanently and the machine sides with the stale
   *   one.
   * - **A live relay does NOT correct it.** There was a session on H2's canvas
   *   relaying continuously throughout, which is the mechanism that was
   *   supposed to heal this (`ensureClaim`'s cache is keyed by id AND name, so
   *   a relay carrying the new name would re-claim it). It carried the name
   *   the roster had just overwritten, which is the old one, so the cache was
   *   never asked about the new one.
   * - **A WRITE does correct it — but only if the new name is still held
   *   somewhere outside this daemon.** Posting an op with `actor: {id, name:
   *   "Isaac"}` brought both the daemon and H2 back to Isaac immediately. In
   *   practice a person's CLI resolves its name FROM this registry, which by
   *   then says Kenny, so a real rename is not flapping — it is gone.
   *
   * **And it is NOT new**, which is the half the design got wrong and the half
   * that matters most for what to do about it. The control — the same rename
   * against a daemon with ONE home — flapped identically: `Kenny`, with no
   * transition away from it, from the moment the home returned. Phase 10.3 did
   * not create this seam. It made the WINDOW ordinary: before it, a daemon
   * whose home was down refused every write on the machine, so nobody carried
   * on working through an outage and nobody renamed themselves during one.
   * Now a canvas at a reachable home keeps working while another home is
   * away, so the window is a normal afternoon.
   *
   * Left as a named seam rather than fixed here, deliberately: the fix is
   * timestamps on the wire (`names: Record<actorId, {name, at}>`), which is a
   * protocol change on three message types, and this phase's Work is
   * elsewhere. What is NOT acceptable is the version of this comment that said
   * "transient and self-healing" — that was a hypothesis, and it measured
   * false.
   */
  mergeRemoteIdentity(colors: ActorColors, names: ActorNames): Promise<void> {
    return this.enqueue(async () => {
      const runtime = await this.actors();
      const nextNames = { ...runtime.registry.names };
      const nextColors = { ...runtime.registry.colors };
      let changed = false;
      const now = new Date().toISOString();
      for (const [actorId, name] of Object.entries(names)) {
        if (nextNames[actorId]?.name === name) continue;
        nextNames[actorId] = { name, at: now };
        changed = true;
      }
      for (const [actorId, color] of Object.entries(colors)) {
        if (nextColors[actorId] === color) continue;
        nextColors[actorId] = color;
        changed = true;
      }
      // Guarded because this runs off every roster message, which is every
      // mouse move on every canvas: a disk write per cursor beat for data that
      // did not change would put the actors file on the latency path.
      if (!changed) return;
      runtime.registry = { names: nextNames, colors: nextColors };
      await this.store.saveActors(runtime.registry, runtime.lastSeq);
    });
  }

  /** Forward a write and land the home's answer here. Runs INSIDE the queue —
   * hence the private, unqueued `applyRemoteEntry` rather than the public
   * `applyRemote`, which would deadlock waiting on the chain it is already
   * on. */
  private async forwardSubmit(home: HomeConnection, request: SubmitRequest): Promise<LogEntry> {
    const answer = await home.submitOp({
      canvasId: request.canvasId,
      actor: request.actor,
      op: request.op,
      ...(request.clientId !== undefined ? { clientId: request.clientId } : {}),
      // The key travels, because the writer it is a question for is up there.
      // A replica has nothing to dedupe against — it holds no order of its own
      // — and passing it through is what lets a CLI's retry mean the same
      // thing at the home as a tab's does.
      ...(request.opId !== undefined ? { opId: request.opId } : {}),
    });
    const canvasId =
      request.op.type === "project.create" ? request.op.canvasId : request.canvasId;
    return this.landRemote(canvasId, answer);
  }

  /**
   * Apply what the home answered, and hand the caller the home's own entry.
   *
   * Applying here rather than only waiting for the socket is what makes
   * read-after-write work on a replica: `bindFresh` creates a canvas and reads
   * it straight back, `isocan add` prints the item it just made. A round trip
   * through the socket would be a race the CLI would lose often enough to be a
   * bug report. Applying twice is free — see `applyRemoteEntry`'s seq guard.
   */
  private async landRemote(
    canvasId: string | null,
    answer: { seq: number; envelope: OpEnvelope; inverse?: Operation | null },
  ): Promise<LogEntry> {
    const entry: IncomingEntry = {
      seq: answer.seq,
      envelope: answer.envelope,
      ...(answer.inverse !== undefined ? { inverse: answer.inverse } : {}),
    };
    if (canvasId !== null) await this.applyRemoteEntry(canvasId, entry);
    return { inverse: null, ...entry } as LogEntry;
  }

  /** The unqueued core. Every caller is already on the chain. */
  private async applyRemoteEntry(
    canvasId: string,
    incoming: IncomingEntry,
  ): Promise<RemoteApply> {
    const { envelope, seq } = incoming;
    const op = envelope.op;

    if (op.type === "project.create") {
      if (await this.store.canvasExists(op.canvasId)) return "skipped";
      const state = applyOperation(null, envelope)!;
      const entry: LogEntry = {
        seq,
        envelope,
        inverse: incoming.inverse !== undefined ? incoming.inverse : invertOperation(null, op),
        ...(incoming.cause !== undefined ? { cause: incoming.cause } : {}),
      };
      await this.store.createCanvasDir(op.canvasId);
      await this.appendOrFence(op.canvasId, entry);
      await this.store.saveSnapshot(op.canvasId, state, seq);
      this.canvases.set(op.canvasId, {
        state,
        lastSeq: seq,
        entries: [entry],
        undo: UndoStacks.rebuild([entry]),
      });
      // A canvas now exists on this machine, so this machine's door needs a
      // row for it (phase 7). The home wrote its own; this one governs who
      // HERE may reach the local copy, and without it every CLI on this
      // laptop would be refused a canvas it is replicating.
      await ensureHomeLinkGrant(this.desk, op.canvasId);
      this.emit(op.canvasId, { type: "op-applied", entry });
      return "applied";
    }

    const runtime = await this.runtime(canvasId).catch(() => null);
    // A canvas this replica has never seen, arriving mid-history: only a
    // snapshot can start it, so say `gap` and let the dial ask for one.
    if (!runtime) return "gap";
    if (seq <= runtime.lastSeq) return "skipped";
    if (seq !== runtime.lastSeq + 1) return "gap";

    let nextState: CanvasState | null;
    let inverse: Operation | null;
    try {
      inverse = incoming.inverse !== undefined
        ? incoming.inverse
        : invertOperation(runtime.state, op);
      nextState = applyOperation(runtime.state, envelope);
    } catch {
      // The reducer refused an op the home accepted, so our state is not the
      // pre-state it was applied against — divergence, not a bad op. A
      // snapshot is the correction, and `gap` is how one is asked for.
      return "gap";
    }
    const entry: LogEntry = {
      seq,
      envelope,
      inverse,
      ...(incoming.cause !== undefined ? { cause: incoming.cause } : {}),
    };
    await this.appendOrFence(canvasId, entry);
    if (nextState === null) {
      await this.store.softDeleteCanvas(canvasId);
      this.canvases.delete(canvasId);
      this.emit(canvasId, { type: "canvas-deleted" });
      return "applied";
    }
    runtime.state = nextState;
    runtime.lastSeq = seq;
    runtime.entries.push(entry);
    runtime.undo.record(entry);
    await this.store.saveSnapshot(canvasId, nextState, seq);
    this.emit(canvasId, { type: "op-applied", entry });
    return "applied";
  }

  private async applyClaimAndPersist(request: ClaimRequest): Promise<LogEntry> {
    const runtime = await this.actors();
    const ts = new Date().toISOString();
    const { registry, actor, claims, adopted } = applyClaim(
      await this.claimContext(request, runtime.registry, ts),
      request.op,
    );
    const envelope: OpEnvelope = {
      id: newOpId(),
      canvasId: null,
      actor,
      ...(request.clientId !== undefined ? { clientId: request.clientId } : {}),
      ts,
      op: request.op,
    };
    const seq = runtime.lastSeq + 1;
    const entry: LogEntry = { seq, envelope, inverse: null };
    await this.appendActorsOrFence(entry);
    runtime.registry = registry;
    runtime.lastSeq = seq;
    await this.store.saveActors(registry, seq);
    // Two ledgers, two writes. The public half is a logged, replayable op;
    // the private half is written straight to the desk, because the oplog
    // must not learn that badges exist (mechanism 5).
    if (adopted !== undefined) await this.desk.adopt(adopted, request.badgeId);
    await this.desk.setClaims(request.badgeId, claims);
    // A claim can be a RENAME, and a rename has to reach the comments the
    // renamed actor wrote before it. Same channel a color change takes.
    this.identityChanged(registry.colors, actor.id);
    return entry;
  }

  /**
   * Everything `applyClaim` is allowed to see, gathered at the single writer.
   *
   * The GATHERING is where mechanism 10 lives, and it lives here rather than
   * in the reducer on purpose: `claims.ts` has never heard of a badge record
   * or an admission, and judging a name against "everyone in scope" is the
   * same code whatever the scope turns out to be. What changed in phase 3 is
   * only what gets put in front of it.
   */
  private async claimContext(
    request: ClaimRequest,
    registry: ActorRegistry,
    now: string,
    reach: NameReach = "admitted",
  ): Promise<ClaimContext> {
    const badge = await this.desk.badge(request.badgeId);
    const canvasIds = (badge?.admissions ?? []).map((a) => a.canvasId);
    /**
     * `freeName` only (see `NameReach`), and it is the SAME trick `GET
     * /api/projects` plays, for the same reason — not a coincidence, a
     * pattern.
     *
     * Phase 7 hit this exact shape once already: scoping the canvases listing
     * strictly to admissions broke replicas, because a fresh replica's badge
     * has no admissions and would discover nothing at all. The answer there
     * was to scope to what the badge is admitted to PLUS what a grant would
     * admit it to — the door's own test, asked without opening the door.
     *
     * Allocation is the same question wearing different clothes. A replica
     * asks "what name is free where this is going to land?" with a badge that
     * has, by construction, just been minted and been nowhere; scoped to
     * admissions that badge's scope is empty, and an empty scope makes every
     * roster name look free — so the home confidently answers with the one
     * name most likely to already be taken. That is the original bug
     * reproduced INSIDE its own fix, one layer down. (It hid locally because
     * a replica's sweep admits its badge over loopback in milliseconds, so by
     * claim time the scope was full; against a real home the claim wins that
     * race. The refusal still names the canvas, because by the time the CLAIM
     * is judged the badge HAS been admitted — which is what made it look like
     * anything but a scope bug.)
     *
     * Not applied to a claim, which keeps phase 7's narrower widening below:
     * a claim is judged where it is made, and the room it names is the room
     * it named. This is one question — "hand me a name" — asked on behalf of
     * somebody who has not arrived yet.
     *
     * **What it discloses, checked rather than assumed.** One NAME goes back,
     * never the taken set, never a holder, never a title. What that leaks is
     * a count: how many of the roster's first names are in use across the
     * canvases this badge could enter by presenting the address. Those are
     * exactly the canvases `GET /api/projects` already lists to the same
     * badge, ids and titles included, and any of them would hand over its
     * whole roster to a badge that simply opened it. So the answer is a
     * function of what the asker can already have, and a canvas whose link is
     * off drops out of it — same as the listing.
     *
     * Nothing is written: satisfying a grant to judge a name is not entering
     * the room. The cost is one grant query per canvas the badge has not been
     * in, on a route asked once per nameless claim.
     */
    if (reach === "admissible" && badge) {
      for (const canvas of await this.listCanvases()) {
        if (canvasIds.includes(canvas.id)) continue;
        if (await admittingGrant(this.desk, canvas.id, badge)) canvasIds.push(canvas.id);
      }
    }
    /**
     * The room this name is being taken in counts even before the badge has
     * been let into it — a browser names itself at the identity dialog,
     * before it has fetched anything. See `ActorClaimOp.canvasId`.
     *
     * **Phase 3 left this as a hole and phase 7 closes it.** A claim widens
     * its own name-check scope by naming the canvas it was made from, which
     * under the old policy could only ever reach a canvas the address would
     * have admitted the asker to anyway. Under a grant it must be
     * admission-CHECKED, or "is this name taken here" becomes a probe into a
     * room you were never let into: the refusal names the holder, so an
     * unchecked widening would leak a stranger's roster one name at a time.
     *
     * The test is the door's own — would a grant admit this badge? — and NOT
     * "is it already admitted", because the browser case above is precisely a
     * badge that is not admitted yet and is about to be. Nothing is written
     * here: satisfying a grant for the purpose of judging a name is not
     * entering the room, and an admission written from a claim would be an
     * admission with no request behind it (and, in phase 9, a badge the sweep
     * would have to expel from a canvas it never opened).
     */
    const from = request.op.canvasId;
    if (from !== undefined && !canvasIds.includes(from) && badge) {
      if (await admittingGrant(this.desk, from, badge)) canvasIds.push(from);
    }
    // One query, two readers: the reducer judges whether the actor is visibly
    // somebody (`claimants`), and `vouch` below asks whether any of those
    // holders is a DIFFERENT badge. Asking the desk twice for one answer is
    // how the two come to disagree.
    const holders = request.op.as ? await this.desk.claimants(request.op.as) : [];
    const own = await this.desk.claimsOf(request.badgeId);
    // Own rows first, then the neighbours: a badge with no admissions yet is
    // still in its own scope, which is what keeps two agents on one machine
    // from taking one name while their badge is still fresh.
    const scoped = [...own, ...(await this.desk.claimsIn(canvasIds))];
    const shelved = (await this.desk.holdersOf(request.op.sessionKey)).find(
      (row) => row.badgeId === SHELF,
    )?.claim;
    return {
      registry,
      own,
      ...(shelved !== undefined ? { shelved } : {}),
      ...(await this.preferredName(request, own, shelved)),
      scoped,
      /**
       * Only `as` asks a global question, so only `as` pays for one.
       *
       * **Rows on THIS badge stop blocking once they are no longer fresh, and
       * that is the fix for #89.** The refusal these feed exists for one
       * reason, stated where it is thrown: letting a second session key an
       * actor a first is holding "would unseat a working agent". On another
       * badge we cannot see whether that agent is working, so the
       * thirty-minute window stands. On THIS badge we can: a working agent is
       * live on a canvas, and `wornLive` refuses for it with better
       * information and no clock at all.
       *
       * The short window that remains covers the one case `wornLive` cannot:
       * an agent that has JUST claimed and has not reached a canvas yet, so
       * it is nobody's face but is seconds from being one. That case is
       * deliberate and tested ("a just-claimed session is presumed alive").
       * Half an hour of it was the bug; a minute of it is the guard.
       *
       * What the window was doing instead was refusing an agent its own past
       * self. A harness gives each conversation a new session key, so a fresh
       * conversation on the same machine, with the same badge, holding a
       * transcript of nothing, was told it "is somebody else here" — for half
       * an hour, even after a clean `session end`, even with the old agent
       * demonstrably gone. That is the reincarnation `--agent-help` documents,
       * refused by the guard meant to protect it. It also reached CI, where a
       * pass test failed on exactly this sentence and passed on a re-run.
       *
       * The badge ids the desk hands back stay dropped from what the reducer
       * SEES — `reincarnate` judges whether an actor is visibly somebody,
       * which is a question about claims and never about who is holding them
       * (mechanism 5's "the reducer judges actors, never badges"). The badge
       * thinking happens here, beside `heldElsewhere`, which is the same
       * shape and the same reason.
       */
      claimants: holders
        .filter((row) => row.badgeId !== request.badgeId || fresh(row.claim.boundAt, now))
        .map((row) => row.claim),
      ...(request.op.as
        ? await this.vouch(request.badgeId, request.op.as, request.op.sessionKey, holders)
        : {}),
      held: await this.heldNames(canvasIds),
      now,
    };
  }

  /**
   * **Is this claimant allowed to be that actor, and by what?** — the
   * gathering half of mechanism 6, and the tightening that comes with it.
   *
   * Two facts, both about badges, both computed HERE because `claims.ts` has
   * never heard of a badge record and must not start:
   *
   * - `heldElsewhere` — some other badge already speaks as this actor, under a
   *   key that is not the one being presented. That is what turns `as` from an
   *   open assertion into a request that needs a vouch.
   *
   *   **Two exclusions, and both are load-bearing.** The migration SHELF is
   *   not "elsewhere": a shelved pre-badge row belongs to no holder at all,
   *   and treating it as one would lock a legacy session out of its own actor
   *   on the one hop it has to adopt it. And a row under THE SAME SESSION KEY
   *   is not "elsewhere" either, which is the shipped lost-badge recovery and
   *   the reason this tightening stops where it does — see the note on
   *   `heldElsewhere` in `claims.ts`.
   * - `vouchedBy` — the attribute this badge and a badge claiming that actor
   *   have BOTH proved. Jordan's phone and Jordan's laptop, one inbox.
   *
   * **The vouch is a membership test against the listing**, not a second
   * spelling of the rule — the same discipline kill-a-badge takes ("what you
   * may kill and what you are shown cannot drift apart"). What a surface is
   * OFFERED on `GET /api/attest` and what the reducer will ACCEPT are one
   * computation, so a person cannot be shown a button that is refused.
   */
  private async vouch(
    badgeId: string,
    as: string,
    sessionKey: string,
    holders: readonly { badgeId: string; claim: ActorClaim }[],
  ): Promise<{ heldElsewhere?: boolean; vouchedBy?: string }> {
    const elsewhere = holders.some(
      (row) =>
        row.badgeId !== badgeId &&
        row.badgeId !== SHELF &&
        row.claim.sessionKey !== sessionKey,
    );
    if (!elsewhere) return {};
    const vouch = (await this.resumable(badgeId)).find((row) => row.actor.id === as);
    return { heldElsewhere: true, ...(vouch ? { vouchedBy: vouch.via } : {}) };
  }

  /**
   * **Who this badge may resume, and on the strength of what** — mechanism 6's
   * "a badge attesting the same email as the badge that claimed an actor may
   * resume that actor".
   *
   * Every actor claimed by some OTHER live badge that has proved an attribute
   * this badge has also proved, minus the ones this badge already claims
   * (those need no resuming — `claimsActor` already says yes).
   *
   * **A badge with no attestations resumes nobody, in one line and with no
   * query.** That is the whole of "attestation adds a way and removes none":
   * the overwhelming majority of holders have proved nothing, and for them
   * this function is a document read and an empty array.
   *
   * The name comes from the registry as of NOW rather than from the claim row,
   * for `redeemPass`'s reason: a person who renamed herself is offered the name
   * she goes by, which is also the name her work already carries.
   */
  async resumable(badgeId: string): Promise<{ actor: Actor; via: string }[]> {
    const me = await this.desk.badge(badgeId);
    const mine = me?.attestations ?? [];
    if (mine.length === 0) return [];
    const names = await this.actorNames();
    const { registry } = await this.actors();
    // Already one of mine, so not something to resume. Includes the actor this
    // badge is wearing right now, which would otherwise be offered back to it.
    const seen = new Set<string>(me!.claims.map((claim) => claim.actorId));
    const rows: { actor: Actor; via: string }[] = [];
    for (const attestation of mine) {
      for (const badge of await this.desk.badgesAttesting(attestation.attribute)) {
        if (badge.badgeId === badgeId) continue;
        for (const claim of badge.claims) {
          if (seen.has(claim.actorId)) continue;
          seen.add(claim.actorId);
          // An actor folded into somebody else answers to nobody, so there is
          // nobody to resume under that id (multi-identity phase 5).
          if (resolveActor(registry.joined, claim.actorId) !== claim.actorId) continue;
          rows.push({
            actor: { id: claim.actorId, name: names[claim.actorId] ?? "" },
            via: attestation.attribute,
          });
        }
      }
    }
    return rows;
  }

  /**
   * Ask the home for a name, when this daemon is a replica and the claimant
   * asked for none — the ONE part of a claim that crosses the wire.
   *
   * The split is deliberate and narrow. A claim still does not forward (see
   * `claim()`), because "the process holding sessionKey `claude-code:s-1` is
   * Isaac" is a fact only this daemon can hold. But WHICH name a nameless
   * claimant is handed is not that kind of fact at all: it is a question about
   * a namespace shared with everybody else at the home, and on a replica the
   * home owns that namespace. Answering it locally is how a fresh replica
   * confidently hands out "Isaac" and is then refused by the home a
   * millisecond later — the local answer correct by its own scope, and wrong
   * where it lands.
   *
   * Three ways this stays small:
   *
   * - **Only allocation.** A supplied name is judged, not allocated, and a
   *   collision on one is still refused locally with the message it always
   *   had. A key this badge (or the shelf) already holds is a RESUMPTION,
   *   handed back the name it already has — nothing to allocate, nothing to
   *   ask.
   * - **Only a preference.** The answer arrives as `ClaimContext.preferred`
   *   and is re-checked against the local scope, so a stale answer costs a
   *   roster position rather than a wrong name.
   * - **Never load-bearing.** Any failure — an unreachable home, a home too
   *   old to know the route — falls back to local allocation, which is what a
   *   replica did before and what keeps it usable with no home in sight.
   *
   * **WHICH home is asked, under many of them** (phase 10.3), and this is the
   * one site in the table that did not simply fall out. A nameless claim is
   * not about a canvas, so `for(canvasId)` has nothing to look up; and asking
   * every home and intersecting the answers is **not available**, because
   * `freeName` returns one name out and never the taken set, on purpose (see
   * `heldNames` — a route that could return the taken set would be the home
   * listing its rosters to anyone who knocked).
   *
   * Two things make it tractable. `actor.claim` carries an optional
   * `canvasId` — phase 7's marked hole, exactly the shape needed here — so a
   * claim that names a canvas asks THAT canvas's home. A claim that names none
   * asks `birth()`: the home this machine's next canvas goes to, which is the
   * best available proxy for where this identity is heading.
   *
   * The seam left, named rather than smoothed, and **widened by exactly one
   * notch**: two replicas asking in the same instant can be handed the same
   * name, and now also a name free at one home may be taken at another. Both
   * end the same way — the second one's `announceActor` meets that home's
   * refusal exactly as it does today, with the home's own words. Closing
   * either would mean RESERVING a name at a home, and a reservation is a claim
   * — which is the thing that must not forward. So no reservation is built
   * here; the fallback below is the answer, and it is the same fallback as
   * "the home did not answer".
   */
  private async preferredName(
    request: ClaimRequest,
    own: readonly ActorClaim[],
    shelved: ActorClaim | undefined,
  ): Promise<{ preferred?: string }> {
    const op = request.op;
    if (!this.homes) return {};
    if (op.name !== undefined || op.as !== undefined) return {};
    // `fresh` allocates even for a key that is already somebody — that is what
    // being a second Kenny on purpose means — so it asks even when resuming
    // would not.
    if (!op.fresh && (own.some((row) => row.sessionKey === op.sessionKey) || shelved)) return {};
    const home = op.canvasId !== undefined ? this.homes.for(op.canvasId) : this.homes.birth();
    if (!home) return {};
    try {
      return { preferred: await home.freeName() };
    } catch {
      return {};
    }
  }

  /**
   * Everyone the canvases IN SCOPE answer to — live faces (and their labels)
   * plus every name remembered in history, the same set an @-mention resolves
   * against. This is what `heldNames()` in the CLI used to reconstruct by
   * polling; here it is a read the single writer takes mid-claim.
   *
   * It used to walk the whole home. Mechanism 10 stops it at the claiming
   * badge's admissions: name uniqueness is a ROSTER property, so it is asked
   * of exactly the rosters that badge can see. A solo home degenerates to the
   * old walk, because a local daemon's badge is admitted to the canvases it
   * works on — the same code, with the scope emerging from the badge instead
   * of being hard-coded.
   */
  private async heldNames(canvasIds: readonly string[]): Promise<NameHolder[]> {
    const inScope = new Set(canvasIds);
    const holders: NameHolder[] = [];
    for (const canvas of await this.listCanvases()) {
      if (!inScope.has(canvas.id)) continue;
      let state: CanvasState;
      try {
        state = (await this.runtime(canvas.id)).state;
      } catch {
        continue; // a canvas directory mid-delete answers for nobody
      }
      const add = (actor: Actor, live: boolean) =>
        holders.push({ actor, canvas: canvas.title, live });
      add(canvas.createdBy, false);
      add(canvas.updatedBy, false);
      for (const known of collectCanvasNames(state.canvas)) {
        add({ id: known.id, name: known.name }, false);
      }
      for (const session of this.options.liveness?.(canvas.id) ?? []) {
        add(session.actor, true);
        if (session.label) add({ id: session.actor.id, name: session.label }, true);
      }
    }
    return holders;
  }

  private async actors(): Promise<ActorsRuntime> {
    if (!this.actorsRuntime) this.actorsRuntime = await this.store.loadActors();
    return this.actorsRuntime;
  }

  /** Core pipeline. Runs inside the queue. */
  private async applyAndPersist(
    request: SubmitRequest,
    cause: LogEntry["cause"],
  ): Promise<LogEntry> {
    const { op } = request;

    // Internal ops only ever arrive via undo/redo (from stored inverses).
    if (cause === undefined && INTERNAL_OP_TYPES.has(op.type)) {
      throw new OpValidationError("internal-op", `${op.type} cannot be issued directly`);
    }

    if (op.type === "actor.claim") {
      // Home-scoped, and it resolves its own actor — `claim()` is its door.
      throw new OpValidationError("bad-op", "actor.claim goes through Engine.claim");
    }

    if (op.type === "project.create") {
      return this.createProject(request, op);
    }

    const canvasId = request.canvasId;
    if (canvasId === null) {
      throw new OpValidationError("bad-op", "canvasId is required");
    }
    const runtime = await this.runtime(canvasId);

    // Normalize placement so the logged op never references ephemeral client
    // state — and so it records where the item ACTUALLY went.
    //
    // This used to run only for an anchored placement, and passed no height,
    // which meant the collision search in `resolvePlacement` was skipped here
    // and then ran in the reducer instead. The log said `{x: 0, y: 0}` while
    // the item sat at 440,0: the position was decided at apply time and never
    // written down, so replaying the log re-derived it with whatever the
    // search does today. An oplog that has to be re-cooked is not a record.
    //
    // Resolving it fully here makes the logged position already clear, which
    // is what makes the reducer's own call a no-op on the way back: any
    // correct search returns a free spot unchanged, so the layout survives the
    // algorithm changing.
    const normalizedOp: Operation =
      op.type === "item.add"
        ? {
            ...op,
            placement: resolvePlacement(
              runtime.state.canvas,
              op.placement,
              op.width,
              op.height,
              positionIsMeaningful(op),
            ),
          }
        : op;

    const envelope = this.envelope(request, normalizedOp);
    const inverse = invertOperation(runtime.state, normalizedOp);
    const nextState = applyOperation(runtime.state, envelope);
    const seq = runtime.lastSeq + 1;
    const entry: LogEntry = {
      seq,
      envelope,
      inverse,
      ...(cause !== undefined ? { cause } : {}),
      ...(request.group !== undefined ? { group: request.group } : {}),
    };

    await this.appendOrFence(canvasId, entry);

    if (nextState === null) {
      // project.delete: the entry lands in the oplog inside the dir, then the
      // whole dir is parked under deleted-projects/.
      await this.store.softDeleteCanvas(canvasId);
      this.canvases.delete(canvasId);
      this.emit(canvasId, { type: "canvas-deleted" });
      return entry;
    }

    runtime.state = nextState;
    runtime.lastSeq = seq;
    runtime.entries.push(entry);
    runtime.undo.record(entry);
    await this.store.saveSnapshot(canvasId, nextState, seq);
    this.emit(canvasId, { type: "op-applied", entry });
    return entry;
  }

  /**
   * A canvas is born, and with it the standing **link grant** (phase 7).
   *
   * "The status quo demoted to data": every canvas born today carries a link
   * grant, so "the address is the secret" stops being a regime and becomes one
   * revocable row. Written here rather than in the route because this is the
   * one place a canvas comes into existence under this daemon's own writership
   * — the CLI's `bindFresh`, the web app's new-canvas button and a
   * materialized marker all arrive through `project.create`, and a grant
   * written per caller would be a grant somebody forgot.
   *
   * **On a replica this method is not reached at all**, and that is correct:
   * the create FORWARDS (see `forwardSubmit`), so the canvas is born at the
   * home and the home writes the grant that governs it. What lands back here
   * is the home's entry, through `applyRemoteEntry`, which writes this
   * machine's own local row — a different sentence in a different ledger. See
   * `ensureHomeLinkGrant`.
   *
   * The grant is written AFTER the canvas exists, deliberately: a grant for a
   * canvas whose creation then failed would be a row admitting people to
   * nothing, and the desk has no transaction that spans both ledgers.
   */
  private async createProject(
    request: SubmitRequest,
    op: Operation & { type: "project.create" },
  ): Promise<LogEntry> {
    if (await this.store.canvasExists(op.canvasId)) {
      throw new OpValidationError("duplicate-id", `canvas id already exists: ${op.canvasId}`);
    }
    const envelope = this.envelope({ ...request, canvasId: null }, op);
    const state = applyOperation(null, envelope)!;
    const entry: LogEntry = { seq: 1, envelope, inverse: invertOperation(null, op) };
    await this.store.createCanvasDir(op.canvasId);
    await this.appendOrFence(op.canvasId, entry);
    await this.store.saveSnapshot(op.canvasId, state, 1);
    this.canvases.set(op.canvasId, {
      state,
      lastSeq: 1,
      entries: [entry],
      undo: UndoStacks.rebuild([entry]),
    });
    await ensureLinkGrant(this.desk, op.canvasId, request.badgeId);
    return entry;
  }

  private envelope(request: SubmitRequest, op: Operation): OpEnvelope {
    return {
      // The client's name for this op when it brought one (phase 10's
      // idempotency key): the id IS the key, so the key has to be what the
      // log remembers, or the next retry has nothing to find. Shape-checked
      // at the route; absent for everything the daemon writes for itself.
      id: request.opId ?? newOpId(),
      canvasId: request.canvasId,
      actor: request.actor,
      ...(request.clientId !== undefined ? { clientId: request.clientId } : {}),
      ts: new Date().toISOString(),
      op,
    };
  }

  /**
   * Append, and if this writer has been fenced, forget what it thought it
   * knew about that canvas.
   *
   * The refusal means exactly one thing: another instance already claimed
   * this seq, so our `lastSeq` — and everything we derived from it — is
   * stale. Dropping the runtime is the "re-syncs" half of the map's sentence
   * at CANVAS granularity: the next request re-loads from the store, sees the
   * winner's ops, and numbers its own from there. Nothing was applied (the
   * append happens BEFORE `runtime.state` is touched), so there is nothing to
   * roll back — the state we are dropping is merely behind.
   *
   * Process-level fencing — a draining instance that stops serving, or
   * exits — is deliberately NOT here. It is a rollout question, it can only
   * be observed against a real rollout, and phase 5 is where a rollout
   * exists. The lever is named so nobody has to rediscover it.
   */
  private async appendOrFence(canvasId: string, entry: LogEntry): Promise<void> {
    try {
      await this.store.appendLog(canvasId, entry);
    } catch (err) {
      if (err instanceof OplogFencedError) {
        console.error(
          `[isocan] FENCED on ${canvasId}: another writer already holds seq ${entry.seq}. ` +
            `Dropping this canvas's runtime and re-syncing from the store.`,
        );
        this.canvases.delete(canvasId);
      }
      throw err;
    }
  }

  /** The registry's fence. Home-scoped, so it drops the registry runtime
   * rather than a canvas's — same remedy, different cache. */
  private async appendActorsOrFence(entry: LogEntry): Promise<void> {
    try {
      await this.store.appendActorsLog(entry);
    } catch (err) {
      if (err instanceof OplogFencedError) {
        console.error(
          `[isocan] FENCED on the actor registry: another writer already holds seq ${entry.seq}.`,
        );
        this.actorsRuntime = null;
      }
      throw err;
    }
  }

  private async runtime(canvasId: string): Promise<CanvasRuntime> {
    const cached = this.canvases.get(canvasId);
    if (cached) return cached;
    const loaded = await this.store.load(canvasId);
    if (!loaded) throw new CanvasNotFoundError(canvasId);
    const runtime: CanvasRuntime = {
      state: loaded.state,
      lastSeq: loaded.lastSeq,
      entries: loaded.entries,
      undo: UndoStacks.rebuild(loaded.entries),
    };
    this.canvases.set(canvasId, runtime);
    return runtime;
  }
}

/**
 * Choose what op performs a redo. Under actor-scoped undo, actors interleave,
 * so "inverse of the undo entry" can embed OTHER actors' values for
 * value-carrying ops (it captures state at undo time). Those redo by
 * re-applying the actor's ORIGINAL op — its values are the actor's intent.
 * Structural creations instead redo via the undo's stored inverse, which
 * restores full fidelity (trash contents, thread snapshots, version
 * authorship) that re-running the original op would lose or violate.
 */
function redoOpFor(target: LogEntry, undoEntry: LogEntry): Operation {
  switch (target.envelope.op.type) {
    case "item.add": // re-add would collide with the trashed item → restore it
    case "item.addVersion": // restoreVersion keeps original authorship
    case "thread.create": // thread.restore keeps replies added before the undo
    case "thread.reply": // comment.restore keeps author + timestamp
      return undoEntry.inverse!;
    default:
      return target.envelope.op;
  }
}

/**
 * Adapt a stored inverse to the current state before applying it as
 * undo/redo. Batch ops are atomic in the reducer, so one member deleted by
 * another actor would invalidate the whole inverse — shrink it to the members
 * that still apply instead. Returns null when nothing survives; non-batch ops
 * pass through untouched (the apply-time validation decides their fate).
 */
function repairInverse(state: CanvasState, op: Operation): Operation | null {
  switch (op.type) {
    case "items.move": {
      const moves = op.moves.filter((move) => state.canvas.items[move.itemId] !== undefined);
      if (moves.length === 0) return null;
      return moves.length === op.moves.length ? op : { ...op, moves };
    }
    case "items.delete": {
      const itemIds = op.itemIds.filter((id) => state.canvas.items[id] !== undefined);
      if (itemIds.length === 0) return null;
      return itemIds.length === op.itemIds.length ? op : { ...op, itemIds };
    }
    case "items.restore": {
      const inTrash = new Set(state.canvas.trash.map((t) => t.item.id));
      const itemIds = op.itemIds.filter((id) => inTrash.has(id));
      if (itemIds.length === 0) return null;
      return itemIds.length === op.itemIds.length ? op : { ...op, itemIds };
    }
    default:
      return op;
  }
}
