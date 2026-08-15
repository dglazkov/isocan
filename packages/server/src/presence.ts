import type { Actor, CanvasState, Operation, PresenceSession } from "@isocan/core";
import { newId } from "@isocan/core";

/**
 * The ephemeral plane. Presence lives in daemon memory and WS fan-out only —
 * never the oplog, never storage, never undo. Sessions expire on TTL so a
 * crashed agent's cursor evaporates instead of haunting the canvas.
 */

interface SessionState extends PresenceSession {
  lastSeenMs: number;
}

// Long enough for an agent to think between commands; ops auto-revive
// anyway, so this mostly bounds how long an idle cursor lingers.
export const SESSION_TTL_MS = 5 * 60_000;
const SWEEP_INTERVAL_MS = 10_000;

export class PresenceHub {
  private rooms = new Map<string, Map<string, SessionState>>();
  private listeners: Array<(projectId: string) => void> = [];
  private sweeper: ReturnType<typeof setInterval>;

  constructor(private readonly ttlMs = SESSION_TTL_MS) {
    this.sweeper = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS);
    this.sweeper.unref?.();
  }

  close(): void {
    clearInterval(this.sweeper);
  }

  onChange(listener: (projectId: string) => void): void {
    this.listeners.push(listener);
  }

  private emit(projectId: string): void {
    for (const listener of this.listeners) listener(projectId);
  }

  private room(projectId: string): Map<string, SessionState> {
    let room = this.rooms.get(projectId);
    if (!room) {
      room = new Map();
      this.rooms.set(projectId, room);
    }
    return room;
  }

  createSession(
    projectId: string,
    actor: Actor,
    kind: "web" | "cli",
    options: { label?: string; sessionId?: string } = {},
  ): PresenceSession {
    const session: SessionState = {
      sessionId: options.sessionId ?? newId("ses"),
      actor,
      kind,
      label: options.label ?? null,
      cursor: null,
      selection: [],
      status: null,
      lastSeen: new Date().toISOString(),
      lastSeenMs: Date.now(),
    };
    this.room(projectId).set(session.sessionId, session);
    this.emit(projectId);
    return session;
  }

  /** Update + heartbeat. Returns false if the session is gone (expired). */
  touch(
    projectId: string,
    sessionId: string,
    patch: {
      cursor?: { x: number; y: number } | null;
      selection?: string[];
      status?: string | null;
    } = {},
  ): boolean {
    const session = this.rooms.get(projectId)?.get(sessionId);
    if (!session) return false;
    if (patch.cursor !== undefined) session.cursor = patch.cursor;
    if (patch.selection !== undefined) session.selection = patch.selection;
    if (patch.status !== undefined) session.status = patch.status;
    session.lastSeenMs = Date.now();
    session.lastSeen = new Date().toISOString();
    this.emit(projectId);
    return true;
  }

  endSession(projectId: string, sessionId: string): void {
    const room = this.rooms.get(projectId);
    if (room?.delete(sessionId)) this.emit(projectId);
  }

  roster(projectId: string): PresenceSession[] {
    const room = this.rooms.get(projectId);
    if (!room) return [];
    return [...room.values()].map(({ lastSeenMs, ...session }) => session);
  }

  /** Op piggyback: an op whose clientId matches a session moves that
   * session's cursor to the op's locus — presence traces the real work.
   * A CLI session that expired mid-task (ids are "ses_…") is auto-revived
   * from the op's own actor: working makes you visible again. */
  opApplied(
    projectId: string,
    clientId: string | undefined,
    actor: Actor,
    op: Operation,
    canvas: CanvasState,
  ): void {
    if (!clientId) return;
    let session = this.rooms.get(projectId)?.get(clientId);
    if (!session && clientId.startsWith("ses_")) {
      this.createSession(projectId, actor, "cli", { sessionId: clientId });
      session = this.rooms.get(projectId)?.get(clientId);
    }
    if (!session) return;
    const locus = opLocus(op, canvas);
    this.touch(projectId, clientId, locus ? { cursor: locus } : {});
  }

  private sweep(): void {
    const cutoff = Date.now() - this.ttlMs;
    for (const [projectId, room] of this.rooms) {
      let changed = false;
      for (const [sessionId, session] of room) {
        if (session.lastSeenMs < cutoff) {
          room.delete(sessionId);
          changed = true;
        }
      }
      if (room.size === 0) this.rooms.delete(projectId);
      if (changed) this.emit(projectId);
    }
  }
}

/** Where on the canvas an op "happened", given post-apply state. */
export function opLocus(op: Operation, canvas: CanvasState): { x: number; y: number } | null {
  const itemCenter = (itemId: string) => {
    const item = canvas.items[itemId] ?? canvas.trash.find((t) => t.item.id === itemId)?.item;
    return item ? { x: item.x + item.width / 2, y: item.y + item.height / 2 } : null;
  };
  switch (op.type) {
    case "item.add":
    case "item.move":
    case "item.resize":
    case "item.update":
    case "item.addVersion":
    case "item.setCurrentVersion":
    case "item.restoreVersion":
    case "item.delete":
    case "item.restore":
      return itemCenter(op.itemId);
    case "items.move":
      return itemCenter(op.moves[0]!.itemId);
    case "items.delete":
    case "items.restore":
      return itemCenter(op.itemIds[0]!);
    case "thread.create":
      return op.anchorItemId && canvas.items[op.anchorItemId]
        ? {
            x: canvas.items[op.anchorItemId]!.x + op.x,
            y: canvas.items[op.anchorItemId]!.y + op.y,
          }
        : { x: op.x, y: op.y };
    case "thread.reply":
    case "thread.delete":
    case "comment.remove":
    case "comment.restore": {
      const thread = canvas.threads[op.threadId];
      if (!thread) return null;
      if (thread.anchorItemId && canvas.items[thread.anchorItemId]) {
        const anchor = canvas.items[thread.anchorItemId]!;
        return { x: anchor.x + thread.x, y: anchor.y + thread.y };
      }
      return { x: thread.x, y: thread.y };
    }
    default:
      return null;
  }
}
