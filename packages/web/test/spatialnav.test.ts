import { describe, expect, it } from "vitest";
import { findNextItem, nearestToPoint, type Rect } from "../src/lib/spatialnav.ts";

const at = (id: string, x: number, y: number, width = 100, height = 100): Rect => ({
  id,
  x,
  y,
  width,
  height,
});

// A row of three, with an outlier below-right of the middle one.
const a = at("a", 0, 0);
const b = at("b", 200, 0);
const c = at("c", 400, 0);
const below = at("below", 220, 150);
const row = [a, b, c, below];

describe("findNextItem", () => {
  it("walks the row in both directions", () => {
    expect(findNextItem(a, row, "ArrowRight")?.id).toBe("b");
    expect(findNextItem(b, row, "ArrowRight")?.id).toBe("c");
    expect(findNextItem(c, row, "ArrowLeft")?.id).toBe("b");
  });

  it("stops at the end of the row rather than wrapping", () => {
    expect(findNextItem(c, row, "ArrowRight")).toBeNull();
    expect(findNextItem(a, row, "ArrowLeft")).toBeNull();
  });

  it("prefers the aligned neighbour over a nearer one off to the side", () => {
    // `below` is nearer to b in a straight line than c is (151 vs 200), which
    // is exactly the case center-to-center distance gets wrong: going right
    // should stay in the row.
    expect(Math.hypot(below.x - b.x, below.y - b.y)).toBeLessThan(c.x - b.x);
    expect(findNextItem(b, row, "ArrowRight")?.id).toBe("c");
  });

  it("finds what is below, across the lane", () => {
    expect(findNextItem(b, row, "ArrowDown")?.id).toBe("below");
    expect(findNextItem(below, row, "ArrowUp")?.id).toBe("b");
  });

  it("charges nothing for overlap on the other axis", () => {
    // A tall item that straddles the row: overlapping means no penalty, so it
    // wins over an equally distant item that does not overlap.
    const tall = at("tall", 200, -80, 100, 300);
    const offset = at("offset", 200, 400, 100, 100);
    expect(findNextItem(a, [tall, offset], "ArrowRight")?.id).toBe("tall");
  });

  it("ignores the item it started from", () => {
    expect(findNextItem(a, [a], "ArrowRight")).toBeNull();
  });

  it("has nowhere to go on an empty canvas", () => {
    expect(findNextItem(a, [], "ArrowDown")).toBeNull();
  });

  it("takes the nearest of two equally aligned items", () => {
    expect(findNextItem(a, [c, b], "ArrowRight")?.id).toBe("b");
  });

  it("works from a bounding box that is not itself an item", () => {
    // Multi-select origin: the union of a and b. The caller drops the items it
    // is standing on — they are inside the box, so they are not "to the right"
    // in any sense a person means.
    const union: Rect = { id: "", x: 0, y: 0, width: 300, height: 100 };
    const others = row.filter((r) => r.id !== "a" && r.id !== "b");
    expect(findNextItem(union, others, "ArrowRight")?.id).toBe("c");
  });
});

describe("nearestToPoint", () => {
  it("picks the item whose center is closest", () => {
    expect(nearestToPoint(row, 210, 20)?.id).toBe("b");
    expect(nearestToPoint(row, 1000, 1000)?.id).toBe("below");
  });

  it("is null when there is nothing to pick", () => {
    expect(nearestToPoint([], 0, 0)).toBeNull();
  });
});
