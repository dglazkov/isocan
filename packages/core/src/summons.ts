import type { ActorJoins } from "./identity.ts";
import type { Comment, CommentThread } from "./model.ts";
import type { PresenceSession, RcPolicy } from "./protocol.ts";
import { mayWake, policyWords, refusedMentions } from "./inbox.ts";
import { summonedBy } from "./onit.ts";

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
export const ANSWER_WITHIN_MS = 45_000;

/** What a viewer can say about one summons, right now. */
export type SummonsState =
  /** Sent, and nothing has come back yet. Still inside the bound. */
  | { state: "asked"; waitedMs: number }
  /** The agent started a turn on this thread — presence said so. */
  | { state: "picked-up"; afterMs: number }
  /** It replied. Terminal, and it does not matter whether we ever saw
   *  presence: a machine that answers has answered. */
  | { state: "answered"; afterMs: number }
  /**
   * Past the bound with nothing. `rcParked` is what makes this useful rather
   * than merely disappointing: an rc holding a connection and not responding
   * is a broken agent, where no rc at all is nobody home. The two want
   * different sentences and different next moves.
   */
  | { state: "unanswered"; waitedMs: number; rcParked: boolean }
  /**
   * The rc that answers for this agent does not take this asker's word
   * (owner-only summons, 11 Sep 2026). Known the moment the ask is made, not
   * after the bound, and never counted as *nothing answered*: nothing was
   * asked of the agent at all — the gate turned the ask away, and the
   * sentence names the one person who can change that.
   */
  | { state: "refused"; policy: RcPolicy };

/**
 * Where one summons stands.
 *
 * `askedAt` and `now` are passed rather than read, so this is pure and so a
 * test can stand anywhere on the timeline without waiting.
 */
export function summonsState(
  summons: {
    actorId: string;
    threadId: string;
    askedAt: number;
    /** Who asked — needed to read the policy. Absent: the old reading. */
    askerId?: string;
  },
  seen: {
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
  },
  now: number,
): SummonsState {
  const waitedMs = Math.max(0, now - summons.askedAt);

  // Turned away at the gate outranks the clock: there is nothing to wait
  // for, and "asked" would be a promise the rc already declined.
  if (
    seen.policy &&
    summons.askerId !== undefined &&
    !mayWake(seen.policy, summons.askerId, seen.joined)
  ) {
    return { state: "refused", policy: seen.policy };
  }

  // A reply outranks everything: it is the outcome the other states are
  // predicting, and an agent fast enough to answer before its presence
  // reaches this tab must not read as "nothing answered".
  const reply = seen.thread?.comments.find(
    (c: Comment) => c.author.id === summons.actorId && Date.parse(c.createdAt) >= summons.askedAt,
  );
  if (reply) return { state: "answered", afterMs: Math.max(0, Date.parse(reply.createdAt) - summons.askedAt) };

  if (seen.pickedUpAt !== undefined) {
    return { state: "picked-up", afterMs: Math.max(0, seen.pickedUpAt - summons.askedAt) };
  }

  // `onThread`, NOT `activity`. The protocol comment on that field exists to
  // stop exactly the mistake this line first made: `activity` says where a
  // session is STANDING and moves on every applied op, so reading it made an
  // agent vanish from the thread the instant it started working — "which is
  // exactly when you most want to see it". `workersOn` in `onit.ts` has always
  // read the right one.
  const working = seen.sessions.some(
    (s) => s.actor.id === summons.actorId && s.onThread === summons.threadId,
  );
  if (working) return { state: "picked-up", afterMs: waitedMs };

  if (waitedMs >= ANSWER_WITHIN_MS) {
    return { state: "unanswered", waitedMs, rcParked: seen.rcParked };
  }
  return { state: "asked", waitedMs };
}

/**
 * **Every summons the asker has open on this thread, and where each stands**
 * — the receipts the thread shows under the ask (#197 phase 1, web half).
 *
 * The ask is the asker's latest comment, and it stays open for as long as
 * everything said after it is an answer from somebody it named: once anybody
 * else speaks, or the asker speaks again, it is a conversation that moved
 * on, and a receipt under it would be about a question nobody is looking at.
 * Only enrolled agents are summoned — a person named in a comment is being
 * talked to, not asked to wake, and "nothing answered" about them would be a
 * lie.
 *
 * An agent parked on `wait` that this ask woke is left out while the ask is
 * the last word: `wokenLine` speaks for it, and a receipt reading "nothing is
 * listening" about an agent the daemon just reached would contradict it. A
 * refusal is read once, by `refusedMentions`, so the clause a lapsed grant
 * adds travels with it.
 */
export function threadSummonses(
  thread: CommentThread,
  askerId: string,
  seen: {
    agents: Readonly<Record<string, unknown>> | undefined;
    sessions: readonly PresenceSession[];
    /** Who an rc holds a connection for (`rcAnswering`'s `actorIds`). */
    answering: ReadonlySet<string>;
    policies?: Readonly<Record<string, RcPolicy>> | undefined;
    joined?: ActorJoins | undefined;
  },
  now: number,
): { actorId: string; state: SummonsState; lapsed?: string | undefined }[] {
  const comments = thread.comments;
  let i = comments.length - 1;
  while (i >= 0 && comments[i]!.author.id !== askerId) i--;
  const ask = comments[i];
  const named = [...new Set(ask?.mentions)].filter((id) => seen.agents?.[id]);
  if (!ask || !comments.slice(i + 1).every((c) => named.includes(c.author.id))) return [];
  const pending = i === comments.length - 1;
  const woken = pending ? summonedBy([...seen.sessions], thread).map((s) => s.actor.id) : [];
  const refused = pending ? refusedMentions(named, askerId, seen.policies, seen.joined, now) : [];
  const askedAt = Date.parse(ask.createdAt);
  return named
    .filter((id) => !woken.includes(id))
    .map((actorId) => {
      const turnedAway = refused.find((r) => r.actorId === actorId);
      if (turnedAway) {
        return { actorId, state: { state: "refused", policy: turnedAway.policy } as const, lapsed: turnedAway.lapsed };
      }
      const state = summonsState(
        { actorId, threadId: thread.id, askedAt },
        { sessions: seen.sessions, thread, rcParked: seen.answering.has(actorId) },
        now,
      );
      return { actorId, state };
    });
}

/**
 * The sentence a receipt shows.
 *
 * Here rather than in the web app because the words ARE the feature — *"that
 * last sentence is the whole feature: it converts a mystery into a fact"* —
 * and a CLI that grows `isocan comment --wait` must say the same thing. The
 * copy persona's rule applies: name what happened, and when it is bad, say
 * which bad thing.
 */
export function summonsLine(
  name: string,
  state: SummonsState,
  /** For a refusal: resolves the owner's and the gate's names. */
  nameOf: (actorId: string) => string | undefined = () => undefined,
): string {
  const secs = (ms: number) => `${Math.max(1, Math.round(ms / 1000))}s`;
  switch (state.state) {
    case "refused": {
      // Never "nothing answered": nothing was asked of the agent. The gate
      // turned the ask away, and the owner is the one person who can change
      // that — so the sentence ends with them.
      const owner = nameOf(state.policy.owner.id) ?? state.policy.owner.name;
      return `${name} ${policyWords(state.policy, nameOf) ?? "listens to everyone"} — this did not wake ${name}. Ask ${owner} to widen it.`;
    }
    case "asked":
      return `asked ${name}`;
    case "picked-up":
      return `${name} picked it up (${secs(state.afterMs)})`;
    case "answered":
      return `${name} answered (${secs(state.afterMs)})`;
    case "unanswered":
      // The distinction the whole phase exists for. A parked rc that did not
      // respond is a broken agent and names the rc, because that is where a
      // person would look. No rc is nobody home, and the fix is different.
      return state.rcParked
        ? `nothing answered — the rc is parked but did not respond`
        : `nothing answered — nothing is listening for ${name} here`;
  }
}

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
export function wokenLine(names: readonly string[], waitedMs: number): string {
  const who = names.join(", ");
  const they = names.length === 1 ? "them" : "one of them";
  if (waitedMs < ANSWER_WITHIN_MS) {
    return `${who} ${names.length === 1 ? "was" : "were"} woken — waiting for ${they} to pick this up.`;
  }
  const secs = Math.round(waitedMs / 1000);
  return names.length === 1
    ? `${who} was woken ${secs}s ago and has not picked this up.`
    : `${who} were woken ${secs}s ago and none has picked this up.`;
}

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
export function waitingLine(parked: number): string {
  if (parked === 0) return "Nobody is parked — this waits on the thread for the next agent.";
  return parked === 1 ? "Sent. One agent is listening." : `Sent. ${parked} agents are listening.`;
}
