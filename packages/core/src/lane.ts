import type { CanvasContents, Comment, CommentThread } from "./model.ts";

/**
 * **What a message MADE, as opposed to what it mentioned.**
 *
 * isocan has always recorded this and has never drawn it. A comment carries
 * `items` — the ids it #-referenced, resolved when it was written — and every
 * item and every version carries who made it and when. Put those together and
 * a conversation stops being a list of remarks and becomes a record of what
 * the work produced: "here is what I built" and "look at that" are different
 * claims, and only one of them deserves an arrow.
 *
 * **The rule, and why each half is there.**
 *
 * - IN the message's `items`. Nothing is inferred from the prose; if the
 *   author did not point at it, this does not guess that they meant it.
 * - By the SAME author. An agent's message does not get credit for the
 *   version a person uploaded thirty seconds later.
 * - IN THE SPAN THIS MESSAGE OWNS. The upper bound is that author's next
 *   message: without it, the first message that ever mentioned an item claims
 *   every version made afterwards, and a long thread grows arrows pointing at
 *   work a later message did.
 *
 *   The lower bound is the author's PREVIOUS message — not the message's own
 *   timestamp, which is where this started and where it was nearly useless.
 *   `comment.items` is resolved when the message is written, so an agent
 *   cannot #-reference something that does not exist yet; the only way to
 *   point at a new item is to make it FIRST and announce it after. Requiring
 *   the work to come after the words meant the commonest flow in the product
 *   — build it, then say so — produced no arrow at all, while "announce, then
 *   build, then edit the message" was the only path that worked. That is a
 *   rule describing a habit nobody has.
 *
 *   With no previous message there is still a floor, `CLAIM_GRACE_MS`, or a
 *   first message would claim work its author did a month ago. The span is
 *   "what this message is announcing", and a couple of minutes is the
 *   generous end of what announcing means.
 *
 * The version number is the 1-based position in `versions`, which is
 * append-only in creation order — the same "v5" the item's own badge shows,
 * so a chip and the thing it points at agree.
 */
interface LaneEntry {
  itemId: string;
  title: string;
  /** 1-based, matching the badge on the item. */
  version: number;
  /** The message brought the item into existence, rather than adding to it. */
  born: boolean;
}

/**
 * How far back a message may claim work when its author has not spoken before.
 * Long enough to cover "make the thing, then say so", short enough that a
 * first message cannot claim a canvas somebody built last week.
 */
const CLAIM_GRACE_MS = 120_000;

/** When this author next speaks in the thread — the upper bound for what this
 *  message can claim. `null` means they never speak again, so the bound is
 *  open and everything after belongs to this message. */
function nextWordFrom(thread: CommentThread, comment: Comment): string | null {
  const later = thread.comments
    .filter((c) => c.author.id === comment.author.id && c.createdAt > comment.createdAt)
    .map((c) => c.createdAt)
    .sort();
  return later[0] ?? null;
}

/** Where this message's span begins: the author's previous word, or a short
 *  grace before the message itself when this is their first. */
function sinceFor(thread: CommentThread, comment: Comment): string {
  const earlier = thread.comments
    .filter((c) => c.author.id === comment.author.id && c.createdAt < comment.createdAt)
    .map((c) => c.createdAt)
    .sort();
  const previous = earlier[earlier.length - 1];
  if (previous) return previous;
  return new Date(Date.parse(comment.createdAt) - CLAIM_GRACE_MS).toISOString();
}

export function laneFor(
  canvas: CanvasContents,
  thread: CommentThread,
  comment: Comment,
): LaneEntry[] {
  const until = nextWordFrom(thread, comment);
  const since = sinceFor(thread, comment);
  const entries: LaneEntry[] = [];
  for (const itemId of comment.items ?? []) {
    const item = canvas.items[itemId];
    if (!item) continue; // deleted, or never visible to us
    const mine = item.versions.filter(
      (v) =>
        v.createdBy.id === comment.author.id &&
        v.createdAt >= since &&
        (until === null || v.createdAt < until),
    );
    if (mine.length === 0) continue; // mentioned, not made
    // The LAST one in the window: an agent that saved three times between two
    // messages produced the third, and pointing at the first would send
    // somebody to a version that has already been superseded.
    const last = mine[mine.length - 1]!;
    entries.push({
      itemId,
      title: item.title,
      version: item.versions.findIndex((v) => v.id === last.id) + 1,
      born: item.createdAt >= since && (until === null || item.createdAt < until),
    });
  }
  return entries;
}

/** Everything a thread produced, newest message last — the lane as a whole. */
export function laneOf(
  canvas: CanvasContents,
  thread: CommentThread,
): { comment: Comment; made: LaneEntry[] }[] {
  return thread.comments
    .map((comment) => ({ comment, made: laneFor(canvas, thread, comment) }))
    .filter((row) => row.made.length > 0);
}
