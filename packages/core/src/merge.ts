import { INK_PADDING, drawingViewBox, type InkBounds } from "./drawing.ts";

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

interface MergeablePart {
  /** For the error message when one cannot be merged. */
  id: string;
  svg: string;
}

export class UnmergeableError extends Error {}

/** The `<path …/>` elements, verbatim. */
function pathsOf(svg: string): string[] {
  return [...svg.matchAll(/<path\b[^>]*\/>/g)].map((match) => match[0]);
}

/**
 * One SVG holding every part's strokes, in the order given, with a viewBox
 * covering all of them. Returns the blob and the world box, which is also the
 * box the merged item must occupy — the two must agree or the ink lands
 * somewhere other than where it was drawn.
 */
export function mergeDrawings(parts: MergeablePart[]): { svg: string; bounds: InkBounds } {
  if (parts.length === 0) throw new UnmergeableError("nothing to merge");
  const boxes: InkBounds[] = [];
  const paths: string[] = [];
  for (const part of parts) {
    const box = drawingViewBox(part.svg);
    if (!box) throw new UnmergeableError(`${part.id} has no viewBox — not ink this canvas drew`);
    // A group or a transform means the coordinates in the paths are not world
    // coordinates, and moving somebody's artwork silently is worse than a no.
    if (/<g\b/.test(part.svg) || /\btransform\s*=/.test(part.svg)) {
      throw new UnmergeableError(`${part.id} has groups or transforms — merging would move it`);
    }
    const found = pathsOf(part.svg);
    if (found.length === 0) throw new UnmergeableError(`${part.id} has no strokes in it`);
    boxes.push(box);
    paths.push(...found);
  }
  const bounds: InkBounds = {
    minX: Math.min(...boxes.map((b) => b.minX)),
    minY: Math.min(...boxes.map((b) => b.minY)),
    maxX: Math.max(...boxes.map((b) => b.maxX)),
    maxY: Math.max(...boxes.map((b) => b.maxY)),
  };
  const width = round(bounds.maxX - bounds.minX);
  const height = round(bounds.maxY - bounds.minY);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"` +
    ` viewBox="${round(bounds.minX)} ${round(bounds.minY)} ${width} ${height}">\n` +
    `${paths.map((path) => `  ${path}`).join("\n")}\n</svg>\n`;
  return { svg, bounds };
}

/** Two decimals, as drawing.ts writes them. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}
