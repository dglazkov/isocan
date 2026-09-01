import { type InkBounds } from "./drawing.js";
/**
 * Several drawings into one.
 *
 * Holding P sweeps a whole sketch made in passes into a single SVG. An agent
 * asked to do the same thing to marks that are already on the canvas had no
 * way to — so this is that, and it is exact rather than approximate for one
 * reason: ink is stored in WORLD coordinates. A drawing's viewBox IS its world
 * box, so merging is concatenating the paths and taking the union of the
 * boxes. No transform, no resampling, no redrawing — the strokes that come out
 * are byte-for-byte the strokes that went in.
 *
 * Only drawings isocan wrote can be merged this way. A foreign SVG can nest
 * groups, carry its own transforms, or use units these boxes do not mean, and
 * silently moving somebody's artwork is worse than refusing.
 */
export interface MergeablePart {
    /** For the error message when one cannot be merged. */
    id: string;
    svg: string;
}
export declare class UnmergeableError extends Error {
}
/**
 * One SVG holding every part's strokes, in the order given, with a viewBox
 * covering all of them. Returns the blob and the world box, which is also the
 * box the merged item must occupy — the two must agree or the ink lands
 * somewhere other than where it was drawn.
 */
export declare function mergeDrawings(parts: MergeablePart[]): {
    svg: string;
    bounds: InkBounds;
};
/** Padding is already inside each part's box, so a merged box does not grow
 * it again — exported so a caller can say why the box is what it is. */
export declare const MERGE_KEEPS_PADDING = 8;
