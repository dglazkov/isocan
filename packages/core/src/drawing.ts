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

import type { Item } from "./model.ts";

export const DRAWING_MIME = "image/svg+xml";
export const DRAWING_FILENAME = "sketch.svg";
export const DRAWING_TITLE = "Sketch";

/** `properties.kind` on an item born from the Pen — how both clients tell a
 * drawing from any other SVG someone uploaded. */
export const DRAWING_KIND = "drawing";
export const DRAWING_PROPERTIES: Record<string, string> = { kind: DRAWING_KIND };

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
export const INK_PROP = "ink";

/** Breathing room around the ink, in world units, so a stroke's round cap
 * never touches the item's edge. */
export const INK_PADDING = 8;

/** The color a stroke falls back to when it is not a plain hex color. */
const INK_FALLBACK_COLOR = "#23262b";

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
export function drawingViewBox(svg: string): InkBounds | null {
  const match = /viewBox\s*=\s*"([-\d.eE\s,]+)"/.exec(svg);
  if (!match) return null;
  const parts = match[1]!.trim().split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [x, y, width, height] = parts as [number, number, number, number];
  if (width <= 0 || height <= 0) return null;
  return { minX: x, minY: y, maxX: x + width, maxY: y + height };
}

/** Is this item a drawing (as opposed to any other SVG on the canvas)? */
export function isDrawingItem(item: Item): boolean {
  return item.properties.kind === DRAWING_KIND;
}

/** Two decimals is finer than a pixel at any zoom anyone draws at, and keeps
 * the blob small — a long stroke is thousands of numbers. */
function r(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * The world box the ink occupies: the points, grown by each stroke's own half
 * width (the ink straddles the path) and then by INK_PADDING. Null when there
 * is nothing to draw.
 */
export function inkBounds(strokes: InkStroke[]): InkBounds | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const stroke of strokes) {
    const reach = stroke.width / 2;
    for (const point of stroke.points) {
      minX = Math.min(minX, point.x - reach);
      minY = Math.min(minY, point.y - reach);
      maxX = Math.max(maxX, point.x + reach);
      maxY = Math.max(maxY, point.y + reach);
    }
  }
  if (minX === Infinity) return null;
  return {
    minX: minX - INK_PADDING,
    minY: minY - INK_PADDING,
    maxX: maxX + INK_PADDING,
    maxY: maxY + INK_PADDING,
  };
}

/**
 * Sampled pointer positions → one smooth path. Each sample becomes the control
 * point of a quadratic whose endpoints are the midpoints of its neighbours —
 * the classic freehand smoothing: it passes near every sample, never
 * overshoots, and costs nothing to compute mid-gesture.
 *
 * A single point is a dot: a hair-length segment under a round cap.
 */
export function inkPath(points: InkPoint[]): string {
  if (points.length === 0) return "";
  const first = points[0]!;
  if (points.length === 1) return `M ${r(first.x)} ${r(first.y)} l 0.01 0`;
  if (points.length === 2) {
    const second = points[1]!;
    return `M ${r(first.x)} ${r(first.y)} L ${r(second.x)} ${r(second.y)}`;
  }
  let d = `M ${r(first.x)} ${r(first.y)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const control = points[i]!;
    const next = points[i + 1]!;
    d += ` Q ${r(control.x)} ${r(control.y)} ${r((control.x + next.x) / 2)} ${r((control.y + next.y) / 2)}`;
  }
  const last = points[points.length - 1]!;
  return `${d} L ${r(last.x)} ${r(last.y)}`;
}

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
export function inkFromSvg(svg: string): InkStroke[] {
  const strokes: InkStroke[] = [];
  for (const [element] of svg.matchAll(/<path\b[^>]*\/>/g)) {
    // `stroke="` cannot match `stroke-width="`, which is why neither needs a
    // negative lookahead.
    const colour = /\bstroke="([^"]*)"/.exec(element)?.[1];
    if (colour === undefined) continue;
    const width = Number(/\bstroke-width="([^"]*)"/.exec(element)?.[1] ?? "1");
    const d = /\bd="([^"]*)"/.exec(element)?.[1];
    if (d === undefined) continue;
    const points = inkPoints(d);
    if (points.length === 0) continue;
    strokes.push({ points, color: colour, width: Number.isFinite(width) ? width : 1 });
  }
  return strokes;
}

/** The anchor points of one `d`, or none if it is not a shape this wrote.
 *  The single-point form `M x y l 0.01 0` is a DOT and comes back as one
 *  point, because `inkColour` measures a dot by its width rather than by a
 *  length of nearly zero. */
function inkPoints(d: string): InkPoint[] {
  if (/^\s*M\s+(-?[\d.]+)\s+(-?[\d.]+)\s+l\s+[\d.]+\s+[\d.]+\s*$/.test(d)) {
    const dot = /^\s*M\s+(-?[\d.]+)\s+(-?[\d.]+)/.exec(d)!;
    return [{ x: Number(dot[1]), y: Number(dot[2]) }];
  }
  const points: InkPoint[] = [];
  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+/g) ?? [];
  let i = 0;
  const take = (): InkPoint | null => {
    const x = Number(tokens[i++]);
    const y = Number(tokens[i++]);
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
  };
  while (i < tokens.length) {
    const command = tokens[i++]!;
    // Unknown command: stop where understanding stopped rather than read the
    // numbers after it as coordinates they are not.
    if (command === "Q") i += 2;
    else if (command !== "M" && command !== "L") return points;
    const point = take();
    if (!point) return points;
    points.push(point);
  }
  return points;
}

/** Only a literal hex color reaches the markup — the one value in this file
 * that is not a number, so the one place a blob could be made to say
 * something other than "here is a picture". */
function safeColor(color: string): string {
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(color) ? color : INK_FALLBACK_COLOR;
}

/** The blob: strokes as an SVG whose viewBox is `bounds` in world space. */
export function drawingSvg(strokes: InkStroke[], bounds: InkBounds): string {
  const width = r(bounds.maxX - bounds.minX);
  const height = r(bounds.maxY - bounds.minY);
  const paths = strokes
    .filter((stroke) => stroke.points.length > 0)
    .map(
      (stroke) =>
        `  <path d="${inkPath(stroke.points)}" fill="none" stroke="${safeColor(stroke.color)}"` +
        ` stroke-width="${r(stroke.width)}" stroke-linecap="round" stroke-linejoin="round"/>`,
    )
    .join("\n");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"` +
    ` viewBox="${r(bounds.minX)} ${r(bounds.minY)} ${width} ${height}">\n${paths}\n</svg>\n`
  );
}
