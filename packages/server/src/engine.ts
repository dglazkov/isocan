import type {
  Actor,
  ActorBindingRecord,
  ActorClaimOp,
  ActorColors,
  ActorNames,
  ActorRegistry,
  ActorSetColorOp,
  CanvasSnapshotResponse,
  ClaimContext,
  LogEntry,
  NameHolder,
  OpEnvelope,
  Operation,
  PresenceSession,
  Project,
  ProjectState,
  ServerMessage,
  SlashCommand,
  UploadTicket,
} from "@isocan/core";
import {
  INTERNAL_OP_TYPES,
  OplogFencedError,
  OpValidationError,
  DEFAULT_COMMANDS,
  actorNames,
  applyActorColor,
  mergeCommands,
  applyClaim,
  applyOperation,
  claimsActor,
  collectCanvasNames,
  invertOperation,
  newOpId,
  notYourActor,
  resolvePlacement,
  SHELF,
} from "@isocan/core";
import type { BlobUploadRequest, Store } from "./store.ts";
import type { Desk } from "./desk.ts";
import { UndoStacks } from "./undo.ts";
import {
  DEFAULT_GRACE_MS,
  DEFAULT_KEEP_OPS,
  chooseRetained,
  reachableHashes,
  type GcOptions,
  type GcReport,
} from "./gc.ts";

interface ProjectRuntime {
  state: ProjectState;
  lastSeq: number;
  entries: LogEntry[];
  undo: UndoStacks;
}

interface ActorsRuntime {
  registry: ActorRegistry;
  lastSeq: number;
}

export interface EngineOptions {
  /** Who is visibly on a canvas right now — presence, which lives outside
   * the engine. Claims consult it so a live face holds its name. */
  liveness?: (projectId: string) => PresenceSession[];
}

export class ProjectNotFoundError extends Error {
  constructor(id: string) {
    super(`project not found: ${id}`);
    this.name = "ProjectNotFoundError";
  }
}

export class NothingToUndoError extends Error {
  constructor(kind: "undo" | "redo", actorName?: string) {
    super(actorName ? `nothing to ${kind} for ${actorName}` : `nothing to ${kind}`);
    this.name = "NothingToUndoError";
  }
}

export interface SubmitRequest {
  projectId: string | null;
  actor: Actor;
  clientId?: string;
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

type EventListener = (projectId: string, message: ServerMessage) => void;

/**
 * The single op engine. ALL mutations — from the CLI, the web app, and
 * undo/redo — funnel through one promise chain, giving single-writer
 * discipline over both the in-memory state and the files.
 *
 * Per mutation: validate → invert (from pre-state) → apply → append+fsync
 * oplog → atomically rewrite snapshots → broadcast.
 */
export class Engine {
  private projects = new Map<string, ProjectRuntime>();
  private actorsRuntime: ActorsRuntime | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private listeners = new Set<EventListener>();
  private colorListeners = new Set<(colors: ActorColors, actorId: string) => void>();

  constructor(
    private readonly store: Store,
    /** The desk. The engine writes the claims half through it and never
     * touches the transport's half (badges, secrets, admissions). */
    private readonly desk: Desk,
    private readonly options: EngineOptions = {},
  ) {}

  /** Subscribe to project events; returns an unsubscribe function. */
  onEvent(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(projectId: string, message: ServerMessage): void {
    for (const listener of this.listeners) listener(projectId, message);
  }

  /** Serialize all mutations through one chain. */
  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const result = this.queue.then(work);
    this.queue = result.catch(() => {});
    return result;
  }

  async listProjects(): Promise<Project[]> {
    return this.store.listProjects();
  }

  async getSnapshot(projectId: string): Promise<CanvasSnapshotResponse> {
    const runtime = await this.runtime(projectId);
    return {
      project: runtime.state.project,
      canvas: runtime.state.canvas,
      lastSeq: runtime.lastSeq,
      colors: await this.actorColors(),
      names: await this.actorNames(),
    };
  }

  /** Chosen identity colors, actor id → hex. Everything absent is derived
   * from the id, so this map is only ever the exceptions. */
  async actorColors(): Promise<ActorColors> {
    const { registry } = await this.actors();
    return registry.colors;
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
      const runtime = await this.actors();
      const ts = new Date().toISOString();
      const registry = applyActorColor(runtime.registry, request.op);
      const envelope: OpEnvelope = {
        id: newOpId(),
        projectId: null,
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
      this.identityChanged(registry.colors, request.op.actorId);
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
  async appearances(actorId: string, projectIds: Iterable<string>): Promise<string[]> {
    const found: string[] = [];
    for (const projectId of projectIds) {
      let state: ProjectState;
      try {
        state = (await this.runtime(projectId)).state;
      } catch {
        continue; // a canvas mid-delete has nobody on it
      }
      const here =
        state.project.createdBy.id === actorId ||
        state.project.updatedBy.id === actorId ||
        collectCanvasNames(state.canvas).some((known) => known.id === actorId) ||
        (this.options.liveness?.(projectId) ?? []).some((s) => s.actor.id === actorId);
      if (here) found.push(projectId);
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

  async getLog(projectId: string, sinceSeq = 0): Promise<LogEntry[]> {
    const runtime = await this.runtime(projectId);
    return runtime.entries.filter((entry) => entry.seq > sinceSeq);
  }

  submit(request: SubmitRequest): Promise<LogEntry> {
    return this.enqueue(async () => {
      await this.requireActor(request.badgeId, request.actor.id);
      return this.applyAndPersist(request, undefined);
    });
  }

  /**
   * Naming yourself, atomically (#57). A writer like any other: two agents
   * claiming at the same moment serialize on this chain, so the second is
   * refused or handed a different name by construction — never by a
   * client-side pre-check both of them can pass at once.
   */
  claim(request: ClaimRequest): Promise<LogEntry> {
    return this.enqueue(() => this.applyClaimAndPersist(request));
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
        ...(row.projectId !== undefined ? { projectId: row.projectId } : {}),
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
          ...(row.projectId !== undefined ? { projectId: row.projectId } : {}),
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
    projectId: string,
    data: Buffer,
    meta: { mimeType: string; filename: string },
  ): Promise<{ blobHash: string; size: number; mimeType: string }> {
    return this.enqueue(() => this.store.putBlob(projectId, data, meta));
  }

  /**
   * Somewhere to put bytes this daemon must not receive, or null when the
   * backing has no such thing (every file home). Deliberately NOT on the
   * single-writer chain: it reads one blob record and mints a URL, writing
   * nothing, and minting can involve a round trip to a signing API — putting
   * it on the chain would stall every op behind somebody's video.
   */
  beginUpload(projectId: string, request: BlobUploadRequest): Promise<UploadTicket | null> {
    return this.store.beginUpload(projectId, request);
  }

  /**
   * Name bytes that arrived without us. ON the chain, because GC is on the
   * chain: a register that lands mid-sweep would otherwise re-name a blob the
   * sweep has just decided is garbage, and the item pointing at it would 404
   * forever.
   */
  registerBlob(
    projectId: string,
    request: BlobUploadRequest,
  ): Promise<{ blobHash: string; size: number; mimeType: string }> {
    return this.enqueue(() => this.store.registerBlob(projectId, request));
  }

  /**
   * Actor-scoped undo: walk THIS actor's stack. Stored inverses are applied
   * as-is when possible (stale values are accepted — undo restores what you
   * changed); inverses invalidated by other actors' ops are repaired (batch
   * ops shrink to their surviving members) or skipped entirely.
   */
  undo(projectId: string, actor: Actor, badgeId: string, clientId?: string): Promise<LogEntry> {
    return this.enqueue(async () => {
      // Checked here as well as on `submit`, and for a reason of its own:
      // undo is actor-scoped, so naming somebody else is not a slip, it is
      // undoing their work.
      await this.requireActor(badgeId, actor.id);
      const runtime = await this.runtime(projectId);
      for (;;) {
        const targetSeq = runtime.undo.nextUndoTarget(actor.id);
        if (targetSeq === null) throw new NothingToUndoError("undo", actor.name);
        const target = runtime.entries.find((entry) => entry.seq === targetSeq)!;
        const op = repairInverse(runtime.state, target.inverse!);
        if (op !== null) {
          try {
            return await this.applyAndPersist(
              { projectId, actor, op, badgeId, ...(clientId !== undefined ? { clientId } : {}) },
              { kind: "undo", targetSeq },
            );
          } catch (err) {
            if (!(err instanceof OpValidationError)) throw err;
          }
        }
        // The inverse no longer applies (its objects were changed by someone
        // else); its effect is already gone, so drop it and try the next.
        runtime.undo.discardUndoTarget(actor.id, targetSeq);
      }
    });
  }

  redo(projectId: string, actor: Actor, badgeId: string, clientId?: string): Promise<LogEntry> {
    return this.enqueue(async () => {
      await this.requireActor(badgeId, actor.id);
      const runtime = await this.runtime(projectId);
      for (;;) {
        const next = runtime.undo.nextRedoTarget(actor.id);
        if (next === null) throw new NothingToUndoError("redo", actor.name);
        const target = runtime.entries.find((entry) => entry.seq === next.targetSeq)!;
        const undoEntry = runtime.entries.find((entry) => entry.seq === next.undoSeq)!;
        const op = repairInverse(runtime.state, redoOpFor(target, undoEntry));
        if (op !== null) {
          try {
            return await this.applyAndPersist(
              { projectId, actor, op, badgeId, ...(clientId !== undefined ? { clientId } : {}) },
              { kind: "redo", targetSeq: next.targetSeq },
            );
          } catch (err) {
            if (!(err instanceof OpValidationError)) throw err;
          }
        }
        runtime.undo.discardRedoTarget(actor.id, next.targetSeq);
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
  gc(projectId: string, options: GcOptions = {}): Promise<GcReport> {
    return this.enqueue(async () => {
      const runtime = await this.runtime(projectId);
      const keepOps = options.keepOps ?? DEFAULT_KEEP_OPS;
      const graceMs = options.graceMs ?? DEFAULT_GRACE_MS;
      const dryRun = options.dryRun ?? false;

      const retained = chooseRetained(runtime.entries, keepOps);
      const retainedSeqs = new Set(retained.map((entry) => entry.seq));
      const dropped = runtime.entries.filter((entry) => !retainedSeqs.has(entry.seq));

      const marked = reachableHashes(runtime.state, retained);
      const listing = await this.store.listBlobs(projectId);

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
        await this.store.compactOplog(projectId, retained, dropped);
        runtime.entries = retained;
        runtime.undo = UndoStacks.rebuild(retained);
      }
      if (sweep.length > 0) await this.store.deleteBlobs(projectId, sweep);
      return report;
    });
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
      projectId: null,
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
  ): Promise<ClaimContext> {
    const badge = await this.desk.badge(request.badgeId);
    const canvasIds = (badge?.admissions ?? []).map((a) => a.canvasId);
    // The room this name is being taken in counts even before the badge has
    // been let into it — a browser names itself at the identity dialog,
    // before it has fetched anything. See `ActorClaimOp.projectId`.
    const from = request.op.projectId;
    if (from !== undefined && !canvasIds.includes(from)) canvasIds.push(from);
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
      scoped,
      // Only `as` asks a global question, so only `as` pays for one.
      claimants: request.op.as ? await this.desk.claimants(request.op.as) : [],
      held: await this.heldNames(canvasIds),
      now,
    };
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
    for (const project of await this.listProjects()) {
      if (!inScope.has(project.id)) continue;
      let state: ProjectState;
      try {
        state = (await this.runtime(project.id)).state;
      } catch {
        continue; // a project directory mid-delete answers for nobody
      }
      const add = (actor: Actor, live: boolean) =>
        holders.push({ actor, project: project.title, live });
      add(project.createdBy, false);
      add(project.updatedBy, false);
      for (const known of collectCanvasNames(state.canvas)) {
        add({ id: known.id, name: known.name }, false);
      }
      for (const session of this.options.liveness?.(project.id) ?? []) {
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

    const projectId = request.projectId;
    if (projectId === null) {
      throw new OpValidationError("bad-op", "projectId is required");
    }
    const runtime = await this.runtime(projectId);

    // Normalize placement so the logged op never references ephemeral
    // client selection state.
    const normalizedOp: Operation =
      op.type === "item.add" && "anchorItemId" in op.placement
        ? {
            ...op,
            placement: resolvePlacement(runtime.state.canvas, op.placement, op.width),
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
    };

    await this.appendOrFence(projectId, entry);

    if (nextState === null) {
      // project.delete: the entry lands in the oplog inside the dir, then the
      // whole dir is parked under deleted-projects/.
      await this.store.softDeleteProject(projectId);
      this.projects.delete(projectId);
      this.emit(projectId, { type: "project-deleted" });
      return entry;
    }

    runtime.state = nextState;
    runtime.lastSeq = seq;
    runtime.entries.push(entry);
    runtime.undo.record(entry);
    await this.store.saveSnapshot(projectId, nextState, seq);
    this.emit(projectId, { type: "op-applied", entry });
    return entry;
  }

  private async createProject(
    request: SubmitRequest,
    op: Operation & { type: "project.create" },
  ): Promise<LogEntry> {
    if (await this.store.projectExists(op.projectId)) {
      throw new OpValidationError("duplicate-id", `project id already exists: ${op.projectId}`);
    }
    const envelope = this.envelope({ ...request, projectId: null }, op);
    const state = applyOperation(null, envelope)!;
    const entry: LogEntry = { seq: 1, envelope, inverse: invertOperation(null, op) };
    await this.store.createProjectDir(op.projectId);
    await this.appendOrFence(op.projectId, entry);
    await this.store.saveSnapshot(op.projectId, state, 1);
    this.projects.set(op.projectId, {
      state,
      lastSeq: 1,
      entries: [entry],
      undo: UndoStacks.rebuild([entry]),
    });
    return entry;
  }

  private envelope(request: SubmitRequest, op: Operation): OpEnvelope {
    return {
      id: newOpId(),
      projectId: request.projectId,
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
  private async appendOrFence(projectId: string, entry: LogEntry): Promise<void> {
    try {
      await this.store.appendLog(projectId, entry);
    } catch (err) {
      if (err instanceof OplogFencedError) {
        console.error(
          `[isocan] FENCED on ${projectId}: another writer already holds seq ${entry.seq}. ` +
            `Dropping this canvas's runtime and re-syncing from the store.`,
        );
        this.projects.delete(projectId);
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

  private async runtime(projectId: string): Promise<ProjectRuntime> {
    const cached = this.projects.get(projectId);
    if (cached) return cached;
    const loaded = await this.store.load(projectId);
    if (!loaded) throw new ProjectNotFoundError(projectId);
    const runtime: ProjectRuntime = {
      state: loaded.state,
      lastSeq: loaded.lastSeq,
      entries: loaded.entries,
      undo: UndoStacks.rebuild(loaded.entries),
    };
    this.projects.set(projectId, runtime);
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
function repairInverse(state: ProjectState, op: Operation): Operation | null {
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
