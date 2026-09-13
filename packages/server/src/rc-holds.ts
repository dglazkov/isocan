import type { Actor, RcAsk, RcPolicy } from "@isocan/core";

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
 *
 * **Each hold says whose it is** (owner-only summons, 11 Sep 2026). An rc
 * announces its owner — its machine's person — and, per agent, the policy it
 * applies to a summons (`RcPolicy`). Nothing here enforces a policy; the rc
 * does, because only the rc starts a turn. What this registry does with them
 * is say them (`answering`, the web's and `isocan who`'s reading) and route
 * an ask to add an agent only to an rc its asker owns: adding an agent to a
 * machine is that machine's owner's gesture.
 */

/** Whether an asker is this owner — the caller supplies the comparison,
 * since only it holds the registry's joins. */
type IsOwner = (owner: Actor, askerId: string) => boolean;

/**
 * An announced policy map, read tolerantly and made honest: only for agents
 * the same hold names, and with the owner the hold's own — already checked
 * against the badge — rather than whatever each entry claims. A policy is a
 * statement in its owner's name, so its owner is never the sender's to pick
 * per agent.
 */
export function rcPoliciesOf(
  raw: unknown,
  actorIds: ReadonlySet<string>,
  owner: Actor,
): Record<string, RcPolicy> | undefined {
  if (raw === null || typeof raw !== "object") return undefined;
  const out: Record<string, RcPolicy> = {};
  for (const [actorId, entry] of Object.entries(raw as Record<string, unknown>)) {
    if (!actorIds.has(actorId)) continue;
    const listen = (entry as { listen?: unknown } | null)?.listen;
    out[actorId] = {
      owner,
      listen: Array.isArray(listen) ? listen.filter((v): v is string => typeof v === "string") : [],
    };
  }
  return out;
}

const ASK_TTL_MS = 15_000;

/** How long a canvas stays "changed" quiet after its last hold closes before
 * observers are told it went down — just enough to swallow the back-to-back
 * re-issue gap without flapping the relay, and small enough that a dead rc is
 * reported within the second. */
const HOLD_FLAP_MS = 250;

/** What an rc says about itself beside its agents. Both absent from an rc
 * older than owner-only summons. */
interface HoldPolicy {
  owner?: Actor | undefined;
  policies?: Readonly<Record<string, RcPolicy>> | undefined;
}

interface LocalHold extends HoldPolicy {
  actorIds: ReadonlySet<string>;
  /** Ends the wait early, delivering these asks to this hold's response. */
  deliver: (asks: RcAsk[]) => void;
}

interface Mirror {
  parked: boolean;
  actorIds: ReadonlySet<string>;
  /** The owners of the rcs parked behind that daemon, already checked
   * against the relaying badge's claims. */
  owners?: readonly Actor[] | undefined;
  policies?: Readonly<Record<string, RcPolicy>> | undefined;
  /** Sends an `rc-ask` down the socket that owns this mirror. Returns false
   * when the socket cannot carry it (closing, gone). */
  sendAsk: (ask: RcAsk) => boolean;
}

interface RcAnswering {
  parked: boolean;
  actorIds: string[];
  owners: Actor[];
  policies: Record<string, RcPolicy>;
}

export class RcHolds {
  private local = new Map<string, Set<LocalHold>>();
  /** Asks waiting out the gap between back-to-back holds. `ownerId` is the
   * owner of the rc the ask was routed to, so another person's rc re-issuing
   * first does not carry it off. */
  private queued = new Map<string, { ask: RcAsk; expires: number; ownerId?: string }[]>();
  /** Whose rc just closed its last hold on a canvas — who the gap belongs to. */
  private lastOwner = new Map<string, Actor | undefined>();
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
    /** Whose rc this is and what it applies (owner-only summons). */
    policy: HoldPolicy = {},
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
      ...(policy.owner ? { owner: policy.owner } : {}),
      ...(policy.policies ? { policies: policy.policies } : {}),
      deliver: (asks) => finish(asks),
    };
    const timer = setTimeout(() => finish(this.drain(canvasId, entry.owner)), waitMs);
    timer.unref?.();
    const finish = (asks: RcAsk[]): void => {
      if (!open) return;
      open = false;
      clearTimeout(timer);
      here.delete(entry);
      if (here.size === 0 && this.local.get(canvasId) === here) {
        this.local.delete(canvasId);
        this.lastOwner.set(canvasId, entry.owner);
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
    const waiting = this.drain(canvasId, entry.owner);
    if (waiting.length > 0) finish(waiting);
    return { done, release: () => finish([]) };
  }

  /** The queued asks this owner's hold may carry: those routed to it, and
   * those routed to nobody in particular (an rc too old to say whose). */
  private drain(canvasId: string, owner?: Actor): RcAsk[] {
    const rows = this.queued.get(canvasId);
    if (!rows) return [];
    const now = Date.now();
    const mine = rows.filter((row) => row.ownerId === undefined || row.ownerId === owner?.id);
    const rest = rows.filter((row) => !mine.includes(row) && row.expires > now);
    if (rest.length > 0) this.queued.set(canvasId, rest);
    else this.queued.delete(canvasId);
    return mine.filter((row) => row.expires > now).map((row) => row.ask);
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

  /**
   * **Every hold on this canvas ends, now** — operator phase 2, and the fourth
   * way a hold can end.
   *
   * Until this, a hold ended on its timeout, on the request closing, or on an
   * ask arriving (`finish`, above). All three are the rc's own business. A
   * takedown is the first thing that happens TO a canvas that has to reach
   * them: an rc parked for up to a minute on a canvas the home has stopped
   * serving would sit there answering nobody, then re-park and be refused at
   * the door — and in between, `answering()` would go on telling the canvas
   * that somebody is there to summon.
   *
   * Ended with no asks, which is exactly what a timeout delivers, so every rc
   * takes the path it already takes when a park expires: it goes round its
   * loop and meets the door, which refuses it with the sentence. Nothing new
   * had to be taught to the rc side, and that is the point of ending them this
   * way rather than inventing a refusal to push at them.
   *
   * The queued asks and the flap state go too: an ask waiting out the gap for
   * an rc that is never coming back is a message to a room that is closed.
   * Mirrors are NOT touched — they are what OTHER daemons relayed, and those
   * daemons are told by their own sockets closing.
   *
   * Returns how many it ended, for the count the verb prints.
   */
  endCanvas(canvasId: string): number {
    const holds = this.local.get(canvasId);
    this.queued.delete(canvasId);
    if (!holds) return 0;
    // A copy: `finish` mutates the set this is walking.
    const ending = [...holds];
    for (const hold of ending) hold.deliver([]);
    return ending.length;
  }

  /** Who answers for this canvas right now, across local holds and mirrors. */
  answering(canvasId: string): RcAnswering {
    const localOnly = this.answeringLocal(canvasId);
    const actorIds = new Set(localOnly.actorIds);
    const owners = new Map(localOnly.owners.map((o) => [o.id, o]));
    const policies = { ...localOnly.policies };
    let parked = localOnly.parked;
    for (const mine of this.mirrors.values()) {
      const row = mine.get(canvasId);
      if (!row) continue;
      if (row.parked) parked = true;
      for (const actorId of row.actorIds) actorIds.add(actorId);
      for (const owner of row.owners ?? []) owners.set(owner.id, owner);
      for (const [actorId, policy] of Object.entries(row.policies ?? {})) {
        // First word wins, as for the ask: one actor is one machine's claim,
        // so two policies for it would be the same rc said twice.
        if (row.actorIds.has(actorId) && !policies[actorId]) policies[actorId] = policy;
      }
    }
    return { parked, actorIds: [...actorIds], owners: [...owners.values()], policies };
  }

  /** Local holds only — what a daemon relays up. Mirrors stay out: a relay
   * of a mirror would launder someone else's assertion as this badge's. */
  answeringLocal(canvasId: string): RcAnswering {
    const holds = this.local.get(canvasId);
    const actorIds = new Set<string>();
    const owners = new Map<string, Actor>();
    const policies: Record<string, RcPolicy> = {};
    for (const hold of holds ?? []) {
      for (const actorId of hold.actorIds) {
        actorIds.add(actorId);
        const policy = hold.policies?.[actorId];
        if (policy && !policies[actorId]) policies[actorId] = policy;
      }
      if (hold.owner) owners.set(hold.owner.id, hold.owner);
    }
    return { parked: (holds?.size ?? 0) > 0, actorIds: [...actorIds], owners: [...owners.values()], policies };
  }

  /**
   * Route an ask toward whoever is parked — and, since owner-only summons,
   * toward an rc the asker OWNS: adding an agent to a machine is that
   * machine's owner's gesture. An open local hold of theirs gets it now; a
   * canvas between back-to-back holds of theirs queues it briefly; otherwise
   * it goes down the first mirror whose owners include them. An rc too old to
   * say whose it is takes anyone's ask, as every rc did before.
   *
   * False means nobody the asker may ask is there — the caller says which
   * refusal: no rc at all (409), or only other people's (`answering().owners`).
   */
  ask(canvasId: string, ask: RcAsk, isOwner?: IsOwner): boolean {
    const theirs = (owner: Actor | undefined) => !isOwner || !owner || isOwner(owner, ask.from.id);
    const holds = [...(this.local.get(canvasId) ?? [])];
    const hold = holds.find((h) => theirs(h.owner));
    if (hold) {
      hold.deliver([...this.drain(canvasId, hold.owner), ask]);
      return true;
    }
    if (holds.length === 0 && this.sinking.has(canvasId)) {
      // Between back-to-back holds: the next re-issue drains this — if the
      // rc that just closed one is the asker's.
      const owner = this.lastOwner.get(canvasId);
      if (theirs(owner)) {
        this.enqueue(canvasId, ask, owner?.id);
        return true;
      }
    }
    for (const mine of this.mirrors.values()) {
      const row = mine.get(canvasId);
      if (!row?.parked) continue;
      const owners = row.owners ?? [];
      if (owners.length > 0 && !owners.some((o) => theirs(o))) continue;
      if (row.sendAsk(ask)) return true;
    }
    return false;
  }

  private enqueue(canvasId: string, ask: RcAsk, ownerId?: string): void {
    const rows = this.queued.get(canvasId) ?? [];
    rows.push({ ask, expires: Date.now() + ASK_TTL_MS, ...(ownerId ? { ownerId } : {}) });
    this.queued.set(canvasId, rows);
  }
}
