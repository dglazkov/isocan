import type { CanvasContents, Comment } from "./model.ts";
import { mainThread } from "./model.ts";
import type { NewComment, Operation } from "./ops.ts";
import { newCommentId, newThreadId } from "./ids.ts";

/**
 * **The roll call: an agent saying in the Chat that it arrived, came back,
 * or stepped away** (asked for on 24 Sep 2026: "when my pet joins, can he
 * announce himself in the chat so I know?").
 *
 * Until this, the only sign that a standing agent had taken up a canvas was
 * the tray's `answerable` and a line in the rc's terminal — on a machine the
 * canvas's person may never look at, which for an agent running in the cloud
 * is every machine they own. The Chat is where the person is already looking.
 *
 * **Who writes it: the rc room, in the agent's own name, once it has held.**
 * Not the daemon and not the home. A home sees the same hold twice — once as
 * a local hold and once as a member daemon's relayed mirror — and a daemon
 * restart forgets what it saw, so either would post twice or post again. The
 * room is one writer per canvas and agent, it is the only party that knows
 * the policy it applies (which is half the message), and its badge already
 * speaks as the agent. It speaks only after a hold has come back, so "is
 * here" is never said of an agent that never became answerable.
 *
 * **It is a record, whose value says which** (`record: "here"`, not a new
 * op and not a new field): a record summons nobody by `reasonFor` and wakes
 * nobody by an ops rule (`dispatchReason`), so two agents arriving together
 * cannot answer each other's hellos — not even one parked with `--all-ops`.
 *
 * **The away rule** (`rollDue`) is what keeps a flapping connection quiet.
 */
export type RollKind = "here" | "back" | "away";

/**
 * **How long an agent must be gone before its return is news: five
 * minutes.** Short enough that a restart for an upgrade that took a coffee is
 * said, long enough that a daemon reconnect, a dropped long poll or a network
 * blip every few seconds never is. The rc re-issues its hold every ten
 * seconds and remembers when it last held at most a minute stale, so the
 * window has room for both.
 */
export const ROLL_AWAY_MS = 5 * 60_000;

/**
 * **Whether an arrival is said, and as what** — the away rule, pure.
 *
 * - Never said on this canvas (no roll line by this agent in its Chat) and
 *   not seen here within the window: `here`.
 * - Its last line is `away` — it said it stepped away: `back`, whatever the
 *   gap, so the Chat never ends on an agent that has left when it has not.
 * - Otherwise the gap since the last evidence it was here — when it last
 *   held (`seen`, kept by the host) or its last line, whichever is later —
 *   longer than `ROLL_AWAY_MS`: `back`.
 * - Otherwise nothing. That is the quick reconnect, the restarted daemon and
 *   the room re-opened within the window.
 */
export function rollDue(facts: {
  /** The agent's latest roll line in this canvas's Chat, if any. */
  last: { kind: RollKind; at: number } | null;
  /** When the agent was last held here (ms), from the host's memory. */
  seen: number | undefined;
  /** When the hold that is now being reported began (ms). */
  now: number;
}): RollKind | null {
  const { last, seen, now } = facts;
  if (last?.kind === "away") return "back";
  const evidence = Math.max(seen ?? -Infinity, last?.at ?? -Infinity);
  const gone = now - evidence > ROLL_AWAY_MS;
  if (!last) return seen === undefined || gone ? "here" : null;
  return gone ? "back" : null;
}

/**
 * **The agent's latest roll line on this canvas** — read from the Chat
 * itself, so the canvas is the memory: a host that keeps nothing across a
 * restart still knows whether its agent has ever said hello here, and says
 * `back` at most once a window instead of `here` every time.
 */
export function lastRoll(canvas: CanvasContents, actorId: string): { kind: RollKind; at: number } | null {
  const chat = mainThread(canvas);
  if (!chat) return null;
  for (let i = chat.comments.length - 1; i >= 0; i--) {
    const c: Comment = chat.comments[i]!;
    if (typeof c.record === "string" && c.author.id === actorId) return { kind: c.record, at: Date.parse(c.createdAt) };
  }
  return null;
}

/**
 * **The words**, in plain language, with what the agent will answer. The
 * policy half is `policyWords`' sentence ("listens only to Ada"), so the
 * Chat, the rc's terminal and `isocan who` say the same thing about whose
 * word wakes it. No `@`: a roll line names the agent and must not look like
 * a summons to anybody reading it, person or parser.
 */
export function rollWords(kind: RollKind, name: string, listens: string): string {
  if (kind === "away") return `${name} stepped away — not answering here until it is back.`;
  const verb = kind === "here" ? "is here" : "is back";
  return `${name} ${verb} — answering a mention or the Chat; ${listens}.`;
}

/**
 * **The op that says a roll line in the Chat**: a reply to the canvas's main
 * thread, or the Chat's first message when there is none yet — born the way
 * the Chat panel births it. Always a record.
 */
export function rollOp(canvas: CanvasContents, kind: RollKind, body: string): Operation {
  const comment: NewComment = { id: newCommentId(), body, record: kind };
  const chat = mainThread(canvas);
  if (chat) return { type: "thread.reply", threadId: chat.id, comment };
  return { type: "thread.create", threadId: newThreadId(), x: 80, y: 80, anchorItemId: null, main: true, comment };
}
