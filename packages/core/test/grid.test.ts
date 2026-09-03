import { describe, expect, it } from "vitest";
import type { CanvasContents, Item } from "../src/model.ts";
import {
  AREA_HEAD,
  AREA_INSET,
  AREA_PROPERTIES,
  areaGrid,
  areaInner,
  cellBox,
  cellOf,
  cellSpot,
  gridPatch,
} from "../src/area.ts";

/**
 * **A grid on a sheet** (sprint phase 5): four properties, cells that are
 * geometry, counted from 1 at the top-left.
 */
const item = (id: string, x: number, y: number, width: number, height: number, props: Record<string, string> = {}): Item =>
  ({ id, title: id, x, y, width, height, properties: props, versions: [], currentVersionId: "" }) as unknown as Item;

const sheet = (props: Record<string, string> = {}): Item =>
  item("sheet", 1000, 1000, 1000 + AREA_INSET * 2, 500 + AREA_HEAD + AREA_INSET, { ...AREA_PROPERTIES, ...props });

const canvasOf = (...items: Item[]): CanvasContents =>
  ({ items: Object.fromEntries(items.map((one) => [one.id, one])), threads: {}, trash: [] }) as unknown as CanvasContents;

describe("the grid is four properties", () => {
  it("round-trips through the patch, names included", () => {
    const patch = gridPatch({ rows: 2, cols: 3, rowNames: ["Ana", "Ben"], colNames: ["one", "two"] });
    expect("properties" in patch).toBe(true);
    const laid = sheet((patch as { properties: Record<string, string> }).properties);
    expect(areaGrid(laid)).toEqual({ rows: 2, cols: 3, rowNames: ["Ana", "Ben"], colNames: ["one", "two"] });
    expect(gridPatch(null)).toEqual({ removeProperties: ["rows", "cols", "rowNames", "colNames"] });
  });

  it("is null for a plain sheet, and for nonsense", () => {
    expect(areaGrid(sheet())).toBeNull();
    expect(areaGrid(sheet({ rows: "0", cols: "3" }))).toBeNull();
    expect(areaGrid(sheet({ rows: "two", cols: "3" }))).toBeNull();
  });
});

describe("a cell is geometry, from 1 at the top-left", () => {
  const laid = sheet((gridPatch({ rows: 2, cols: 4 }) as { properties: Record<string, string> }).properties);
  const inner = areaInner(laid); // 1000 wide, 500 tall

  it("divides the inner region evenly", () => {
    expect(cellBox(laid, 1, 1)).toEqual({ x: inner.x, y: inner.y, width: 250, height: 250 });
    expect(cellBox(laid, 2, 4)).toEqual({ x: inner.x + 750, y: inner.y + 250, width: 250, height: 250 });
  });

  it("refuses a cell off the grid, saying what the grid is", () => {
    expect(() => cellBox(laid, 3, 1)).toThrow("2×4");
    expect(() => cellBox(laid, 0, 1)).toThrow();
    expect(() => cellBox(sheet(), 1, 1)).toThrow("no grid");
  });

  it("answers which cell an item's centre is in", () => {
    const inCell = item("n", inner.x + 300, inner.y + 300, 100, 100);
    expect(cellOf(laid, inCell)).toEqual({ row: 2, col: 2 });
    const outside = item("o", 5000, 5000, 100, 100);
    expect(cellOf(laid, outside)).toBeNull();
    expect(cellOf(sheet(), inCell)).toBeNull();
  });

  it("finds a clear spot inside a cell, and stays in it when the cell is busy", () => {
    const first = cellSpot(canvasOf(laid), laid, 1, 2, 100, 100);
    const cell = cellBox(laid, 1, 2);
    expect(first.x).toBeGreaterThanOrEqual(cell.x);
    expect(first.y).toBeGreaterThanOrEqual(cell.y);
    const placed = item("p", first.x, first.y, 100, 100);
    const second = cellSpot(canvasOf(laid, placed), laid, 1, 2, 100, 100);
    expect(second).not.toEqual(first);
    expect(cellOf(laid, item("q", second.x, second.y, 100, 100))).toEqual({ row: 1, col: 2 });
  });
});
