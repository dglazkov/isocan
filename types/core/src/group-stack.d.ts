import type { CanvasContents, Item } from "./model.js";
import type { GroupAction } from "./canvas-group-types.js";
/**
 * **The pile's card** (groups-by-hand phase 4): the size a new item lands at
 * (`defaultSize`), so a pile reads as one of the things on the canvas rather
 * than as a frame, under a compact title band, with room on every side for
 * the cards turned behind it. Fixed rather than the top member's size, so a
 * pile of a phone screen and a 1440 page is one card, and so where a stack is
 * is known without reading any member (`groupStackBox` writes the sum out).
 */
export declare const GROUP_STACK: {
    width: number;
    height: number;
    title: number;
    pad: number;
};
/** How many members show behind the top card; the rest are counted, not drawn. */
export declare const STACK_BEHIND = 6;
/** One card of a pile, in world units about the card's own centre. */
interface StackCard {
    id: string;
    depth: number;
    x: number;
    y: number;
    rotate: number;
}
/** The members a stack shows, top first: direct children in reading order (`groupChildren`), less ink attached to them. */
export declare function groupStackMembers(canvas: CanvasContents, groupId: string): Item[];
/**
 * **The pile at rest** (groups-by-hand phase 4): the top card upright in the
 * middle; up to six behind it, each turned and nudged by a hash of its own id,
 * so edges show on every side — a hand-squared stack of playing cards, not a
 * neat offset (that is a version stack, and this must never read as one).
 *
 * The nudge is a fraction of the card — about 17px on the prototype's 150px
 * card, which is ±11% of its width — so the pile keeps its look at isocan's
 * card size. Back to front is the caller's: `depth` 0 is the top.
 */
export declare function stackPile(ids: readonly string[], card?: {
    width: number;
    height: number;
}): StackCard[];
/**
 * **The pile fanned into a hand**: an arc about its bottom centre, the top card
 * staying in the middle, the rest alternating left and right at 9° and about a
 * sixth of a card a step. Per-viewer and momentary — never stored.
 */
export declare function stackFan(depth: number, card?: {
    width: number;
}): Omit<StackCard, "id" | "depth">;
/** Stack or spread a group: the one act both surfaces send — a `layout` action, so one undo and no new op. */
export declare function groupStackAction(group: Item, stacked: boolean): Extract<GroupAction, {
    kind: "layout";
}>;
/**
 * **⇧S: which groups, and which way** — stack what is spread, spread what is
 * stacked. The groups are the selected ones; a selected member stands for
 * its group; with nothing selected, the group you are standing in. When
 * several disagree they are made to agree: all stacked spreads them, any
 * spread stacks them all, so one press always moves every one the same way.
 * `null` when there is no group to act on.
 */
export declare function stackToggle(canvas: CanvasContents, selection: readonly string[], scope: string | null): {
    groups: Item[];
    stacked: boolean;
} | null;
export {};
