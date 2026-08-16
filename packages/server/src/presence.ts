import type { Actor, CanvasState, Operation, PresenceActivity, PresenceSession } from "@isocan/core";
import { newId } from "@isocan/core";

/**
 * The ephemeral plane. Presence lives in daemon memory and WS fan-out only —
 * never the oplog, never storage, never undo. Sessions expire on TTL so a
 * crashed agent's cursor evaporates instead of haunting the canvas.
 *
 * Two scopes. A PROJECT session is on one canvas and carries a cursor. An
 * ON-CALL session belongs to the home: an agent parked on `isocan wait` is
 * listening to every canvas, so it surfaces in every canvas's roster — that
 * is what makes it @-mentionable from a space it has never touched.
 */

interface SessionState extends PresenceSession {
  lastSeenMs: number;
  /** The status was said out loud (`session say`), not derived — inferred
   * narration must not displace it. Cleared when working resolves into a
   * posted comment. */
  statusSticky: boolean;
}

// Long enough for an agent to think between commands; ops auto-revive
// anyway, so this mostly bounds how long an idle cursor lingers.
export const SESSION_TTL_MS = 5 * 60_000;
const SWEEP_INTERVAL_MS = 10_000;

export class PresenceHub {
  private rooms = new Map<string, Map<string, SessionState>>();
  /** On call for the whole home — visible from every canvas. */
  private onCall = new Map<string, SessionState>();
  private listeners: Array<(projectId: string | null) => void> = [];
  private sweeper: ReturnType<typeof setInterval>;

  constructor(private readonly ttlMs = SESSION_TTL_MS) {
    this.sweeper = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS);
    this.sweeper.unref?.();
  }

  close(): void {
    clearInterval(this.sweeper);
  }

  /** `null` means every canvas changed — an on-call session came or went. */
  onChange(listener: (projectId: string | null) => void): void {
    this.listeners.push(listener);
  }

  private emit(projectId: string | null): void {
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
    const session = blankSession(actor, kind, "project", options);
    this.room(projectId).set(session.sessionId, session);
    this.emit(projectId);
    return session;
  }

  /** Park an actor in the home: reachable from every canvas at once. */
  createOnCall(actor: Actor, options: { label?: string; sessionId?: string } = {}): PresenceSession {
    const session = blankSession(actor, "cli", "home", options);
    this.onCall.set(session.sessionId, session);
    this.emit(null);
    return session;
  }

  /** Update + heartbeat. Returns false if the session is gone (expired). */
  touch(
    projectId: string,
    sessionId: string,
    patch: {
      /** Who is holding this session now. Presence is client-asserted on every
       * beat, so renaming yourself — or becoming someone else entirely —
       * lands on every other screen without dropping the socket. */
      actor?: Actor;
      cursor?: { x: number; y: number } | null;
      selection?: string[];
      status?: string | null;
      statusSource?: "explicit" | "lifecycle" | "inferred";
      activity?: PresenceActivity | null;
    } = {},
  ): boolean {
    const session = this.rooms.get(projectId)?.get(sessionId);
    if (!session) return false;
    patchSession(session, patch);
    this.emit(projectId);
    return true;
  }

  /** Heartbeat for an on-call session. False once it has expired. */
  touchOnCall(
    sessionId: string,
    patch: {
      status?: string | null;
      statusSource?: "explicit" | "lifecycle" | "inferred";
      activity?: PresenceActivity | null;
    } = {},
  ): boolean {
    const session = this.onCall.get(sessionId);
    if (!session) return false;
    patchSession(session, patch);
    this.emit(null);
    return true;
  }

  endSession(projectId: string, sessionId: string): void {
    const room = this.rooms.get(projectId);
    if (room?.delete(sessionId)) this.emit(projectId);
  }

  endOnCall(sessionId: string): void {
    if (this.onCall.delete(sessionId)) this.emit(null);
  }

  /**
   * Who this canvas sees: everyone actually on it, then everyone on call for
   * the home. An actor already here is not listed twice — the session with a
   * cursor is the truer one.
   */
  roster(projectId: string): PresenceSession[] {
    const here = [...(this.rooms.get(projectId)?.values() ?? [])];
    const present = new Set(here.map((session) => session.actor.id));
    const listening = [...this.onCall.values()].filter((s) => !present.has(s.actor.id));
    return [...here, ...listening].map(({ lastSeenMs, statusSticky, ...session }) => session);
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
    // An applied op ends any "working" animation — working resolves into
    // done — and retires the narration that announced it. A posted comment is
    // the receipt for the whole work episode, so it clears even a status the
    // actor said out loud; other ops only sweep derived narration.
    const receipt = op.type === "thread.create" || op.type === "thread.reply";
    this.touch(projectId, clientId, {
      activity: null,
      status: null,
      statusSource: receipt ? "lifecycle" : "inferred",
      ...(locus ? { cursor: locus } : {}),
    });
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
    let dropped = false;
    for (const [sessionId, session] of this.onCall) {
      if (session.lastSeenMs < cutoff) {
        this.onCall.delete(sessionId);
        dropped = true;
      }
    }
    if (dropped) this.emit(null);
  }
}

function blankSession(
  actor: Actor,
  kind: "web" | "cli",
  scope: "project" | "home",
  options: { label?: string; sessionId?: string },
): SessionState {
  return {
    sessionId: options.sessionId ?? newId("ses"),
    actor,
    kind,
    scope,
    label: options.label ?? null,
    cursor: null,
    selection: [],
    status: null,
    activity: null,
    lastSeen: new Date().toISOString(),
    lastSeenMs: Date.now(),
    statusSticky: false,
  };
}

function patchSession(
  session: SessionState,
  patch: {
    actor?: Actor;
    cursor?: { x: number; y: number } | null;
    selection?: string[];
    status?: string | null;
    statusSource?: "explicit" | "lifecycle" | "inferred";
    activity?: PresenceActivity | null;
  },
): void {
  if (patch.actor) session.actor = patch.actor;
  if (patch.cursor !== undefined) session.cursor = patch.cursor;
  if (patch.selection !== undefined) session.selection = patch.selection;
  if (patch.status !== undefined) {
    // Words the actor said outrank narration the system derived; lifecycle
    // turns (parking, waking, a posted comment) outrank everything.
    const source = patch.statusSource ?? "explicit";
    if (source !== "inferred" || !session.statusSticky) {
      session.status = patch.status;
      session.statusSticky = source === "explicit" && patch.status !== null;
    }
  }
  if (patch.activity !== undefined) session.activity = patch.activity;
  session.lastSeenMs = Date.now();
  session.lastSeen = new Date().toISOString();
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
    case "thread.setAnchor":
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
