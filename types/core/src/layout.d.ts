/**
 * Tidying a canvas: align a set of items to an edge, or space them evenly.
 *
 * The web app does this with the pointer — guides that catch an edge, measure
 * bars that say two gaps match. An agent has no pointer, so it needs the same
 * intent as a verb. The geometry lives here so both arrive at the same
 * coordinates: "aligned" must not mean two things.
 *
 * Every function returns the moves that actually change something, ready to
 * become ONE `items.move` — a tidy is one gesture, and so one undo.
 */
export interface LayoutBox {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
}
export interface Move {
    itemId: string;
    x: number;
    y: number;
}
type AlignEdge = "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom";
export type Axis = "h" | "v";
export declare const ALIGN_EDGES: readonly AlignEdge[];
/**
 * Align to the group's own extreme: "left" means the leftmost item's edge, not
 * some outside origin. Aligning what is already aligned is a no-op, which is
 * what lets an agent run this without checking first.
 */
export declare function alignMoves(boxes: LayoutBox[], edge: AlignEdge): Move[];
/**
 * Equal GAPS, not equal centers — the same thing the canvas's purple measure
 * bars promise, so a drag and this verb agree about what "evenly spaced"
 * means. The outermost two hold still: they define the run.
 */
export declare function distributeMoves(boxes: LayoutBox[], axis: Axis): Move[];
export {};
