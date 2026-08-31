import type { Actor, CanvasContents, Operation, PresenceActivity, PresenceSession } from "@isocan/core";
import { newId } from "@isocan/core";

/**
 * The ephemeral plane. Presence lives in daemon memory and WS fan-out only —
 * never the oplog, never storage, never undo. Sessions expire on TTL so a
 * crashed agent's cursor evaporates instead of haunting the canvas.
 *
 * Every session is on ONE canvas. There used to be a second, home-wide
 * scope — "on call", an agent parked on `isocan wait` surfacing in every
 * canvas's roster — retired with #60: an agent belongs to the directory it
 * works in, and its canvas is where you reach it.
 */

interface SessionState extends PresenceSession {
  /**
   * Where this face came from: `null` when the session belongs to a client of
   * THIS daemon, or the key of the connection that mirrored it in.
   *
   * The ephemeral plane is the one thing phase 6 has to carry in BOTH
   * directions — a local daemon relays its own faces up to the home, and the
   * home's roster comes back down so `isocan who` and a parked `isocan wait`
   * see the whole canvas. One field makes both halves safe:
   *
   * - **No relay loop.** A daemon relays only its LOCAL sessions up. Without
   *   this, the roster it just mirrored down would be relayed back up on the
   *   next change and the two hubs would beat each other forever.
   * - **No lying TTL.** Mirrored faces are exempt from the sweep below. Their
   *   origin is authoritative about them and re-mirrors the whole set whenever
   *   it changes — including when its own sweep expires somebody — so a
   *   second, local expiry could only ever remove a face that is still there.
   */
  origin: string | null;
  lastSeenMs: number;

  /** When `onThread` was taken up. Server-side only: it exists to date a
   * cancellation against, not to be rendered. */
  onThreadAt: string | null;
}

// Long enough for an agent to think between commands; ops auto-revive
// anyway, so this mostly bounds how long an idle cursor lingers.
export const SESSION_TTL_MS = 5 * 60_000;
const SWEEP_INTERVAL_MS = 10_000;

export class PresenceHub {
  private rooms = new Map<string, Map<string, SessionState>>();
  private listeners: Array<(canvasId: string) => void> = [];
  private sweeper: ReturnType<typeof setInterval>;

  constructor(private readonly ttlMs = SESSION_TTL_MS) {
    this.sweeper = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS);
    this.sweeper.unref?.();
  }

  close(): void {
    clearInterval(this.sweeper);
  }

  onChange(listener: (canvasId: string) => void): void {
    this.listeners.push(listener);
  }

  private emit(canvasId: string): void {
    for (const listener of this.listeners) listener(canvasId);
  }

  private room(canvasId: string): Map<string, SessionState> {
    let room = this.rooms.get(canvasId);
    if (!room) {
      room = new Map();
      this.rooms.set(canvasId, room);
    }
    return room;
  }

  createSession(
    canvasId: string,
    actor: Actor,
    kind: PresenceSession["kind"],
    options: { label?: string; sessionId?: string; harness?: string } = {},
  ): PresenceSession {
    const session = blankSession(actor, kind, options);
    this.room(canvasId).set(session.sessionId, session);
    this.emit(canvasId);
    return session;
  }

  /** Update + heartbeat. Returns false if the session is gone (expired). */
  touch(
    canvasId: string,
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
      onThread?: string | null;
    } = {},
  ): boolean {
    const session = this.rooms.get(canvasId)?.get(sessionId);
    if (!session) return false;
    patchSession(session, patch);
    this.emit(canvasId);
    return true;
  }

  endSession(canvasId: string, sessionId: string): void {
    const room = this.rooms.get(canvasId);
    if (room?.delete(sessionId)) this.emit(canvasId);
  }

  /**
   * Every session an actor holds, ended at once — on every canvas. The
   * client's session pointer is a cache; this is the truth. A pointer lost
   * to a crash or a migration must not leave a face blinking on a canvas
   * after its agent has left. `kind` narrows the sweep so a CLI leaving
   * cannot take down the same person's live browser tabs.
   */
  endActorSessions(actorId: string, kind?: PresenceSession["kind"]): number {
    let ended = 0;
    for (const [canvasId, room] of this.rooms) {
      let changed = false;
      for (const [sessionId, session] of room) {
        if (session.actor.id !== actorId) continue;
        if (kind && session.kind !== kind) continue;
        room.delete(sessionId);
        changed = true;
        ended += 1;
      }
      if (changed) this.emit(canvasId);
    }
    return ended;
  }

  /** Who this canvas sees: everyone actually on it — this daemon's own
   * clients and every face mirrored in from a connection. */
  roster(canvasId: string): PresenceSession[] {
    const here = [...(this.rooms.get(canvasId)?.values() ?? [])];
    // `via` is DERIVED here rather than passed through: the field means "as
    // this daemon sees it", and a value that travelled in from the sender
    // would be that daemon's answer wearing this one's voice.
    return here.map(({ lastSeenMs, onThreadAt, origin, ...session }) => ({
      ...session,
      via: origin,
    }));
  }

  /**
   * This daemon's OWN faces on a canvas — what a home connection relays up.
   *
   * The narrowing is the loop guard: relaying `roster()` would send the home
   * back the faces it just sent us, and every roster either end published
   * would provoke another.
   */
  localRoster(canvasId: string): PresenceSession[] {
    const here = [...(this.rooms.get(canvasId)?.values() ?? [])];
    return here
      .filter((session) => session.origin === null)
      .map(({ lastSeenMs, onThreadAt, origin, via, ...session }) => session);
  }

  /**
   * Take a roster somebody else is authoritative about and hold it here.
   *
   * Used in BOTH directions, which is why it is one method: the home stores a
   * replica's relayed faces under that socket, and the replica stores the
   * home's roster under its home connection. `sessions` REPLACES everything
   * previously mirrored under `origin` on this canvas — a full set rather than
   * a diff, because the sender already computes the full set and a diff
   * protocol is a second thing to get wrong.
   *
   * Sessions keep their ids verbatim. That is what lets the sender recognize
   * (and drop) its own faces when the merged roster comes back, and what makes
   * a face the same face on every screen it reaches.
   *
   * Presence is still never written down: this is daemon memory and WS fan-out
   * exactly as before, and nothing here reaches a store or an oplog.
   */
  mirror(canvasId: string, origin: string, sessions: readonly PresenceSession[]): void {
    const room = this.room(canvasId);
    const wanted = new Map(sessions.map((session) => [session.sessionId, session]));
    let changed = false;
    for (const [sessionId, session] of room) {
      if (session.origin !== origin) continue;
      if (wanted.has(sessionId)) continue;
      room.delete(sessionId);
      changed = true;
    }
    for (const [sessionId, session] of wanted) {
      const existing = room.get(sessionId);
      // A local session of ours must never be overwritten by a mirrored copy
      // of itself. The sender should have filtered it out; if it did not, the
      // local one is the truer of the two — it is where the beats arrive.
      if (existing && existing.origin === null) continue;
      const before = existing ? JSON.stringify(stripped(existing)) : null;
      // `via` is dropped rather than carried: it is the SENDER's answer to
      // "which side is this on", and holding it here would have this daemon
      // repeat somebody else's perspective as its own. `roster()` derives it
      // fresh from `origin` below.
      const { via: _theirs, ...incoming } = session;
      const next: SessionState = {
        ...incoming,
        origin,
        lastSeenMs: Date.now(),
        statusSource: null,
        onThreadAt: existing?.onThreadAt ?? null,
      };
      room.set(sessionId, next);
      if (before !== JSON.stringify(stripped(next))) changed = true;
    }
    if (room.size === 0) this.rooms.delete(canvasId);
    if (changed) this.emit(canvasId);
  }

  /** Every face mirrored in from this origin, gone — on every canvas. What a
   * dropped home connection (or a closed relaying socket) means: nobody on the
   * other side of it is visibly here any more. */
  dropMirror(origin: string): void {
    for (const [canvasId, room] of this.rooms) {
      let changed = false;
      for (const [sessionId, session] of room) {
        if (session.origin !== origin) continue;
        room.delete(sessionId);
        changed = true;
      }
      if (room.size === 0) this.rooms.delete(canvasId);
      if (changed) this.emit(canvasId);
    }
  }

  /** What this session says it is answering, and since when. */
  onThreadOf(canvasId: string, sessionId: string): { threadId: string; since: string | null } | null {
    const session = this.rooms.get(canvasId)?.get(sessionId);
    if (!session?.onThread) return null;
    return { threadId: session.onThread, since: session.onThreadAt };
  }

  /** Op piggyback: an op whose clientId matches a session moves that
   * session's cursor to the op's locus — presence traces the real work.
   * A CLI session that expired mid-task (ids are "ses_…") is auto-revived
   * from the op's own actor: working makes you visible again. */
  opApplied(
    canvasId: string,
    clientId: string | undefined,
    actor: Actor,
    op: Operation,
    canvas: CanvasContents,
  ): void {
    if (!clientId) return;
    let session = this.rooms.get(canvasId)?.get(clientId);
    if (!session && clientId.startsWith("ses_")) {
      this.createSession(canvasId, actor, "cli", { sessionId: clientId });
      session = this.rooms.get(canvasId)?.get(clientId);
    }
    if (!session) return;
    const locus = opLocus(op, canvas);
    // An applied op ends any "working" animation — working resolves into
    // done — and retires the narration that announced it. A posted comment is
    // the receipt for the whole work episode, so it clears even a status the
    // actor said out loud; other ops only sweep derived narration.
    const receipt = op.type === "thread.create" || op.type === "thread.reply";
    this.touch(canvasId, clientId, {
      activity: null,
      status: null,
      statusSource: receipt ? "lifecycle" : "inferred",
      // Only the receipt puts the thread down. Every other op is the WORK —
      // adding the item, moving the screens — and an agent doing the thing it
      // was asked for is still on the thread that asked.
      ...(receipt ? { onThread: null } : {}),
      ...(locus ? { cursor: locus } : {}),
    });
  }

  private sweep(): void {
    const cutoff = Date.now() - this.ttlMs;
    for (const [canvasId, room] of this.rooms) {
      let changed = false;
      for (const [sessionId, session] of room) {
        // Mirrored faces are somebody else's to expire — see `origin`.
        if (session.origin !== null) continue;
        if (session.lastSeenMs < cutoff) {
          room.delete(sessionId);
          changed = true;
        }
      }
      if (room.size === 0) this.rooms.delete(canvasId);
      if (changed) this.emit(canvasId);
    }
  }
}

/** A session as it goes over the wire — the private bookkeeping dropped, so
 * two of them can be compared for "did anything a client would see change". */
function stripped(session: SessionState): PresenceSession {
  const { lastSeenMs, onThreadAt, origin, via, ...rest } = session;
  // `lastSeen` moves on every beat and would make every mirror a change.
  return { ...rest, lastSeen: "" };
}

function blankSession(
  actor: Actor,
  kind: PresenceSession["kind"],
  options: { label?: string; sessionId?: string; harness?: string },
): SessionState {
  return {
    origin: null,
    sessionId: options.sessionId ?? newId("ses"),
    actor,
    kind,
    harness: options.harness ?? null,
    label: options.label ?? null,
    cursor: null,
    selection: [],
    status: null,
    activity: null,
    onThread: null,
    onThreadAt: null,
    lastSeen: new Date().toISOString(),
    lastSeenMs: Date.now(),
    statusSource: null,
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
    onThread?: string | null;
  },
): void {
  // Presence is client-asserted, but a half-formed actor would leave a face
  // with no name — take it only when it is one.
  if (patch.actor?.id && patch.actor.name) session.actor = patch.actor;
  if (patch.cursor !== undefined) session.cursor = patch.cursor;
  if (patch.selection !== undefined) session.selection = patch.selection;
  if (patch.status !== undefined) {
    // Words the actor said outrank narration the system derived; lifecycle
    // turns (parking, waking, a posted comment) outrank everything. The
    // "sticky" question — may inferred narration displace what stands? — is
    // answered from the stored SOURCE now rather than from a private
    // boolean, because the source rides the roster (protocol.ts) and a fact
    // a client renders must not have a second, foldier spelling here.
    const source = patch.statusSource ?? "explicit";
    const sticky = session.statusSource === "explicit" && session.status !== null;
    if (source !== "inferred" || !sticky) {
      session.status = patch.status;
      session.statusSource = patch.status === null ? null : source;
    }
  }
  if (patch.activity !== undefined) session.activity = patch.activity;
  if (patch.onThread !== undefined && patch.onThread !== session.onThread) {
    session.onThread = patch.onThread;
    // When it was picked up, so a cancellation can be told from history.
    session.onThreadAt = patch.onThread === null ? null : new Date().toISOString();
  }
  session.lastSeenMs = Date.now();
  session.lastSeen = new Date().toISOString();
}

/** Where on the canvas an op "happened", given post-apply state. */
export function opLocus(op: Operation, canvas: CanvasContents): { x: number; y: number } | null {
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
