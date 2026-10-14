import type { Move } from "./layout.js";
import type { CanvasContents, Item } from "./model.js";
/**
 * **Tidy, as a person means it: straighten what is there, keep the
 * arrangement** (14 Oct 2026).
 *
 * The first Tidy on a selection was the lattice (`formatMoves` in `grid`
 * mode): every item re-dealt into a √n-per-row grid whose columns are the
 * width of the widest item, in a reading order guessed from coarse bands of
 * `y`. It decided a NEW arrangement. Dion selected four things sitting in a
 * loose arrangement, pressed Tidy, and got a different one — two cards that
 * had been stacked put side by side, a title that ran under everything moved
 * to the top right — and, because the lattice counted no chrome, a title
 * pressed against the label strip drawn above its new neighbour so the two
 * texts sat on top of each other. "I just wanted to clean up the alignment."
 *
 * So this is the default now, and the lattice keeps its own name (`grid`):
 *
 * 1. **Snap near-aligned edges.** Tops, then bottoms, then middles share a row
 *    when they are within a tolerance; lefts, rights and centres share a
 *    column. A shared line is the thing a person squints at and fixes by hand.
 * 2. **Even out nearly-equal gaps.** Between neighbours in a row and in a
 *    column, gaps that are almost the same become the same — unless moving the
 *    item would break a line it was just snapped onto.
 * 3. **Never overlap.** Each item's footprint is its box AND the chrome the
 *    canvas draws outside it — the name strip above, the row of marks below —
 *    and the tidy never leaves two footprints touching that did not already.
 *    When a snap would, the later item (in reading order) is pushed the way it
 *    already sat from the other: down if it was below, right if beside.
 *
 * Nothing is re-dealt: an item that was left of another stays left of it, an
 * item that was above stays above, and everything moves by at most the snap
 * tolerance unless it had to move to clear an overlap.
 *
 * Pure geometry on boxes, so the web app, `isocan tidy <items...>` and the
 * group-canvas act (`groupArrangeAction`) all land on the same numbers, and
 * one `items.move` (or one group transform) is one undo.
 */
/**
 * **What the canvas draws OUTSIDE an item, in screen pixels.**
 *
 * Above: the title row (`.item-titlebar`), which sits 6px + the 1px border
 * above the item and is a 15px line beside a 13px kind icon — 22, rounded to
 * the 24 groups already reserve. Below: the marks row (`.item-under`), 8px of
 * clearance (`UNDER_ROW_PAD`) and a 22px reaction button — 30, rounded to 32.
 * Both are counter-scaled, so in WORLD units they are these divided by the
 * zoom: at 15% the name strip is 160 world units tall, which is exactly how a
 * 40-unit lattice gutter let a title land on a neighbour's name.
 */
export declare const ITEM_CHROME: {
    readonly above: 24;
    readonly below: 32;
};
/** World units of chrome above and below one item. */
interface ItemChrome {
    above: number;
    below: number;
}
/**
 * **An item's chrome in world units at a zoom.** Group frames draw their name
 * inside their own header and annotations wear nothing (they ride on their
 * target), so both are zero; every other item — text nodes included, which
 * show their name on hover and selection like anything else — carries the
 * strip above and the row below. `scale` defaults to 1, which is what a
 * surface with no zoom (the CLI) uses.
 */
export declare function itemChrome(item: Item, scale?: number): ItemChrome;
interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}
/** One thing a tidy may move: its box (what lines up) and its footprint
 * (what must not overlap — the box plus chrome plus anything that rides on it). */
export interface TidyUnit {
    id: string;
    box: Rect;
    footprint: Rect;
}
/** How a tidy is tuned. Every field is optional. */
interface TidyOptions {
    /** Footprints that do not move but must not be run into — the unselected
     * neighbours. One already touching a unit before the tidy is left alone. */
    obstacles?: readonly Rect[];
    /** The smallest snap distance in world units, whatever the sizes say. The
     * app passes a few screen pixels at the current zoom, so "nearly lined up"
     * means what it looks like. */
    tolerance?: number;
}
/**
 * The tidy itself, on units: where each one's box should go. Returns a new
 * top-left for every unit (moved or not), keyed by id. See the file comment
 * for the three rules and their order.
 */
export declare function tidyInPlace(units: readonly TidyUnit[], options?: TidyOptions): Map<string, {
    x: number;
    y: number;
}>;
/**
 * **Tidy these items where they are** — the moves for the default Tidy on a
 * selection, on a canvas without groups. Annotations are not units: a mark on
 * a selected item widens that item's footprint and travels with it. `chrome`
 * says how much the canvas draws around each item in world units; the app
 * passes the current zoom's, the CLI the 1:1 default. Unselected items are
 * obstacles. Fewer than two units moves nothing.
 */
export declare function tidyMoves(canvas: CanvasContents, itemIds: readonly string[], options?: {
    chrome?: (item: Item) => ItemChrome;
    tolerance?: number;
}): Move[];
export {};
