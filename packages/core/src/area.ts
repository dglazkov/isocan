import type { CanvasContents, Item } from "./model.ts";
import { PLACEMENT_CLEARANCE, PLACEMENT_GAP, nearestFreeSpot, overlaps } from "./placement.ts";
import { isPaper, type Paper } from "./textnode.ts";

/**
 * **An area: a titled region things are placed in, walked to, and read back
 * from.**
 *
 * `docs/projects/sprint/journey.md` is where this comes from. A facilitator
 * running a real sprint covers the wall in labelled sheets, one per phase, so
 * the week is visible before it starts and everyone always knows where to
 * stand. That sheet is an area, and once the canvas has them the sprint is
 * the facilitator laying them out and walking the room from one to the next.
 * But nothing here knows about sprints: an area is a region with a name, and
 * a mind map, a mood board or a retro can use one the same way.
 *
 * **An area is an ITEM.** `kind=area` on an ordinary markdown item, the way
 * a text node and a post-it are: its title is the area's name, its blob is
 * the card — the few lines that say what happens here — and its box is the
 * region. So it moves, resizes, undoes, replicates, copies and lists like
 * everything else, and the CLI can make one with the ops it already has.
 * Zero new op types.
 *
 * **Membership is DERIVED by geometry, never stored.** An item is *in* an
 * area when its centre lies inside the area's box — the same shape of
 * answer a lane's arrows and a map's edges give: read off where things are
 * now, so nothing has to be kept in sync when something is dragged out, and
 * an item dragged in is simply in. No `areaId` on items, no list on the
 * area, nothing that can be stale. The centre rather than the whole box,
 * because a sketch half over the edge is still "in the Sketches area" to
 * anyone looking, and a wall that lost a sketch for straddling a line would
 * be a wall arguing with the room.
 *
 * Areas do not nest for membership: an area is never *in* another area. The
 * one exception is `areaOf`, which answers for an item, not for an area.
 */

export const AREA_KIND = "area";
export const AREA_PROPERTIES: Record<string, string> = { kind: AREA_KIND };
export const AREA_MIME = "text/markdown";
export const AREA_FILENAME = "area.md";

/** The tint the sheet is drawn in — the paper palette, reused on purpose:
 *  a tint is a background that means nothing (`core/textnode.ts`), and a
 *  second palette would be a second thing to tune per theme. */
export const AREA_TINT_PROP = "tint";

/** How tall the title strip is, in world units — the band at the top of the
 *  sheet that says the area's name and is the handle you drag it by. Things
 *  placed `--in` an area start below it. */
export const AREA_TITLE_HEIGHT = 56;

/** The band under the title where the card is drawn — what happens here,
 *  in a few lines. Reserved whether or not the sheet has a card, so the
 *  first thing placed on a sheet never lands on the words that say what
 *  the sheet is for (which is exactly what happened before it was). */
export const AREA_CARD_HEIGHT = 120;

/** Title and card together: where the sheet's own words end and its
 *  contents begin. */
export const AREA_HEAD = AREA_TITLE_HEIGHT + AREA_CARD_HEIGHT;

/** Inset from the sheet's edge for anything placed inside it. */
export const AREA_INSET = 24;

/** A sensible default sheet: room for a row of sketches with a title above. */
export const AREA_DEFAULT_SIZE = { width: 1600, height: 1000 };

export function isArea(item: Item): boolean {
  return item.properties.kind === AREA_KIND;
}

/** The tint an area wears, or null for the plain sheet. */
export function areaTint(item: Item): Paper | null {
  const raw = item.properties[AREA_TINT_PROP];
  return isPaper(raw) ? raw : null;
}

/** The patch that tints an area, or clears its tint. */
export function areaTintPatch(
  tint: Paper | null,
): { properties: Record<string, string> } | { removeProperties: string[] } {
  return tint === null
    ? { removeProperties: [AREA_TINT_PROP] }
    : { properties: { [AREA_TINT_PROP]: tint } };
}

/** Every area on the canvas, in reading order — left to right, then down. */
export function areasOf(canvas: CanvasContents): Item[] {
  return Object.values(canvas.items)
    .filter(isArea)
    .sort((a, b) => a.x - b.x || a.y - b.y || a.id.localeCompare(b.id));
}

/** The region inside the sheet where things go: under the title, inset. */
export function areaInner(area: Item): { x: number; y: number; width: number; height: number } {
  return {
    x: area.x + AREA_INSET,
    y: area.y + AREA_HEAD,
    width: Math.max(0, area.width - AREA_INSET * 2),
    height: Math.max(0, area.height - AREA_HEAD - AREA_INSET),
  };
}

/** Is this item in this area — by its centre, and never for an area itself. */
export function inArea(area: Item, item: Item): boolean {
  if (item.id === area.id || isArea(item)) return false;
  const cx = item.x + item.width / 2;
  const cy = item.y + item.height / 2;
  return cx >= area.x && cx < area.x + area.width && cy >= area.y && cy < area.y + area.height;
}

/** What is in the area right now, in reading order. */
export function itemsIn(canvas: CanvasContents, area: Item): Item[] {
  return Object.values(canvas.items)
    .filter((item) => inArea(area, item))
    .sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
}

/**
 * The area an item is in, or null. When areas overlap, the SMALLEST one
 * wins: a sheet laid inside a bigger sheet is the more specific claim.
 */
export function areaOf(canvas: CanvasContents, item: Item): Item | null {
  const holding = areasOf(canvas).filter((area) => inArea(area, item));
  if (holding.length === 0) return null;
  return holding.sort((a, b) => a.width * a.height - b.width * b.height)[0]!;
}

/** An area by exact title, then by case-insensitive prefix — how `--in`
 *  names one. Null when nothing matches; the caller says so. */
export function findArea(canvas: CanvasContents, ref: string): Item | null {
  const areas = areasOf(canvas);
  const exact = areas.find((a) => a.id === ref || a.title === ref);
  if (exact) return exact;
  const needle = ref.trim().toLowerCase();
  if (!needle) return null;
  return areas.find((a) => a.title.toLowerCase().startsWith(needle)) ?? null;
}

export interface AreaSpot {
  x: number;
  y: number;
  areaId?: string;
  resizedArea?: { width: number; height: number };
  shifts?: Array<{ itemId: string; x: number; y: number }>;
}

/**
 * Where a new thing of this size can sit INSIDE the area without landing on
 * anything already there.
 *
 * If the area has room, it takes the nearest free spot within the sheet's
 * inner region in reading order.
 *
 * If the area cannot fit the new item within its current boundaries, the area
 * AUTOMATICALLY GROWS: it finds a clear spot in reading order (flowing across
 * the row and wrapping downward into subsequent rows) and returns the required
 * expanded sheet dimensions in `resizedArea`. If the item is wider than the
 * sheet, the sheet widens to accommodate it and downstream items/areas to the
 * right are shifted to prevent overlap.
 */
export function freeSpotIn(
  canvas: CanvasContents,
  area: Item,
  width: number,
  height: number,
): AreaSpot {
  const inner = areaInner(area);
  const occupied = Object.values(canvas.items)
    .filter((item) => !isArea(item))
    .map((item) => ({ x: item.x, y: item.y, width: item.width, height: item.height }));
  const want = { x: inner.x, y: inner.y, width, height };
  const within = {
    x: inner.x - PLACEMENT_CLEARANCE,
    y: inner.y - PLACEMENT_CLEARANCE,
    width: inner.width + PLACEMENT_CLEARANCE * 2,
    height: inner.height + PLACEMENT_CLEARANCE * 2,
  };
  const spot = nearestFreeSpot(want, occupied, within);

  const inside =
    spot.x >= within.x &&
    spot.y >= within.y &&
    spot.x + width <= within.x + within.width &&
    spot.y + height <= within.y + within.height;
  const clear =
    inside && !occupied.some((item) => overlaps({ ...spot, width, height }, item, PLACEMENT_CLEARANCE));

  if (clear) {
    return { x: spot.x, y: spot.y };
  }

  // Area cannot fit the item within current bounds: auto-grow.
  const growWidth = Math.max(inner.width, width);
  const growWithin = {
    x: inner.x - PLACEMENT_CLEARANCE,
    y: inner.y - PLACEMENT_CLEARANCE,
    width: growWidth + PLACEMENT_CLEARANCE * 2,
    height: Number.MAX_SAFE_INTEGER,
  };
  const grownSpot = nearestFreeSpot(want, occupied, growWithin);
  const grownInside =
    grownSpot.x >= growWithin.x &&
    grownSpot.y >= growWithin.y &&
    grownSpot.x + width <= growWithin.x + growWithin.width;
  const grownClear =
    grownInside &&
    !occupied.some((item) => overlaps({ ...grownSpot, width, height }, item, PLACEMENT_CLEARANCE));

  let finalSpot: { x: number; y: number };
  if (grownClear) {
    finalSpot = grownSpot;
  } else {
    // Fallback below the lowest item in this area to guarantee no overlap
    const inThisArea = itemsIn(canvas, area);
    const lowestY =
      inThisArea.length === 0
        ? inner.y
        : Math.max(...inThisArea.map((i) => i.y + i.height));
    finalSpot = { x: inner.x, y: lowestY + PLACEMENT_GAP };
  }

  const neededWidth = Math.max(area.width, Math.round(finalSpot.x + width - area.x + AREA_INSET));
  const neededHeight = Math.max(area.height, Math.round(finalSpot.y + height - area.y + AREA_INSET));

  const shifts: Array<{ itemId: string; x: number; y: number }> = [];
  if (neededWidth > area.width) {
    const deltaX = neededWidth - area.width;
    const rightThreshold = area.x + area.width - PLACEMENT_CLEARANCE;
    for (const item of Object.values(canvas.items)) {
      if (item.id !== area.id && item.x >= rightThreshold) {
        shifts.push({ itemId: item.id, x: item.x + deltaX, y: item.y });
      }
    }
  }

  return {
    x: finalSpot.x,
    y: finalSpot.y,
    areaId: area.id,
    resizedArea: { width: neededWidth, height: neededHeight },
    ...(shifts.length > 0 ? { shifts } : {}),
  };
}

/**
 * Calculate the sheet dimensions required to enclose these items with title
 * header and insets. Returns null if the area already comfortably encloses them.
 */
export function areaEnclosing(
  area: Item,
  items: readonly Item[],
): { width: number; height: number } | null {
  if (items.length === 0) return null;
  const maxRight = Math.max(...items.map((i) => i.x + i.width));
  const maxBottom = Math.max(...items.map((i) => i.y + i.height));
  const neededWidth = Math.max(area.width, Math.round(maxRight - area.x + AREA_INSET));
  const neededHeight = Math.max(area.height, Math.round(maxBottom - area.y + AREA_INSET));
  if (neededWidth === area.width && neededHeight === area.height) return null;
  return { width: neededWidth, height: neededHeight };
}

/**
 * **A grid on a sheet** (sprint phase 5): rows and columns, each with a
 * name, drawn as guides inside the sheet — the storyboard is one row of
 * fifteen frames, Friday's test wall is people down the side and frames
 * along the top. Four properties on the area item and nothing else: a cell
 * is geometry (the inner region divided evenly), so an item is IN a cell by
 * its centre the way it is in the sheet, and `isocan text --in Test --cell
 * 3,4` is a placement, not a relation. Rows and columns are counted from 1,
 * top-left, because that is how a person reads a table.
 */
export const AREA_ROWS_PROP = "rows";
export const AREA_COLS_PROP = "cols";
export const AREA_ROW_NAMES_PROP = "rowNames";
export const AREA_COL_NAMES_PROP = "colNames";

export interface AreaGrid {
  rows: number;
  cols: number;
  /** A name per row, in order; shorter than `rows` when some are unnamed. */
  rowNames: string[];
  colNames: string[];
}

function splitNames(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((one) => one.trim())
    .filter((one) => one.length > 0);
}

/** The grid a sheet carries, or null for a plain sheet. */
export function areaGrid(area: Item): AreaGrid | null {
  const rows = Number(area.properties[AREA_ROWS_PROP]);
  const cols = Number(area.properties[AREA_COLS_PROP]);
  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 1 || cols < 1) return null;
  return {
    rows,
    cols,
    rowNames: splitNames(area.properties[AREA_ROW_NAMES_PROP]),
    colNames: splitNames(area.properties[AREA_COL_NAMES_PROP]),
  };
}

/** The patch that puts a grid on a sheet, or takes it off — one spelling
 *  for both surfaces. Names are stored comma-joined, so a name may not
 *  carry a comma; the CLI says so when one does. */
export function gridPatch(
  grid: { rows: number; cols: number; rowNames?: string[]; colNames?: string[] } | null,
): { properties: Record<string, string> } | { removeProperties: string[] } {
  if (grid === null) {
    return { removeProperties: [AREA_ROWS_PROP, AREA_COLS_PROP, AREA_ROW_NAMES_PROP, AREA_COL_NAMES_PROP] };
  }
  return {
    properties: {
      [AREA_ROWS_PROP]: String(grid.rows),
      [AREA_COLS_PROP]: String(grid.cols),
      [AREA_ROW_NAMES_PROP]: (grid.rowNames ?? []).join(","),
      [AREA_COL_NAMES_PROP]: (grid.colNames ?? []).join(","),
    },
  };
}

/** The box of one cell, counted from 1 at the top-left. */
export function cellBox(
  area: Item,
  row: number,
  col: number,
): { x: number; y: number; width: number; height: number } {
  const grid = areaGrid(area);
  if (!grid) throw new Error(`"${area.title}" has no grid`);
  if (!Number.isInteger(row) || !Number.isInteger(col) || row < 1 || col < 1 || row > grid.rows || col > grid.cols) {
    throw new Error(`"${area.title}" is ${grid.rows}×${grid.cols} — there is no cell ${row},${col}`);
  }
  const inner = areaInner(area);
  const width = inner.width / grid.cols;
  const height = inner.height / grid.rows;
  return {
    x: Math.round(inner.x + (col - 1) * width),
    y: Math.round(inner.y + (row - 1) * height),
    width: Math.round(width),
    height: Math.round(height),
  };
}

/** Which cell an item's centre is in, or null when off the grid. */
export function cellOf(area: Item, item: Item): { row: number; col: number } | null {
  const grid = areaGrid(area);
  if (!grid || !inArea(area, item)) return null;
  const inner = areaInner(area);
  const cx = item.x + item.width / 2 - inner.x;
  const cy = item.y + item.height / 2 - inner.y;
  if (cx < 0 || cy < 0 || cx >= inner.width || cy >= inner.height) return null;
  return {
    row: Math.min(grid.rows, Math.floor(cy / (inner.height / grid.rows)) + 1),
    col: Math.min(grid.cols, Math.floor(cx / (inner.width / grid.cols)) + 1),
  };
}

/** The first clear spot inside one cell, for a thing of this size. A cell
 *  too small or too full answers its own corner, like a sheet does. */
export function cellSpot(
  canvas: CanvasContents,
  area: Item,
  row: number,
  col: number,
  width: number,
  height: number,
): { x: number; y: number } {
  const cell = cellBox(area, row, col);
  const pad = 8;
  const occupied = Object.values(canvas.items)
    .filter((item) => !isArea(item))
    .map((item) => ({ x: item.x, y: item.y, width: item.width, height: item.height }));
  const want = { x: cell.x + pad, y: cell.y + pad, width, height };
  const within = {
    x: cell.x + pad - PLACEMENT_CLEARANCE,
    y: cell.y + pad - PLACEMENT_CLEARANCE,
    width: Math.max(0, cell.width - pad * 2) + PLACEMENT_CLEARANCE * 2,
    height: Math.max(0, cell.height - pad * 2) + PLACEMENT_CLEARANCE * 2,
  };
  return nearestFreeSpot(want, occupied, within);
}
