import type {
  Actor,
  CanvasSnapshotResponse,
  LogEntry,
  OpEnvelope,
  Operation,
  Project,
  ProjectState,
  ServerMessage,
} from "@isocan/core";
import {
  INTERNAL_OP_TYPES,
  OpValidationError,
  applyOperation,
  invertOperation,
  newOpId,
  resolvePlacement,
} from "@isocan/core";
import type { Store } from "./store.ts";
import { UndoStack } from "./undo.ts";

interface ProjectRuntime {
  state: ProjectState;
  lastSeq: number;
  entries: LogEntry[];
  undo: UndoStack;
}

export class ProjectNotFoundError extends Error {
  constructor(id: string) {
    super(`project not found: ${id}`);
    this.name = "ProjectNotFoundError";
  }
}

export class NothingToUndoError extends Error {
  constructor(kind: "undo" | "redo") {
    super(`nothing to ${kind}`);
    this.name = "NothingToUndoError";
  }
}

export interface SubmitRequest {
  projectId: string | null;
  actor: Actor;
  clientId?: string;
  op: Operation;
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
  private queue: Promise<unknown> = Promise.resolve();
  private listeners: EventListener[] = [];

  constructor(private readonly store: Store) {}

  onEvent(listener: EventListener): void {
    this.listeners.push(listener);
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

  undo(projectId: string, actor: Actor, clientId?: string): Promise<LogEntry> {
    return this.enqueue(async () => {
      const runtime = await this.runtime(projectId);
      const targetSeq = runtime.undo.nextUndoTarget();
      if (targetSeq === null) throw new NothingToUndoError("undo");
      const target = runtime.entries.find((entry) => entry.seq === targetSeq)!;
      return this.applyAndPersist(
        { projectId, actor, op: target.inverse!, ...(clientId !== undefined ? { clientId } : {}) },
        { kind: "undo", targetSeq },
      );
    });
  }

  redo(projectId: string, actor: Actor, clientId?: string): Promise<LogEntry> {
    return this.enqueue(async () => {
      const runtime = await this.runtime(projectId);
      const next = runtime.undo.nextRedoTarget();
      if (next === null) throw new NothingToUndoError("redo");
      const undoEntry = runtime.entries.find((entry) => entry.seq === next.undoSeq)!;
      return this.applyAndPersist(
        {
          projectId,
          actor,
          op: undoEntry.inverse!,
          ...(clientId !== undefined ? { clientId } : {}),
        },
        { kind: "redo", targetSeq: next.targetSeq },
      );
    });
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
      undo: UndoStack.rebuild([entry]),
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
      undo: UndoStack.rebuild(loaded.entries),
    };
    this.projects.set(projectId, runtime);
    return runtime;
  }
}
