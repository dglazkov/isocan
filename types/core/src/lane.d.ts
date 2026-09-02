import type { CanvasContents, Comment, CommentThread } from "./model.js";
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
export declare function laneFor(canvas: CanvasContents, thread: CommentThread, comment: Comment): LaneEntry[];
/** Everything a thread produced, newest message last — the lane as a whole. */
export declare function laneOf(canvas: CanvasContents, thread: CommentThread): {
    comment: Comment;
    made: LaneEntry[];
}[];
export {};
