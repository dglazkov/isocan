import type { CanvasContents, Item } from "./model.ts";
import { PLACEMENT_CLEARANCE, nearestFreeSpot } from "./placement.ts";
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

/**
 * Where a new thing of this size can sit INSIDE the area without landing on
 * anything already there: the same outward search the daemon uses for the
 * whole canvas, confined to the sheet's inner region, starting at its
 * top-left. Something placed here is placed *chosen*, because the search
 * already found it clear and the daemon must not tidy it out of the area.
 *
 * A sheet too full to hold it still gets an honest answer — the inner
 * region's top-left — rather than a spot outside the area, which would
 * make "in the area" a lie the moment the wall was busy.
 */
export function freeSpotIn(
  canvas: CanvasContents,
  area: Item,
  width: number,
  height: number,
): { x: number; y: number } {
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
  return nearestFreeSpot(want, occupied, within);
}
