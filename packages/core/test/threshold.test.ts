import { describe, expect, it } from "vitest";
import { accepts, reliability, thresholdFor, thresholdWithMargin, wilson } from "../src/threshold.ts";

const right = (p: number) => ({ p, right: true });

describe("the threshold rule, in core", () => {
  it("is the fast path's rule: the lowest observed cut that keeps ≥ minN at ≥ target", () => {
    expect(thresholdFor(Array.from({ length: 29 }, () => right(0.9)))).toBeNull();
    expect(thresholdFor(Array.from({ length: 30 }, (_, i) => right(0.5 + i / 100)))).toEqual({ cut: 0.5, n: 30, accuracy: 1 });
    expect(reliability([{ p: 0.95, right: false }, { p: 0.95, right: true }]).ece).toBeCloseTo(0.45);
  });

  it("over p and margin, keeps the most cases a qualifying pair allows", () => {
    // 40 confident and right with a wide margin; 20 confident and wrong with a narrow one.
    const pts = [
      ...Array.from({ length: 40 }, () => ({ p: 0.9, margin: 0.8, right: true })),
      ...Array.from({ length: 20 }, () => ({ p: 0.9, margin: 0.1, right: false })),
    ];
    expect(thresholdFor(pts, 0.95, 30)).toBeNull(); // p alone cannot separate them
    const cut = thresholdWithMargin(pts, 0.95, 30);
    expect(cut).toEqual({ p: 0.9, margin: 0.8, n: 40, accuracy: 1 });
    expect(accepts(cut, { p: 0.95, margin: 0.85 })).toBe(true);
    expect(accepts(cut, { p: 0.95, margin: 0.2 })).toBe(false);
    expect(accepts(null, { p: 1, margin: 1 })).toBe(false);
    expect(thresholdWithMargin(pts.slice(0, 10), 0.95, 30)).toBeNull();
  });

  it("puts a Wilson interval around a proportion, inside 0–1", () => {
    const w = wilson(9, 10);
    expect(w.lo).toBeGreaterThan(0.55);
    expect(w.hi).toBeLessThan(1);
    expect(wilson(0, 0)).toEqual({ lo: 0, hi: 1 });
    expect(wilson(10, 10).hi).toBe(1);
  });
});
