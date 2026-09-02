import { describe, expect, it } from "vitest";
import type { CanvasContents, Item } from "../src/model.ts";
import {
  AREA_INSET,
  AREA_PROPERTIES,
  AREA_TITLE_HEIGHT,
  areaInner,
  areaOf,
  areasOf,
  findArea,
  freeSpotIn,
  inArea,
  isArea,
  itemsIn,
} from "../src/area.ts";
import { PLACEMENT_CLEARANCE, nearestFreeSpot } from "../src/placement.ts";

/**
 * An area (`core/area.ts`): a titled sheet things are placed on. An item,
 * not a kind of its own on the wire; membership by geometry, never stored.
 */

const item = (
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  properties: Record<string, string> = {},
  title = id,
): Item =>
  ({
    id,
    x,
    y,
    width,
    height,
    title,
    properties,
    versions: [],
    currentVersionId: "",
    createdAt: "",
    updatedAt: "",
    createdBy: "",
    updatedBy: "",
  }) as unknown as Item;

const area = (id: string, x: number, y: number, width: number, height: number, title = id): Item =>
  item(id, x, y, width, height, { ...AREA_PROPERTIES }, title);

const canvasOf = (...items: Item[]): CanvasContents =>
  ({ items: Object.fromEntries(items.map((one) => [one.id, one])), threads: {}, trash: [] }) as unknown as CanvasContents;

describe("an area is an item wearing kind=area", () => {
  it("is told apart by the property, never by size or shape", () => {
    expect(isArea(area("a", 0, 0, 1600, 1000))).toBe(true);
    expect(isArea(item("big", 0, 0, 1600, 1000))).toBe(false);
    expect(isArea(item("t", 0, 0, 100, 40, { kind: "text" }))).toBe(false);
  });

  it("lists in reading order — left to right, then down", () => {
    const canvas = canvasOf(area("c", 0, 1200, 500, 500), area("b", 600, 0, 500, 500), area("a", 0, 0, 500, 500));
    expect(areasOf(canvas).map((one) => one.id)).toEqual(["a", "c", "b"]);
  });
});

describe("membership is where the centre is", () => {
  const sheet = area("sheet", 100, 100, 1000, 800);

  it("counts an item whose centre is inside, even one straddling the edge", () => {
    expect(inArea(sheet, item("in", 200, 200, 100, 100))).toBe(true);
    // Half over the right edge — its centre (1080) is still inside 1100.
    expect(inArea(sheet, item("edge", 1030, 200, 100, 100))).toBe(true);
    expect(inArea(sheet, item("out", 1060, 200, 100, 100))).toBe(false);
    expect(inArea(sheet, item("far", 2000, 2000, 100, 100))).toBe(false);
  });

  it("never counts an area — sheets do not nest for membership", () => {
    expect(inArea(sheet, area("inner", 200, 200, 300, 300))).toBe(false);
    expect(inArea(sheet, sheet)).toBe(false);
  });

  it("reads the contents in reading order", () => {
    const canvas = canvasOf(
      sheet,
      item("late", 600, 500, 100, 100),
      item("first", 200, 200, 100, 100),
      item("second", 400, 200, 100, 100),
      item("elsewhere", 5000, 5000, 100, 100),
    );
    expect(itemsIn(canvas, sheet).map((one) => one.id)).toEqual(["first", "second", "late"]);
  });

  it("answers the smallest area for an item under two", () => {
    const big = area("big", 0, 0, 3000, 3000);
    const small = area("small", 100, 100, 500, 500);
    const canvas = canvasOf(big, small, item("x", 200, 200, 50, 50), item("y", 2000, 2000, 50, 50));
    expect(areaOf(canvas, canvas.items.x!)?.id).toBe("small");
    expect(areaOf(canvas, canvas.items.y!)?.id).toBe("big");
    expect(areaOf(canvas, item("z", 9000, 9000, 10, 10))).toBeNull();
  });
});

describe("naming an area", () => {
  const canvas = canvasOf(area("a1", 0, 0, 500, 500, "Sketches"), area("a2", 600, 0, 500, 500, "Storyboard"));

  it("takes an id, an exact title, or a case-insensitive prefix", () => {
    expect(findArea(canvas, "a2")?.title).toBe("Storyboard");
    expect(findArea(canvas, "Sketches")?.id).toBe("a1");
    expect(findArea(canvas, "sto")?.id).toBe("a2");
    expect(findArea(canvas, "")).toBeNull();
    expect(findArea(canvas, "Vote")).toBeNull();
  });
});

describe("a spot inside the sheet", () => {
  const sheet = area("sheet", 1000, 1000, 1000, 800);

  it("starts under the title, inset from the edge", () => {
    const inner = areaInner(sheet);
    expect(inner).toEqual({
      x: 1000 + AREA_INSET,
      y: 1000 + AREA_TITLE_HEIGHT,
      width: 1000 - AREA_INSET * 2,
      height: 800 - AREA_TITLE_HEIGHT - AREA_INSET,
    });
    expect(freeSpotIn(canvasOf(sheet), sheet, 200, 200)).toEqual({ x: inner.x, y: inner.y });
  });

  it("steps past what is already there, and stays inside", () => {
    const inner = areaInner(sheet);
    const first = item("first", inner.x, inner.y, 200, 200);
    const spot = freeSpotIn(canvasOf(sheet, first), sheet, 200, 200);
    expect(spot).not.toEqual({ x: inner.x, y: inner.y });
    expect(spot.x).toBeGreaterThanOrEqual(inner.x - PLACEMENT_CLEARANCE);
    expect(spot.x + 200).toBeLessThanOrEqual(inner.x + inner.width + PLACEMENT_CLEARANCE);
    expect(spot.y + 200).toBeLessThanOrEqual(inner.y + inner.height + PLACEMENT_CLEARANCE);
    // The sheet itself is never in the way of its own contents.
    expect(inArea(sheet, { ...first, ...spot })).toBe(true);
  });

  it("answers the sheet's own corner when it is full, never a spot outside", () => {
    // A sheet that holds one thing the size of its whole inner region.
    const inner = areaInner(sheet);
    const filler = item("filler", inner.x, inner.y, inner.width, inner.height);
    const spot = freeSpotIn(canvasOf(sheet, filler), sheet, 300, 300);
    expect(spot).toEqual({ x: inner.x, y: inner.y });
  });
});

describe("nearestFreeSpot confined to a box", () => {
  it("refuses a cell that would poke outside the box", () => {
    const within = { x: 0, y: 0, width: 500, height: 500 };
    const occupied = [{ x: 0, y: 0, width: 200, height: 200 }];
    const spot = nearestFreeSpot({ x: 0, y: 0, width: 200, height: 200 }, occupied, within);
    expect(spot.x + 200).toBeLessThanOrEqual(500);
    expect(spot.y + 200).toBeLessThanOrEqual(500);
    expect(spot).not.toEqual({ x: 0, y: 0 });
  });

  it("is the unconfined search when no box is given", () => {
    const occupied = [{ x: 0, y: 0, width: 200, height: 200 }];
    const free = nearestFreeSpot({ x: 0, y: 0, width: 200, height: 200 }, occupied);
    const confined = nearestFreeSpot({ x: 0, y: 0, width: 200, height: 200 }, occupied, {
      x: -10000,
      y: -10000,
      width: 20000,
      height: 20000,
    });
    expect(confined).toEqual(free);
  });
});
