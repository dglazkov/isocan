import type { CanvasContents, Item } from "./model.js";
import { type Paper } from "./textnode.js";
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
export declare const AREA_KIND = "area";
export declare const AREA_PROPERTIES: Record<string, string>;
export declare const AREA_MIME = "text/markdown";
export declare const AREA_FILENAME = "area.md";
/** The tint the sheet is drawn in — the paper palette, reused on purpose:
 *  a tint is a background that means nothing (`core/textnode.ts`), and a
 *  second palette would be a second thing to tune per theme. */
export declare const AREA_TINT_PROP = "tint";
/** How tall the title strip is, in world units — the band at the top of the
 *  sheet that says the area's name and is the handle you drag it by. Things
 *  placed `--in` an area start below it. */
export declare const AREA_TITLE_HEIGHT = 56;
/** The band under the title where the card is drawn — what happens here,
 *  in a few lines. Reserved whether or not the sheet has a card, so the
 *  first thing placed on a sheet never lands on the words that say what
 *  the sheet is for (which is exactly what happened before it was). */
export declare const AREA_CARD_HEIGHT = 120;
/** Title and card together: where the sheet's own words end and its
 *  contents begin. */
export declare const AREA_HEAD: number;
/** Inset from the sheet's edge for anything placed inside it. */
export declare const AREA_INSET = 24;
/** A sensible default sheet: room for a row of sketches with a title above. */
export declare const AREA_DEFAULT_SIZE: {
    width: number;
    height: number;
};
export declare function isArea(item: Item): boolean;
/** The tint an area wears, or null for the plain sheet. */
export declare function areaTint(item: Item): Paper | null;
/** The patch that tints an area, or clears its tint. */
export declare function areaTintPatch(tint: Paper | null): {
    properties: Record<string, string>;
} | {
    removeProperties: string[];
};
/** Every area on the canvas, in reading order — left to right, then down. */
export declare function areasOf(canvas: CanvasContents): Item[];
/** The region inside the sheet where things go: under the title, inset. */
export declare function areaInner(area: Item): {
    x: number;
    y: number;
    width: number;
    height: number;
};
/** Is this item in this area — by its centre, and never for an area itself. */
export declare function inArea(area: Item, item: Item): boolean;
/** What is in the area right now, in reading order. */
export declare function itemsIn(canvas: CanvasContents, area: Item): Item[];
/**
 * The area an item is in, or null. When areas overlap, the SMALLEST one
 * wins: a sheet laid inside a bigger sheet is the more specific claim.
 */
export declare function areaOf(canvas: CanvasContents, item: Item): Item | null;
/** An area by exact title, then by case-insensitive prefix — how `--in`
 *  names one. Null when nothing matches; the caller says so. */
export declare function findArea(canvas: CanvasContents, ref: string): Item | null;
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
export declare function freeSpotIn(canvas: CanvasContents, area: Item, width: number, height: number): {
    x: number;
    y: number;
};
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
export declare const AREA_ROWS_PROP = "rows";
export declare const AREA_COLS_PROP = "cols";
export declare const AREA_ROW_NAMES_PROP = "rowNames";
export declare const AREA_COL_NAMES_PROP = "colNames";
export interface AreaGrid {
    rows: number;
    cols: number;
    /** A name per row, in order; shorter than `rows` when some are unnamed. */
    rowNames: string[];
    colNames: string[];
}
/** The grid a sheet carries, or null for a plain sheet. */
export declare function areaGrid(area: Item): AreaGrid | null;
/** The patch that puts a grid on a sheet, or takes it off — one spelling
 *  for both surfaces. Names are stored comma-joined, so a name may not
 *  carry a comma; the CLI says so when one does. */
export declare function gridPatch(grid: {
    rows: number;
    cols: number;
    rowNames?: string[];
    colNames?: string[];
} | null): {
    properties: Record<string, string>;
} | {
    removeProperties: string[];
};
/** The box of one cell, counted from 1 at the top-left. */
export declare function cellBox(area: Item, row: number, col: number): {
    x: number;
    y: number;
    width: number;
    height: number;
};
/** Which cell an item's centre is in, or null when off the grid. */
export declare function cellOf(area: Item, item: Item): {
    row: number;
    col: number;
} | null;
/** The first clear spot inside one cell, for a thing of this size. A cell
 *  too small or too full answers its own corner, like a sheet does. */
export declare function cellSpot(canvas: CanvasContents, area: Item, row: number, col: number, width: number, height: number): {
    x: number;
    y: number;
};
