import { describe, expect, it } from "vitest";
import type { CanvasContents, Item } from "../src/model.ts";
import { fitMoves } from "../src/fit.ts";

/**
 * Items arrive capped — an image at 480 wide, an HTML screen at 420x320
 * however it was designed — so a screen sits on the canvas showing a corner of
 * itself. Growing one is easy; growing six is not, because each expands into
 * where its neighbours are.
 */
const item = (id: string, x: number, y: number, width = 420, height = 320): Item =>
  ({ id, x, y, width, height, title: id, properties: {} }) as unknown as Item;
const canvasOf = (...items: Item[]): CanvasContents =>
  ({ items: Object.fromEntries(items.map((i) => [i.id, i])), trash: [] }) as unknown as CanvasContents;

const rects = (canvas: CanvasContents, r: ReturnType<typeof fitMoves>) => {
  const out = Object.values(canvas.items).map((i) => ({ ...i }));
  for (const z of r.resizes) {
    const found = out.find((i) => i.id === z.itemId)!;
    found.width = z.width;
    found.height = z.height;
  }
  for (const m of r.moves) {
    const found = out.find((i) => i.id === m.itemId)!;
    found.x = m.x;
    found.y = m.y;
  }
  return out;
};
const overlapping = (boxes: { x: number; y: number; width: number; height: number }[]) => {
  let n = 0;
  for (let a = 0; a < boxes.length; a++)
    for (let b = a + 1; b < boxes.length; b++) {
      const [p, q] = [boxes[a]!, boxes[b]!];
      if (p.x < q.x + q.width && q.x < p.x + p.width && p.y < q.y + q.height && q.y < p.y + p.height) n++;
    }
  return n;
};

describe("fitting items to their content", () => {
  it("grows one item and leaves it where it is", () => {
    const canvas = canvasOf(item("a", 100, 100));
    const r = fitMoves(canvas, [{ itemId: "a", width: 1280, height: 800 }]);
    expect(r.resizes).toEqual([{ itemId: "a", width: 1280, height: 800 }]);
    expect(r.moves).toEqual([]);
  });

  it("grows a row without letting them collide", () => {
    // Three screens side by side at their capped size, each wanting 1280.
    const canvas = canvasOf(item("a", 0, 0), item("b", 500, 0), item("c", 1000, 0));
    const r = fitMoves(
      canvas,
      ["a", "b", "c"].map((itemId) => ({ itemId, width: 1280, height: 800 })),
    );
    expect(overlapping(rects(canvas, r))).toBe(0);
  });

  it("anchors on the first in reading order, so the group does not drift", () => {
    const canvas = canvasOf(item("far", 900, 900), item("near", 100, 100));
    const r = fitMoves(canvas, [
      { itemId: "far", width: 1280, height: 800 },
      { itemId: "near", width: 1280, height: 800 },
    ]);
    // `near` is first by reading order and keeps its exact position.
    expect(r.moves.find((m) => m.itemId === "near")).toBeUndefined();
  });

  it("keeps clear of items that are not being fitted", () => {
    const canvas = canvasOf(item("grow", 0, 0), item("bystander", 600, 0, 300, 300));
    const r = fitMoves(canvas, [{ itemId: "grow", width: 1280, height: 800 }]);
    expect(overlapping(rects(canvas, r))).toBe(0);
    // The bystander is never moved: it was not asked to change.
    expect(r.moves.some((m) => m.itemId === "bystander")).toBe(false);
  });

  it("says nothing about an item that is already the right size", () => {
    const canvas = canvasOf(item("a", 0, 0, 1280, 800));
    expect(fitMoves(canvas, [{ itemId: "a", width: 1280, height: 800 }])).toEqual({
      resizes: [],
      moves: [],
    });
  });

  it("ignores an item that is not on the canvas", () => {
    expect(fitMoves(canvasOf(), [{ itemId: "ghost", width: 100, height: 100 }])).toEqual({
      resizes: [],
      moves: [],
    });
  });

  /**
   * Both dimensions, separately.
   *
   * `if (item.width !== t.width || item.height !== t.height)` reads as
   * obviously right and was never exercised on one axis at a time: every case
   * above changes BOTH, so dropping either half of the condition left the
   * suite green. A screen that is the right width and too short is the
   * ordinary case for a page that grew a paragraph, and dropping its resize
   * would be silent — `fitMoves` returning nothing is indistinguishable from
   * nothing needing to change.
   */
  it("resizes an item that is only the wrong height", () => {
    const canvas = canvasOf(item("a", 0, 0, 420, 320));
    const r = fitMoves(canvas, [{ itemId: "a", width: 420, height: 900 }]);
    expect(r.resizes).toEqual([{ itemId: "a", width: 420, height: 900 }]);
  });

  it("resizes an item that is only the wrong width", () => {
    const canvas = canvasOf(item("a", 0, 0, 420, 320));
    const r = fitMoves(canvas, [{ itemId: "a", width: 1280, height: 320 }]);
    expect(r.resizes).toEqual([{ itemId: "a", width: 1280, height: 320 }]);
  });

  /**
   * ORDER IS THE DESIGN, and the design is READING order — down the page
   * first, then across. The existing case ("anchors on the first in reading
   * order") uses a corner-to-corner pair where both sorts agree, so swapping
   * the comparators to x-then-y survived it. These two items disagree: `top`
   * is higher, `left` is further left, and only one of them may keep its
   * position.
   */
  it("settles the topmost first, not the leftmost", () => {
    const canvas = canvasOf(item("top", 300, 0), item("left", 0, 500));
    const r = fitMoves(canvas, [
      { itemId: "top", width: 1280, height: 800 },
      { itemId: "left", width: 1280, height: 800 },
    ]);
    expect(overlapping(rects(canvas, r))).toBe(0);
    // `top` picks first because it is higher up the page, so it stays put and
    // `left` is the one that gives way.
    expect(r.moves.map((m) => m.itemId)).toEqual(["left"]);
  });
});
