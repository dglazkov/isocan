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
