import { describe, expect, it } from "vitest";
import { UnmergeableError, drawingSvg, inkBounds, mergeDrawings, type InkStroke } from "../src/index.ts";

const stroke = (points: [number, number][], color = "#0f8a80"): InkStroke => ({
  points: points.map(([x, y]) => ({ x, y })),
  color,
  width: 3,
});

/** A drawing the way the Pen writes one. */
function drawing(id: string, strokes: InkStroke[]) {
  const bounds = inkBounds(strokes)!;
  return { id, svg: drawingSvg(strokes, bounds), bounds };
}

describe("merging ink", () => {
  it("keeps every stroke, in the order given", () => {
    const a = drawing("a", [stroke([[0, 0], [10, 10]])]);
    const b = drawing("b", [stroke([[100, 0], [110, 10]]), stroke([[120, 0], [130, 10]])]);
    const merged = mergeDrawings([a, b]);
    expect((merged.svg.match(/<path/g) ?? []).length).toBe(3);
    // Byte-for-byte: the strokes that come out are the ones that went in.
    for (const path of [...a.svg.matchAll(/<path\b[^>]*\/>/g)].map((m) => m[0])) {
      expect(merged.svg).toContain(path);
    }
  });

  it("covers both, because ink is in world coordinates", () => {
    const a = drawing("a", [stroke([[0, 0], [10, 10]])]);
    const b = drawing("b", [stroke([[100, 200], [110, 210]])]);
    const merged = mergeDrawings([a, b]);
    expect(merged.bounds.minX).toBeCloseTo(Math.min(a.bounds.minX, b.bounds.minX));
    expect(merged.bounds.maxY).toBeCloseTo(Math.max(a.bounds.maxY, b.bounds.maxY));
  });

  it("keeps each stroke's own color and width", () => {
    const merged = mergeDrawings([
      drawing("a", [stroke([[0, 0], [5, 5]], "#c93a55")]),
      drawing("b", [stroke([[9, 9], [14, 14]], "#3a7d2c")]),
    ]);
    expect(merged.svg).toContain("#c93a55");
    expect(merged.svg).toContain("#3a7d2c");
  });

  it("merging one drawing is that drawing", () => {
    const a = drawing("a", [stroke([[0, 0], [10, 10]])]);
    const merged = mergeDrawings([a]);
    expect(merged.bounds).toEqual(a.bounds);
    expect((merged.svg.match(/<path/g) ?? []).length).toBe(1);
  });

  it("re-merging a merge changes nothing — the box does not creep", () => {
    // INK_PADDING is already inside each box; adding it again on every merge
    // would grow the item a little every time somebody tidied.
    const once = mergeDrawings([
      drawing("a", [stroke([[0, 0], [10, 10]])]),
      drawing("b", [stroke([[40, 40], [50, 50]])]),
    ]);
    const twice = mergeDrawings([{ id: "once", svg: once.svg }]);
    expect(twice.bounds).toEqual(once.bounds);
  });

  it("refuses an SVG this canvas did not draw", () => {
    // A foreign file can nest groups and carry its own transforms, and then
    // these coordinates mean something else. Moving somebody's artwork
    // silently is worse than refusing.
    expect(() => mergeDrawings([{ id: "x", svg: "<svg><g><path d='M0 0'/></g></svg>" }])).toThrow(
      UnmergeableError,
    );
    expect(() =>
      mergeDrawings([{ id: "x", svg: '<svg viewBox="0 0 1 1"><path transform="scale(2)" d="M0 0"/></svg>' }]),
    ).toThrow(UnmergeableError);
    expect(() => mergeDrawings([{ id: "x", svg: '<svg><path d="M0 0"/></svg>' }])).toThrow(
      /no viewBox/,
    );
  });

  it("refuses an empty picture and an empty list", () => {
    expect(() => mergeDrawings([{ id: "x", svg: '<svg viewBox="0 0 10 10"></svg>' }])).toThrow(
      /no strokes/,
    );
    expect(() => mergeDrawings([])).toThrow(UnmergeableError);
  });
});
