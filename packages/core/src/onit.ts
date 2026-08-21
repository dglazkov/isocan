import type { PresenceSession } from "./protocol.ts";

/**
 * Who has picked up a thread, and what they say they are doing.
 *
 * Asking for work and hearing nothing is the worst moment in this app: you
 * post, and the canvas looks exactly as it did — no way to tell whether an
 * agent woke, whether it understood, or whether anybody was even listening.
 * The information exists (an agent's presence carries a status, and the wake
 * lands it on the summoning thread), it just never reached the thread itself.
 *
 * This is the read that puts it there, in core because both surfaces answer
 * the same question: the web app draws it under the last comment, and
 * `isocan who` should not disagree about who is on what.
 */

export interface Worker {
  sessionId: string;
  actorId: string;
  /** Their presence label if they have one, else their name. */
  name: string;
  /** What they said they are doing, if anything. */
  status: string | null;
  kind: PresenceSession["kind"];
  lastSeen: string;
}

/** Sessions that have claimed this thread, in the order they arrived. */
export function workersOn(sessions: PresenceSession[], threadId: string): Worker[] {
  return sessions
    .filter(
      (session) =>
        session.activity !== null &&
        "threadId" in session.activity &&
        session.activity.threadId === threadId,
    )
    .map((session) => ({
      sessionId: session.sessionId,
      actorId: session.actor.id,
      name: session.label ?? session.actor.name,
      status: session.status,
      kind: session.kind,
      lastSeen: session.lastSeen,
    }));
}

/**
 * Who could pick something up here: agents parked on `wait`, which is what
 * "on call" means. Used to answer the other half of the question — when
 * nobody has taken a thread yet, is anybody even there?
 *
 * A web session is a person watching, not somebody who will act on a comment
 * while you look away, so it does not count.
 */
export function listeners(sessions: PresenceSession[]): PresenceSession[] {
  return sessions.filter((session) => session.kind === "cli");
}
