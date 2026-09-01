import type { Move } from "./layout.js";
import type { CanvasContents } from "./model.js";
/**
 * One tidy for the whole canvas: the arrangement `/format` means.
 *
 * A canvas that has been worked on is a scatter — screens where they landed,
 * variations beside their source, images wherever they were dropped. The
 * arrangement people actually draw on a whiteboard is a row of the main
 * things, what came from each one hanging underneath it, and the reference
 * material gathered off to one side. That is all this is.
 *
 * It lives in core, and it returns MOVES rather than doing anything, for the
 * usual reason: the web app and an agent running `isocan format` must land
 * every item on the same coordinate, and one `items.move` is one undo — a
 * tidy you cannot take back in one press is a tidy nobody dares run.
 *
 * Three rules, in the order they matter:
 *
 * 1. SCREENS ACROSS. The things you look at — sites, documents, drawings you
 *    made on purpose — go in a row, left to right, in the order they already
 *    sit in. Reading order is a thing people arrange by hand and resent
 *    losing, so it is preserved rather than invented.
 * 2. CHILDREN UNDER THEIR PARENT. An item made FROM another (lineage.ts) goes
 *    in a column beneath it, in the order it was made. Depth keeps going: a
 *    variation of a variation sits under the variation.
 * 3. REFERENCE MATERIAL TOGETHER. Images and video are what you looked at, not
 *    what you built, so they are gathered into a grid below everything else
 *    instead of taking a slot in the row.
 *
 * Annotations are not placed at all: ink that is ABOUT an item belongs on top
 * of it, and it travels with its target when the target moves.
 */
/** Gaps in world units. Generous: a canvas is not a form. */
export declare const FORMAT_GAP_X = 80;
export declare const FORMAT_GAP_Y = 64;
/** Between a parent and the column under it — tighter, to read as belonging. */
export declare const FORMAT_CHILD_GAP_Y = 40;
/** Between the screens and the reference block below them. */
export declare const FORMAT_BAND_GAP_Y = 160;
/**
 * **What kind of tidy.**
 *
 * `grid` cleans up the LINES: every item on one lattice, uniform gutters,
 * left edges that agree. It reads nothing into the canvas — no lineage, no
 * kinds, no opinion about what belongs under what — which is exactly why it is
 * the default. A tidy that only straightens is one somebody can run without
 * wondering what it will decide, and "make it neat" is the request nine times
 * out of ten.
 *
 * `smart` is the arrangement that reads the canvas: screens across, what came
 * from each hanging beneath it, reference material gathered below. It is more
 * useful and more opinionated, and being asked for by name is the right price
 * for moving things somebody did not ask to have interpreted.
 */
export type FormatMode = "grid" | "smart";
export declare const FORMAT_MODES: readonly FormatMode[];
export declare function isFormatMode(value: unknown): value is FormatMode;
export interface FormatOptions {
    /** Which tidy. Defaults to `grid` — see `FormatMode`. */
    mode?: FormatMode;
    /** Where the top-left of the arrangement goes. Defaults to where the
     * canvas already starts, so a format does not teleport the whole canvas. */
    origin?: {
        x: number;
        y: number;
    };
    /** How many images per row in the reference block. */
    perRow?: number;
}
/**
 * The moves that arrange the canvas. Only what actually changes, so running it
 * twice does nothing the second time — a formatted canvas is a fixed point.
 */
export declare function formatMoves(canvas: CanvasContents, options?: FormatOptions): Move[];
