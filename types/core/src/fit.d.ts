import type { CanvasContents } from "./model.js";
/** An item and the size its content actually wants. */
export interface FitTarget {
    itemId: string;
    width: number;
    height: number;
}
interface FitResult {
    resizes: {
        itemId: string;
        width: number;
        height: number;
    }[];
    moves: {
        itemId: string;
        x: number;
        y: number;
    }[];
}
/**
 * Grow items to fit their content, and keep them off each other.
 *
 * Items are capped when they arrive — an image at 480 wide, an HTML screen at
 * 420x320 whatever it was designed at — so a screen lands on the canvas
 * showing a corner of itself. Growing one is easy; growing six is not, because
 * every one of them expands into where its neighbours are.
 *
 * So the two halves are one operation. Sizes are applied first, then each item
 * is settled in turn, and the pass is deterministic and pure so the CLI and
 * the web app cannot lay the same canvas out differently.
 *
 * ORDER IS THE DESIGN. Items settle in reading order of where they already
 * are, and the first one keeps its position exactly. That way a row stays a
 * row and a column stays a column: growth pushes outward from the top-left of
 * the group rather than scattering it, and the arrangement somebody made by
 * hand survives.
 */
export declare function fitMoves(canvas: CanvasContents, targets: FitTarget[]): FitResult;
export {};
