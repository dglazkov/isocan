import type { ActorJoins } from "./identity.js";
import type { CommentThread } from "./model.js";
import type { PresenceSession, RcPolicy } from "./protocol.js";
/**
 * **Did the thing you asked for actually reach anybody.**
 *
 * Phase 1 of `docs/research/2026-09-06-agents-you-can-trust.md` (#197), and
 * the answer to the question that started it: *"it seems hard to know if an
 * agent is actually around and able to wake and answer."*
 *
 * Before this, naming an agent in a comment produced either a reply or
 * silence, and **silence was indistinguishable from thinking**. You could not
 * tell a model composing a careful answer from an rc that was wedged, out of
 * budget, or pointed at a model that was down. The roster's dot said
 * "standing by", which is a claim about a held socket rather than about
 * anybody answering — and on 6 September this project found an rc that
 * printed "answering on X", looked healthy, and silently never answered for
 * an agent at all (`main.ts`, the roster reconcile).
 *
 * So: every summons gets a receipt, and the receipt can say no.
 *
 * ## It is an observation, not a fact the canvas holds
 *
 * Deliberately no operation and no stored field. A receipt is what the person
 * who asked can see about what they asked — it is true of a viewer, not of
 * the canvas, and two people watching the same thread are waiting on
 * different things. Writing one per summons would also add an op to a
 * vocabulary held at 33, to record something nobody needs tomorrow.
 *
 * Everything here is therefore derived from what the tab already holds: the
 * comment, the roster, live presence, and the clock.
 */
/** How long a summons may go unacknowledged before the receipt says so.
 *
 * An rc does not poll for work — it holds a long-poll open — so an agent that
 * is going to pick something up starts within seconds of the op landing. The
 * doc's own example is *picked up (4s)*.
 *
 * Forty-five seconds is therefore generous rather than tight, and the
 * generosity is the point: this number decides when the app is willing to say
 * **nothing answered**, and saying that wrongly about an agent which was about
 * to reply is worse than a few more seconds of "asked". */
export declare const ANSWER_WITHIN_MS = 45000;
/** What a viewer can say about one summons, right now. */
export type SummonsState = 
/** Sent, and nothing has come back yet. Still inside the bound. */
{
    state: "asked";
    waitedMs: number;
}
/** The agent started a turn on this thread — presence said so. */
 | {
    state: "picked-up";
    afterMs: number;
}
/** It replied. Terminal, and it does not matter whether we ever saw
 *  presence: a machine that answers has answered. */
 | {
    state: "answered";
    afterMs: number;
}
/**
 * Past the bound with nothing. `rcParked` is what makes this useful rather
 * than merely disappointing: an rc holding a connection and not responding
 * is a broken agent, where no rc at all is nobody home. The two want
 * different sentences and different next moves.
 */
 | {
    state: "unanswered";
    waitedMs: number;
    rcParked: boolean;
}
/**
 * The rc that answers for this agent does not take this asker's word
 * (owner-only summons, 11 Sep 2026). Known the moment the ask is made, not
 * after the bound, and never counted as *nothing answered*: nothing was
 * asked of the agent at all — the gate turned the ask away, and the
 * sentence names the one person who can change that.
 */
 | {
    state: "refused";
    policy: RcPolicy;
};
/**
 * Where one summons stands.
 *
 * `askedAt` and `now` are passed rather than read, so this is pure and so a
 * test can stand anywhere on the timeline without waiting.
 */
export declare function summonsState(summons: {
    actorId: string;
    threadId: string;
    askedAt: number;
    /** Who asked — needed to read the policy. Absent: the old reading. */
    askerId?: string;
}, seen: {
    /** What the answering rc announced for this agent, if anything did. */
    policy?: RcPolicy | undefined;
    /** Live sessions, as the facepile has them. */
    sessions: readonly PresenceSession[];
    /** The thread as it stands, for a reply that beat presence. */
    thread?: CommentThread | undefined;
    /** Whether an rc holds a connection claiming this actor. */
    rcParked: boolean;
    /** When presence first showed this agent working on this thread, if the
     *  caller has been watching. Without it, a turn that has already ended is
     *  indistinguishable from one that never began — which is why the caller
     *  keeps this and not us. */
    pickedUpAt?: number | undefined;
    joined?: ActorJoins | undefined;
}, now: number): SummonsState;
/**
 * The sentence a receipt shows.
 *
 * Here rather than in the web app because the words ARE the feature — *"that
 * last sentence is the whole feature: it converts a mystery into a fact"* —
 * and a CLI that grows `isocan comment --wait` must say the same thing. The
 * copy persona's rule applies: name what happened, and when it is bad, say
 * which bad thing.
 */
export declare function summonsLine(name: string, state: SummonsState, 
/** For a refusal: resolves the owner's and the gate's names. */
nameOf?: (actorId: string) => string | undefined): string;
/**
 * **What to say when an agent was woken and has said nothing.**
 *
 * This is the rung that needed a clock. `OnIt` already told you an agent had
 * been woken — *"Fable was woken — waiting for them to pick this up"* — and
 * went on saying it however long the silence ran. That sentence is a promise
 * with no deadline, and it is the exact thing #197 opens by naming: silence
 * you cannot tell apart from thinking.
 *
 * Past `ANSWER_WITHIN_MS` it stops promising. The wording says *woken* rather
 * than *parked*, because that is the stronger and more damning fact: this is
 * not an agent that might have missed it, it is one the daemon reached.
 */
export declare function wokenLine(names: readonly string[], waitedMs: number): string;
/**
 * **What to say when nothing was woken at all.**
 *
 * Deliberately WITHOUT a clock, and the first cut got this wrong. Reaching
 * here means the last word is yours and the daemon woke nobody for it — so
 * "nothing answered" would be blaming an agent for not replying to something
 * nobody asked it. That is the same lie in the other direction: the word
 * *asked* has to be exact, and so does *answered*.
 *
 * Found by looking at the thing rather than by reading it: the bound was on
 * this branch first, and a parked `wait` on a real canvas showed the states
 * belong the other way round.
 */
export declare function waitingLine(parked: number): string;
