import type { Actor, RcAsk, RcPolicy } from "../../core/src/index.js";
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
export declare function rcPoliciesOf(raw: unknown, actorIds: ReadonlySet<string>, owner: Actor): Record<string, RcPolicy> | undefined;
/** What an rc says about itself beside its agents. Both absent from an rc
 * older than owner-only summons. */
interface HoldPolicy {
    owner?: Actor | undefined;
    policies?: Readonly<Record<string, RcPolicy>> | undefined;
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
export declare class RcHolds {
    private local;
    /** Asks waiting out the gap between back-to-back holds. `ownerId` is the
     * owner of the rc the ask was routed to, so another person's rc re-issuing
     * first does not carry it off. */
    private queued;
    /** Whose rc just closed its last hold on a canvas — who the gap belongs to. */
    private lastOwner;
    /** originKey → canvasId → what that connection last relayed. The key is
     * whatever the socket layer uses to identify one connection — the same
     * value it hands `PresenceHub.mirror`. */
    private mirrors;
    private listeners;
    /** Canvases whose "went down" notification is pending the flap window. */
    private sinking;
    /** Observe local-hold changes (a canvas's parked state or actor set). The
     * daemon's home-links subscribe to schedule an `rc-relay`. */
    onChange(listener: (canvasId: string) => void): void;
    private changed;
    /**
     * Register a hold and wait it out. Resolves with the asks that arrived —
     * empty on an ordinary timeout, and always empty once `release` has run
     * (a closed socket must not eat an ask; an undelivered one stays queued
     * for the next hold).
     */
    hold(canvasId: string, actorIds: ReadonlySet<string>, waitMs: number, 
    /** Whose rc this is and what it applies (owner-only summons). */
    policy?: HoldPolicy): {
        done: Promise<RcAsk[]>;
        release: () => void;
    };
    /** The queued asks this owner's hold may carry: those routed to it, and
     * those routed to nobody in particular (an rc too old to say whose). */
    private drain;
    /** What the socket layer relayed for one connection. A full replacement per
     * canvas, like `presence-relay`: the sender holds the whole truth. */
    mirror(originKey: unknown, canvasId: string, row: Mirror): void;
    /** The connection died — everything it relayed dies with it. */
    dropMirror(originKey: unknown): void;
    /** Who answers for this canvas right now, across local holds and mirrors. */
    answering(canvasId: string): RcAnswering;
    /** Local holds only — what a daemon relays up. Mirrors stay out: a relay
     * of a mirror would launder someone else's assertion as this badge's. */
    answeringLocal(canvasId: string): RcAnswering;
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
    ask(canvasId: string, ask: RcAsk, isOwner?: IsOwner): boolean;
    private enqueue;
}
export {};
