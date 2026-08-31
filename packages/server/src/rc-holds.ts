import type { RcAsk } from "@isocan/core";

/**
 * **Connection-bound rc liveness, and the asks that ride it** (agent-custody
 * mechanisms 1 and 2; grew out of the inline map on-demand phase 6 kept in
 * `http.ts`).
 *
 * Two facts live here, one per hop:
 *
 * - **Local holds** — an `isocan rc` holding this daemon's `/api/rc/hold`
 *   open. The connection IS the fact: its agents are answerable exactly
 *   while a hold is open, and a dead rc's socket closes instantly — no
 *   window, no TTL lie, per journey 7. The microsecond gap between
 *   back-to-back holds can only err toward "not answerable", the permitted
 *   direction.
 * - **Mirrors** — what a member machine's daemon relayed up its home-link
 *   socket (`rc-relay`). A mirror lives exactly as long as the socket that
 *   asserted it; `ws.ts` drops it in the same close handler that drops the
 *   relayed faces, so home-side answerability dies the instant the laptop
 *   does.
 *
 * An **ask** ("add an agent", from the Web UI) travels the other way: it is
 * handed to an open local hold, or sent down a mirror's socket to become a
 * local ask at the far end. A hold that is momentarily between re-issues is
 * covered by a short queue — the gap is microseconds, the queue's TTL is
 * seconds, and an ask that outlives it dies quietly HERE because the dialog
 * that sent it is already counting down to saying so out loud.
 */

const ASK_TTL_MS = 15_000;

/** How long a canvas stays "changed" quiet after its last hold closes before
 * observers are told it went down — just enough to swallow the back-to-back
 * re-issue gap without flapping the relay, and small enough that a dead rc is
 * reported within the second. */
const HOLD_FLAP_MS = 250;

interface LocalHold {
  actorIds: ReadonlySet<string>;
  /** Ends the wait early, delivering these asks to this hold's response. */
  deliver: (asks: RcAsk[]) => void;
}

interface Mirror {
  parked: boolean;
  actorIds: ReadonlySet<string>;
  /** Sends an `rc-ask` down the socket that owns this mirror. Returns false
   * when the socket cannot carry it (closing, gone). */
  sendAsk: (ask: RcAsk) => boolean;
}

export interface RcAnswering {
  parked: boolean;
  actorIds: string[];
}

export class RcHolds {
  private local = new Map<string, Set<LocalHold>>();
  private queued = new Map<string, { ask: RcAsk; expires: number }[]>();
  /** originKey → canvasId → what that connection last relayed. The key is
   * whatever the socket layer uses to identify one connection — the same
   * value it hands `PresenceHub.mirror`. */
  private mirrors = new Map<unknown, Map<string, Mirror>>();
  private listeners = new Set<(canvasId: string) => void>();
  /** Canvases whose "went down" notification is pending the flap window. */
  private sinking = new Map<string, ReturnType<typeof setTimeout>>();

  /** Observe local-hold changes (a canvas's parked state or actor set). The
   * daemon's home-links subscribe to schedule an `rc-relay`. */
  onChange(listener: (canvasId: string) => void): void {
    this.listeners.add(listener);
  }

  private changed(canvasId: string): void {
    const down = this.sinking.get(canvasId);
    if (down) {
      clearTimeout(down);
      this.sinking.delete(canvasId);
    }
    for (const listener of this.listeners) listener(canvasId);
  }

  /**
   * Register a hold and wait it out. Resolves with the asks that arrived —
   * empty on an ordinary timeout, and always empty once `release` has run
   * (a closed socket must not eat an ask; an undelivered one stays queued
   * for the next hold).
   */
  hold(
    canvasId: string,
    actorIds: ReadonlySet<string>,
    waitMs: number,
  ): { done: Promise<RcAsk[]>; release: () => void } {
    let holds = this.local.get(canvasId);
    if (!holds) this.local.set(canvasId, (holds = new Set()));
    const here = holds;
    let settle!: (asks: RcAsk[]) => void;
    const done = new Promise<RcAsk[]>((resolve) => {
      settle = resolve;
    });
    let open = true;
    const entry: LocalHold = {
      actorIds,
      deliver: (asks) => finish(asks),
    };
    const timer = setTimeout(() => finish(this.drain(canvasId)), waitMs);
    timer.unref?.();
    const finish = (asks: RcAsk[]): void => {
      if (!open) return;
      open = false;
      clearTimeout(timer);
      here.delete(entry);
      if (here.size === 0 && this.local.get(canvasId) === here) {
        this.local.delete(canvasId);
        // Quiet for the flap window, then say it went down — unless a
        // re-issued hold lands first, which is the whole point.
        const down = setTimeout(() => {
          this.sinking.delete(canvasId);
          for (const listener of this.listeners) listener(canvasId);
        }, HOLD_FLAP_MS);
        down.unref?.();
        this.sinking.set(canvasId, down);
      }
      settle(asks);
    };
    here.add(entry);
    this.changed(canvasId);
    // Anything that arrived between holds is this hold's to carry.
    const waiting = this.drain(canvasId);
    if (waiting.length > 0) finish(waiting);
    return { done, release: () => finish([]) };
  }

  private drain(canvasId: string): RcAsk[] {
    const rows = this.queued.get(canvasId);
    if (!rows) return [];
    this.queued.delete(canvasId);
    const now = Date.now();
    return rows.filter((row) => row.expires > now).map((row) => row.ask);
  }

  /** What the socket layer relayed for one connection. A full replacement per
   * canvas, like `presence-relay`: the sender holds the whole truth. */
  mirror(originKey: unknown, canvasId: string, row: Mirror): void {
    let mine = this.mirrors.get(originKey);
    if (!mine) this.mirrors.set(originKey, (mine = new Map()));
    if (row.parked || row.actorIds.size > 0) mine.set(canvasId, row);
    else mine.delete(canvasId);
  }

  /** The connection died — everything it relayed dies with it. */
  dropMirror(originKey: unknown): void {
    this.mirrors.delete(originKey);
  }

  /** Who answers for this canvas right now, across local holds and mirrors. */
  answering(canvasId: string): RcAnswering {
    const localOnly = this.answeringLocal(canvasId);
    const actorIds = new Set(localOnly.actorIds);
    let parked = localOnly.parked;
    for (const mine of this.mirrors.values()) {
      const row = mine.get(canvasId);
      if (!row) continue;
      if (row.parked) parked = true;
      for (const actorId of row.actorIds) actorIds.add(actorId);
    }
    return { parked, actorIds: [...actorIds] };
  }

  /** Local holds only — what a daemon relays up. Mirrors stay out: a relay
   * of a mirror would launder someone else's assertion as this badge's. */
  answeringLocal(canvasId: string): RcAnswering {
    const holds = this.local.get(canvasId);
    const actorIds = new Set<string>();
    for (const hold of holds ?? []) for (const actorId of hold.actorIds) actorIds.add(actorId);
    return { parked: (holds?.size ?? 0) > 0, actorIds: [...actorIds] };
  }

  /**
   * Route an ask toward whoever is parked. An open local hold gets it now; a
   * parked-but-between-holds canvas queues it briefly; otherwise it goes down
   * the first mirror that says an rc is parked behind it. False means nobody
   * is there to ask — the caller's 409.
   */
  ask(canvasId: string, ask: RcAsk): boolean {
    const holds = this.local.get(canvasId);
    const first = holds?.values().next().value;
    if (first) {
      first.deliver([...this.drain(canvasId), ask]);
      return true;
    }
    if (this.sinking.has(canvasId)) {
      // Between back-to-back holds: the next re-issue drains this.
      this.enqueue(canvasId, ask);
      return true;
    }
    for (const mine of this.mirrors.values()) {
      const row = mine.get(canvasId);
      if (row?.parked && row.sendAsk(ask)) return true;
    }
    return false;
  }

  private enqueue(canvasId: string, ask: RcAsk): void {
    const rows = this.queued.get(canvasId) ?? [];
    rows.push({ ask, expires: Date.now() + ASK_TTL_MS });
    this.queued.set(canvasId, rows);
  }
}
