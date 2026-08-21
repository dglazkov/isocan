import { parseSlashCommand } from "./commands.ts";
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
    .filter((session) => session.onThread === threadId)
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

/**
 * Who the last thing said here reached.
 *
 * The rung between "sent" and "somebody has it": an agent that has been woken
 * but has not said anything yet. Naming it is the difference between "did that
 * go anywhere?" and "Fable has it, give it a second" — and it needs nothing
 * from the agent, which matters, because an agent parked on an older build
 * will never claim a thread and should still not read as silence.
 *
 * A comment in the MAIN thread wakes every parked agent; anywhere else it
 * wakes the ones it @-mentions. Both are the daemon's own rules, restated
 * here so a client can say who is coming before anybody arrives.
 */
export function summonedBy(
  sessions: PresenceSession[],
  thread: { main?: boolean; comments: { author: { id: string }; mentions?: string[] }[] },
): PresenceSession[] {
  const last = thread.comments[thread.comments.length - 1];
  if (!last) return [];
  const agents = listeners(sessions).filter((session) => session.actor.id !== last.author.id);
  if (thread.main) return agents;
  const addressed = new Set(last.mentions ?? []);
  return agents.filter((session) => addressed.has(session.actor.id));
}


/**
 * Calling something off.
 *
 * Two different acts wear the word "cancel". Before anybody picks it up, the
 * fix is to RETRACT: posting a comment is undoable (`thread.reply` inverts to
 * `comment.remove`), so the request simply stops existing. Once an agent has
 * it, the request is already being acted on and cannot be unsaid — the only
 * honest move is to ask them to stop, which is a message like any other.
 *
 * So a cancellation is a comment reading `/cancel`, and that is not a
 * workaround: it lands in the history where "why did this stop halfway" gets
 * answered later, it reaches every surface, and it needs no new op.
 */
export const CANCEL_COMMAND = "cancel";

/** The most recent cancellation in this thread, if any. */
export function latestCancel(thread: {
  comments: { id: string; body: string; author: { id: string; name: string }; createdAt: string }[];
}): { id: string; author: { id: string; name: string }; createdAt: string } | null {
  for (let i = thread.comments.length - 1; i >= 0; i--) {
    const comment = thread.comments[i]!;
    const parsed = parseSlashCommand(comment.body);
    if (parsed?.name === CANCEL_COMMAND) return comment;
  }
  return null;
}

/**
 * Was this thread called off AFTER somebody picked it up? The comparison is
 * the whole point: a cancellation from last week is history, and one from a
 * minute ago is an instruction to stop what you are doing right now.
 */
export function cancelledSince(
  thread: Parameters<typeof latestCancel>[0],
  sinceISO: string | null,
): ReturnType<typeof latestCancel> {
  const cancel = latestCancel(thread);
  if (!cancel) return null;
  if (sinceISO && cancel.createdAt <= sinceISO) return null;
  return cancel;
}
