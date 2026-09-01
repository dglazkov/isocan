/**
 * The drawing item: freehand ink laid down with the web app's Pen tool.
 * Deliberately NOT a new op type — a drawing is an ordinary `item.add` whose
 * version blob is an SVG, the same move the mini-browser makes with
 * `text/uri-list` (see browseritem.ts). Everything the vocabulary already
 * promises comes free: undo is `item.delete`, redrawing is `item.addVersion`,
 * `isocan ls` lists it, `isocan get` downloads a real .svg, GC keeps the blob
 * alive, and a client that predates the Pen still renders the picture,
 * because a drawing is just an image.
 *
 * Ink is stored in WORLD coordinates: the SVG's viewBox is the drawing's
 * world bounding box and the item's x/y/width/height are that same box, so a
 * stroke sits on the canvas exactly where it was drawn, at any zoom.
 *
 * These helpers are the contract both clients share, so the CLI and the web
 * app can never disagree about what the blob means.
 */
import type { Item } from "./model.js";
export declare const DRAWING_MIME = "image/svg+xml";
export declare const DRAWING_FILENAME = "sketch.svg";
export declare const DRAWING_TITLE = "Sketch";
/** `properties.kind` on an item born from the Pen — how both clients tell a
 * drawing from any other SVG someone uploaded. */
export declare const DRAWING_KIND = "drawing";
export declare const DRAWING_PROPERTIES: Record<string, string>;
/** Breathing room around the ink, in world units, so a stroke's round cap
 * never touches the item's edge. */
export declare const INK_PADDING = 8;
export interface InkPoint {
    x: number;
    y: number;
}
export interface InkStroke {
    /** World coordinates, in the order the pointer visited them. */
    points: InkPoint[];
    /** Hex color (`#rgb` or `#rrggbb`); anything else is drawn in ink black. */
    color: string;
    /** World-space stroke width — screen width ÷ the zoom it was drawn at, so
     * every stroke keeps the weight it had under the pen. */
    width: number;
}
export interface InkBounds {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}
/**
 * The world box an ink SVG claims — its viewBox, which for a drawing IS its
 * place on the canvas. Null when there is no legible viewBox, which is the
 * honest answer for an SVG this canvas did not draw.
 *
 * Both directions of the invariant need this: `drawingSvg` writes the box in,
 * and anything placing or merging ink has to read the same box back, or the
 * strokes end up somewhere other than where they were drawn.
 */
export declare function drawingViewBox(svg: string): InkBounds | null;
/** Is this item a drawing (as opposed to any other SVG on the canvas)? */
export declare function isDrawingItem(item: Item): boolean;
/**
 * The world box the ink occupies: the points, grown by each stroke's own half
 * width (the ink straddles the path) and then by INK_PADDING. Null when there
 * is nothing to draw.
 */
export declare function inkBounds(strokes: InkStroke[]): InkBounds | null;
/**
 * Sampled pointer positions → one smooth path. Each sample becomes the control
 * point of a quadratic whose endpoints are the midpoints of its neighbours —
 * the classic freehand smoothing: it passes near every sample, never
 * overshoots, and costs nothing to compute mid-gesture.
 *
 * A single point is a dot: a hair-length segment under a round cap.
 */
export declare function inkPath(points: InkPoint[]): string;
/** The blob: strokes as an SVG whose viewBox is `bounds` in world space. */
export declare function drawingSvg(strokes: InkStroke[], bounds: InkBounds): string;
