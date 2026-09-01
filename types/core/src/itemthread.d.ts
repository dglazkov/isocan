import type { CanvasContents, CommentThread } from "./model.js";
/**
 * **Which conversation belongs to an item.**
 *
 * This lived in the web, where ⇧C needed it, and the CLI never knew the rule
 * — so `isocan ask --item` was about to mint a second thread on an item that
 * already had one, which is exactly the bug ⇧C was fixed for. A rule that one
 * surface enforces and the other has never heard of is not a rule; it is a
 * habit that happens to hold on one screen.
 */
/**
 * Is this pin sitting at its item's top-right corner — the place
 * `anchorOffset` in core puts every thread anchored to an item?
 *
 * Such a pin steps out past the corner so it never takes the resize handle's
 * press (`PIN_NUDGE`, and `.pin.corner` in the stylesheet). Everything else —
 * a pin dropped on open canvas, or placed by hand somewhere on an item in
 * comment mode — keeps the ordinary offset, because it is marking a spot
 * somebody chose and moving it would be answering a different question.
 *
 * Asked of the OFFSET rather than of how the thread was made, so a pin
 * dragged onto that corner behaves like one born there, and threads anchored
 * elsewhere before this existed keep pointing where they always did rather
 * than being silently rearranged.
 */
export declare function atCorner(canvas: CanvasContents, thread: CommentThread): boolean;
/**
 * **The conversation about this item**, if it has one — what ⇧C opens instead
 * of starting a second.
 *
 * An item's thread is not a pin that happens to be near it: it is the item's
 * own conversation, at the item's own corner, and there is one. Pressing ⇧C
 * twice used to mint a second thread at the identical spot, so the two pins
 * stacked exactly and the older one became unreachable — a place to lose a
 * comment, which is the worst thing a comment can be.
 *
 * The corner-anchored one wins when several exist, because that is the one ⇧C
 * and `isocan comment add --item` both put there; a thread anchored somewhere
 * else on the item (dropped in comment mode, aimed at a particular spot) is
 * about that spot and is left alone. Oldest first among equals, so the answer
 * does not change as people talk.
 */
export declare function itemThread(canvas: CanvasContents, itemId: string): CommentThread | null;
