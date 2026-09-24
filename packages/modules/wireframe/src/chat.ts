import { mainThread, newCommentId, newThreadId, type CanvasContents, type Operation } from "@isocan/core";

/**
 * **What a `/wire` act made, said in the Chat** (phase 8, part C).
 *
 * The web's `/wire` acts reported in the notice bar only, which flashes and
 * is gone: an hour later nobody could say what the Wire builder had made, or
 * what it cost. So each act, when it finishes, leaves one message in the
 * Chat — the canvas's main thread — in the Wire builder's words: what was
 * made, and the numbers. It is posted by the person who asked (a module's
 * write is the viewer's hands; presence is honest) as a `record`, which
 * summons no agent, and it rides the act's own op group: the one undo that
 * takes the flow back takes its record back too, so the Chat never says a
 * flow exists that does not.
 *
 * The terminal does not post one: `isocan wire …` prints the same lines to
 * the agent that ran it, and the `/wire` skill already tells an agent to post
 * ONE comment saying what landed — a second, automatic one would say it
 * twice.
 */

/** Who is speaking, as the message's first words. */
export const WIRE_BUILDER = "Wire builder";

/** The op that says `lines` in the Chat, attached to `items` — a reply, or the Chat's first message. */
export function chatRecordOp(canvas: CanvasContents, lines: readonly string[], items: readonly string[] = []): Operation {
  // A paragraph per line: the Chat renders Markdown, where a single newline is a space.
  const body = `**${WIRE_BUILDER}** — ${lines.join("\n\n")}`;
  const comment = { id: newCommentId(), body, record: true as const, ...(items.length ? { items: [...new Set(items)] } : {}) };
  const thread = mainThread(canvas);
  if (thread) return { type: "thread.reply", threadId: thread.id, comment };
  // No Chat yet: born the way the Chat panel births it, with this as its first message.
  return { type: "thread.create", threadId: newThreadId(), x: 80, y: 80, anchorItemId: null, main: true, comment };
}
