import type {
  Actor,
  ActorBindingRecord,
  ActorClaimOp,
  ActorRegistry,
  CanvasSnapshotResponse,
  LogEntry,
  NameHolder,
  OpEnvelope,
  Operation,
  PresenceSession,
  Project,
  ProjectState,
  ServerMessage,
} from "@isocan/core";
import {
  INTERNAL_OP_TYPES,
  OpValidationError,
  applyClaim,
  applyOperation,
  collectCanvasNames,
  invertOperation,
  newOpId,
  resolvePlacement,
} from "@isocan/core";
import type { Store } from "./store.ts";
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
}

export interface ClaimRequest {
  op: ActorClaimOp;
  clientId?: string;
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

  constructor(
    private readonly store: Store,
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
    };
  }

  async getLog(projectId: string, sinceSeq = 0): Promise<LogEntry[]> {
    const runtime = await this.runtime(projectId);
    return runtime.entries.filter((entry) => entry.seq > sinceSeq);
  }

  submit(request: SubmitRequest): Promise<LogEntry> {
    return this.enqueue(() => this.applyAndPersist(request, undefined));
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

  /** Who the given session keys (or everyone, when omitted) speak as. */
  async actorBindings(keys?: string[] | null): Promise<ActorBindingRecord[]> {
    const { registry } = await this.actors();
    const wanted = keys ? new Set(keys) : null;
    return Object.entries(registry.claims)
      .filter(([key]) => !wanted || wanted.has(key))
      .map(([key, { boundAt, ...actor }]) => ({ key, actor, boundAt }));
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
   * Actor-scoped undo: walk THIS actor's stack. Stored inverses are applied
   * as-is when possible (stale values are accepted — undo restores what you
   * changed); inverses invalidated by other actors' ops are repaired (batch
   * ops shrink to their surviving members) or skipped entirely.
   */
  undo(projectId: string, actor: Actor, clientId?: string): Promise<LogEntry> {
    return this.enqueue(async () => {
      const runtime = await this.runtime(projectId);
      for (;;) {
        const targetSeq = runtime.undo.nextUndoTarget(actor.id);
        if (targetSeq === null) throw new NothingToUndoError("undo", actor.name);
        const target = runtime.entries.find((entry) => entry.seq === targetSeq)!;
        const op = repairInverse(runtime.state, target.inverse!);
        if (op !== null) {
          try {
            return await this.applyAndPersist(
              { projectId, actor, op, ...(clientId !== undefined ? { clientId } : {}) },
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

  redo(projectId: string, actor: Actor, clientId?: string): Promise<LogEntry> {
    return this.enqueue(async () => {
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
              { projectId, actor, op, ...(clientId !== undefined ? { clientId } : {}) },
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
      const index = await this.store.blobIndex(projectId);

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
      for (const [hash, meta] of Object.entries(index)) {
        if (marked.has(hash)) {
          report.reachableBlobs += 1;
          report.reachableBytes += meta.size;
          continue;
        }
        const age = await this.store.blobAgeMs(projectId, meta);
        if (age !== null && age < graceMs) {
          report.skippedRecentBlobs += 1;
          continue;
        }
        sweep.push(hash);
        report.sweptBlobs += 1;
        report.sweptBytes += meta.size;
      }

      if (dryRun) return report;

      // Order matters for crash safety: archive first, then the atomic log
      // rewrite, and only then delete blob bytes. A crash at any point leaves
      // either extra history or extra garbage — both harmless and re-collectable.
      if (dropped.length > 0) {
        await this.store.archiveOplogEntries(projectId, dropped);
        await this.store.rewriteOplog(projectId, retained);
        runtime.entries = retained;
        runtime.undo = UndoStacks.rebuild(retained);
      }
      if (sweep.length > 0) {
        for (const hash of sweep) {
          await this.store.deleteBlobFile(projectId, index[hash]!);
          delete index[hash];
        }
        await this.store.writeBlobIndex(projectId, index);
      }
      return report;
    });
  }

  private async applyClaimAndPersist(request: ClaimRequest): Promise<LogEntry> {
    const runtime = await this.actors();
    const ts = new Date().toISOString();
    const { registry, actor } = applyClaim(
      { registry: runtime.registry, held: await this.heldNames(), now: ts },
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
    await this.store.appendActorsLog(entry);
    runtime.registry = registry;
    runtime.lastSeq = seq;
    await this.store.saveActors(registry, seq);
    return entry;
  }

  /**
   * Everyone every canvas answers to — live faces (and their labels) plus
   * every name remembered in history, the same set an @-mention resolves
   * against. This is what `heldNames()` in the CLI used to reconstruct by
   * polling; here it is a read the single writer takes mid-claim.
   */
  private async heldNames(): Promise<NameHolder[]> {
    const holders: NameHolder[] = [];
    for (const project of await this.listProjects()) {
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

    await this.store.appendLog(projectId, entry);

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
    await this.store.appendLog(op.projectId, entry);
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
