import { annotationTarget } from "./annotation.ts";
import { itemKind } from "./kinds.ts";
import type { Move } from "./layout.ts";
import { childrenOf, parentOf } from "./lineage.ts";
import type { CanvasState, Item } from "./model.ts";

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
export const FORMAT_GAP_X = 80;
export const FORMAT_GAP_Y = 64;
/** Between a parent and the column under it — tighter, to read as belonging. */
export const FORMAT_CHILD_GAP_Y = 40;
/** Between the screens and the reference block below them. */
export const FORMAT_BAND_GAP_Y = 160;

export interface FormatOptions {
  /** Where the top-left of the arrangement goes. Defaults to where the
   * canvas already starts, so a format does not teleport the whole canvas. */
  origin?: { x: number; y: number };
  /** How many images per row in the reference block. */
  perRow?: number;
}

/** What an item counts as, for arranging: something you look at, something you
 * referred to, or something that belongs to another item. */
function role(canvas: CanvasState, item: Item): "screen" | "reference" | "attached" {
  if (annotationTarget(item) && canvas.items[annotationTarget(item)!]) return "attached";
  const kind = itemKind(item);
  return kind === "image" || kind === "video" ? "reference" : "screen";
}

/**
 * The moves that arrange the canvas. Only what actually changes, so running it
 * twice does nothing the second time — a formatted canvas is a fixed point.
 */
export function formatMoves(canvas: CanvasState, options: FormatOptions = {}): Move[] {
  const items = Object.values(canvas.items);
  if (items.length === 0) return [];

  const screens = items.filter((item) => role(canvas, item) === "screen");
  const reference = items.filter((item) => role(canvas, item) === "reference");

  // Roots of the screen forest, in the reading order they already have. A
  // screen whose parent is a reference image (or is gone) is a root here: the
  // row is what you look at, and every screen has to appear in it once.
  const screenIds = new Set(screens.map((item) => item.id));
  const roots = screens
    .filter((item) => {
      const parent = parentOf(item);
      return parent === null || !screenIds.has(parent);
    })
    .sort((a, b) => a.x - b.x || a.y - b.y);

  const origin = options.origin ?? {
    x: Math.min(...items.map((item) => item.x)),
    y: Math.min(...items.map((item) => item.y)),
  };

  const placed = new Map<string, { x: number; y: number }>();

  /** A root and everything under it: one column, and the width of the widest
   * thing in it, which is what the next root has to clear. */
  function placeColumn(item: Item, x: number, y: number, seen: Set<string>): { width: number; bottom: number } {
    if (seen.has(item.id)) return { width: 0, bottom: y };
    seen.add(item.id);
    placed.set(item.id, { x, y });
    let width = item.width;
    let bottom = y + item.height;
    for (const child of childrenOf(canvas, item.id)) {
      if (!screenIds.has(child.id)) continue;
      const below = placeColumn(child, x, bottom + FORMAT_CHILD_GAP_Y, seen);
      width = Math.max(width, below.width);
      bottom = below.bottom;
    }
    return { width, bottom };
  }

  const seen = new Set<string>();
  let cursorX = origin.x;
  let deepest = origin.y;
  for (const root of roots) {
    const column = placeColumn(root, cursorX, origin.y, seen);
    cursorX += column.width + FORMAT_GAP_X;
    deepest = Math.max(deepest, column.bottom);
  }

  // Reference material, gathered: a grid below the screens, rows as tall as
  // their tallest member so nothing overlaps a neighbour.
  if (reference.length > 0) {
    const perRow = Math.max(1, options.perRow ?? Math.ceil(Math.sqrt(reference.length)));
    const ordered = [...reference].sort((a, b) => a.x - b.x || a.y - b.y);
    let rowTop = roots.length > 0 ? deepest + FORMAT_BAND_GAP_Y : origin.y;
    for (let i = 0; i < ordered.length; i += perRow) {
      const row = ordered.slice(i, i + perRow);
      let x = origin.x;
      for (const item of row) {
        placed.set(item.id, { x, y: rowTop });
        x += item.width + FORMAT_GAP_X;
      }
      rowTop += Math.max(...row.map((item) => item.height)) + FORMAT_GAP_Y;
    }
  }

  const moves: Move[] = [];
  for (const [itemId, at] of placed) {
    const item = canvas.items[itemId]!;
    const x = Math.round(at.x);
    const y = Math.round(at.y);
    if (item.x !== x || item.y !== y) moves.push({ itemId, x, y });
  }
  return moves;
}
