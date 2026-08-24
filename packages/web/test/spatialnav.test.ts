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

/**
 * The one that shipped: Up walked sideways.
 *
 * Two screens side by side, 434px and 433px tall. The rule for "above" used to
 * compare far edges — `node.bottom < current.bottom` — so the neighbour
 * qualified as above by ONE PIXEL, purely for being a pixel shorter. And
 * because it overlapped vertically it scored no distance at all, only its
 * sideways gap, so it beat the screen genuinely above them both.
 *
 * The numbers here are the real ones off the canvas where it was found.
 */
describe("leaving in a direction means clearing the edge you left", () => {
  const above = { id: "above", x: 751, y: 1583, width: 560, height: 720 };
  const here = { id: "here", x: 1311, y: 2651, width: 480, height: 434 };
  const beside = { id: "beside", x: 1871, y: 2651, width: 480, height: 433 };
  const all = [above, here, beside];

  it("goes up to what is actually above, not to a shorter neighbour", () => {
    expect(findNextItem(here, all, "ArrowUp")?.id).toBe("above");
  });

  it("still finds the neighbour when you ask for it sideways", () => {
    expect(findNextItem(here, all, "ArrowRight")?.id).toBe("beside");
  });

  it("treats a same-row neighbour as beside you however its edges fall", () => {
    // Taller as well as shorter: neither is a way out upward.
    const taller = { id: "taller", x: 1871, y: 2651, width: 480, height: 900 };
    expect(findNextItem(here, [here, taller], "ArrowUp")).toBeNull();
    expect(findNextItem(here, [here, taller], "ArrowDown")).toBeNull();
  });

  it("will not leave into something it overlaps", () => {
    // A big item sitting partly over this one is not up, down, left or right.
    const straddling = { id: "straddling", x: 1200, y: 2400, width: 700, height: 500 };
    for (const dir of ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"] as const) {
      expect(findNextItem(here, [here, straddling], dir), dir).toBeNull();
    }
  });

  it("has nowhere up to go when everything is level with it", () => {
    expect(findNextItem(here, [here, beside], "ArrowUp")).toBeNull();
  });
});
