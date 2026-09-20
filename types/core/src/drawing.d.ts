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
/**
 * **The drawing's colour, recorded as a fact when the ink is laid down.**
 *
 * `Item` has no colour field and a drawing's strokes live inside its SVG blob,
 * so nothing that holds only an `Item` — which is everything downstream of the
 * canvas, including the projection a live session is handed — can tell what
 * colour a drawing is. `itemColour` had a branch for strokes and no production
 * caller could ever reach it: "move the red one" was unresolvable because red
 * is not a paper and ink was never read.
 *
 * Writing the word at creation is the mechanism the voice research note asked
 * for. Every path that makes a drawing fills it: the Pen and `drawing_add`
 * from the strokes in hand, the CLI's add and merge by reading them back with
 * `inkFromSvg`. One field, read by the browser and the standing harness alike,
 * which is what stops them disagreeing about what "red" means.
 *
 * Two gaps remain and neither is pretended away. Drawings made BEFORE this
 * carry no word, because nothing rewrites old items. And **a picture's face**
 * — a photograph, a screenshot, a card — is pixels rather than paths, so it
 * needs a raster decoder this does not have and stays colourless.
 *
 * Unlike `paper` and `tint`, which are restricted to the five paper colours,
 * this holds any word in the spoken vocabulary: a pen draws in red, and red is
 * the case this exists for.
 */
export declare const INK_PROP = "ink";
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
/**
 * **Ink read back out of the SVG it was written into** — the inverse of
 * `drawingSvg`, and deliberately only that.
 *
 * A drawing's strokes stop existing the moment it is made: they become an SVG
 * blob, and `Item` has no colour field. `drawingProperties` closes that for
 * the two callers that still HAVE the strokes — the Pen and `drawing_add` —
 * but the CLI's drawing paths are handed an SVG and had nothing to record, so
 * every drawing added or merged from the terminal came out colourless.
 *
 * This is not an SVG renderer and must not become one. It round-trips the
 * closed format `drawingSvg` writes: `<path>` elements with a literal hex
 * `stroke`, a `stroke-width`, and a `d` of `M`/`L`/`Q` in world coordinates.
 * Anything else yields the strokes it could read and no more — a drawing
 * somebody else's tool made stays colourless, which is the honest answer
 * rather than a guess.
 *
 * **On-curve points only.** A `Q` contributes its endpoint and not its
 * control, so the polyline here is a little shorter than the curve it stands
 * for. That is fine for the only thing this feeds: `inkColour` compares
 * per-colour totals to pick a winner, and the approximation is monotonic, so
 * it changes no comparison it could decide.
 */
export declare function inkFromSvg(svg: string): InkStroke[];
/** The blob: strokes as an SVG whose viewBox is `bounds` in world space. */
export declare function drawingSvg(strokes: InkStroke[], bounds: InkBounds): string;
