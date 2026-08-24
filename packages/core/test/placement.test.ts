import { describe, expect, it } from "vitest";
import type { CanvasState, Item } from "../src/model.ts";
import {
  nearestFreeSpot,
  PLACEMENT_CLEARANCE,
  PLACEMENT_GAP,
  resolvePlacement,
} from "../src/placement.ts";

/**
 * New items ask for a spot; they do not claim one.
 *
 * Dropping six files put six items in one pile, because every one of them
 * resolved to the same coordinates — an anchored placement always lands left
 * of its anchor, and six files shared one anchor. The fix belongs here rather
 * than in either client: one resolver, inside the reducer, so the CLI and the
 * web app cannot disagree about where a thing went.
 */

const item = (id: string, x: number, y: number, width = 100, height = 100): Item =>
  ({ id, x, y, width, height, title: id, properties: {} }) as unknown as Item;

const canvasOf = (...items: Item[]): CanvasState =>
  ({ items: Object.fromEntries(items.map((i) => [i.id, i])), trash: [] }) as unknown as CanvasState;

describe("placing a new item", () => {
  it("honours a free spot exactly", () => {
    const canvas = canvasOf(item("a", 0, 0));
    expect(resolvePlacement(canvas, { x: 900, y: 900 }, 100, 100)).toEqual({ x: 900, y: 900 });
  });

  it("lands at the asked-for spot on an empty canvas", () => {
    expect(resolvePlacement(canvasOf(), { x: 0, y: 0 }, 100, 100)).toEqual({ x: 0, y: 0 });
  });

  it("moves off something already there", () => {
    const canvas = canvasOf(item("a", 0, 0));
    const at = resolvePlacement(canvas, { x: 0, y: 0 }, 100, 100);
    expect(at).not.toEqual({ x: 0, y: 0 });
    // Clear of it, by more than the clearance.
    expect(Math.abs(at.x) >= 100 + PLACEMENT_CLEARANCE || Math.abs(at.y) >= 100 + PLACEMENT_CLEARANCE).toBe(true);
  });

  it("never overlaps, however many arrive at one spot", () => {
    // The reported bug: a batch that all resolves to the same coordinates.
    let canvas = canvasOf();
    const placed: { x: number; y: number; width: number; height: number }[] = [];
    for (let i = 0; i < 8; i++) {
      const at = resolvePlacement(canvas, { x: 0, y: 0 }, 120, 90);
      placed.push({ ...at, width: 120, height: 90 });
      canvas = canvasOf(...placed.map((p, n) => item(`i${n}`, p.x, p.y, p.width, p.height)));
    }
    for (let a = 0; a < placed.length; a++) {
      for (let b = a + 1; b < placed.length; b++) {
        const [p, q] = [placed[a]!, placed[b]!];
        const apart =
          p.x + p.width <= q.x || q.x + q.width <= p.x || p.y + p.height <= q.y || q.y + q.height <= p.y;
        expect(apart, `${a} and ${b} overlap`).toBe(true);
      }
    }
  });

  it("puts an anchored item beside its anchor, not on it", () => {
    const canvas = canvasOf(item("a", 500, 500, 200, 200));
    const at = resolvePlacement(canvas, { anchorItemId: "a" }, 100, 100);
    expect(at.x + 100).toBeLessThanOrEqual(500);
  });

  it("throws on an anchor that is not there", () => {
    expect(() => resolvePlacement(canvasOf(), { anchorItemId: "gone" }, 100, 100)).toThrow();
  });

  /**
   * The exception, and the reason `exact` exists. Ink is where the pen drew it
   * and an annotation sits over the thing it is about: tidying either one away
   * from its position destroys its meaning. Placing a stroke "neatly" beside
   * the screen it marks up would be a worse bug than the pile it fixes.
   */
  it("leaves a position that means something exactly where it is", () => {
    const canvas = canvasOf(item("screen", 0, 0, 400, 300));
    const over = resolvePlacement(canvas, { x: 40, y: 40 }, 120, 90, true);
    expect(over).toEqual({ x: 40, y: 40 });
  });

  it("still resolves an anchor when exact", () => {
    const canvas = canvasOf(item("a", 500, 500, 200, 200));
    expect(resolvePlacement(canvas, { anchorItemId: "a" }, 100, 100, true)).toEqual({ x: 360, y: 500 });
  });
});

/**
 * A collision is a collision on EITHER axis.
 *
 * Every case above collides along x, because the tie-break sends a displaced
 * item to the right and a canvas of same-sized items therefore lays itself out
 * as a row. So `overlaps()` was only ever exercised horizontally: replacing
 * its whole y test with `a.y === b.y` — two boxes are only ever above each
 * other if their tops are identical, so a box one pixel lower is "clear" —
 * left the entire core suite green (340/340).
 *
 * That matters more than it looks, because this function is no longer only a
 * convenience: `item.add` resolves through it inside the reducer, so where a
 * dropped file lands is part of replay. A half-blind overlap test is a canvas
 * that rebuilds differently from the log.
 */
describe("overlap is symmetric", () => {
  const size = 100;
  // Offsets that genuinely overlap a 100x100 box at the origin, one per
  // direction, chosen so that neither coordinate is shared with it: an
  // axis-blind comparison lets every one of them through.
  const overlapping = [
    { name: "below", x: 10, y: 50 },
    { name: "above", x: 10, y: -50 },
    { name: "right", x: 50, y: 10 },
    { name: "left", x: -50, y: 10 },
  ];

  for (const near of overlapping) {
    it(`moves off a neighbour ${near.name} of the asked-for spot`, () => {
      const canvas = canvasOf(item("there", near.x, near.y, size, size));
      const at = resolvePlacement(canvas, { x: 0, y: 0 }, size, size);
      const apart =
        at.x + size <= near.x || near.x + size <= at.x || at.y + size <= near.y || near.y + size <= at.y;
      expect(apart, `landed at ${at.x},${at.y} on top of ${near.x},${near.y}`).toBe(true);
    });
  }

  /**
   * The clearance is a real number, not a rounding allowance: two items 6px
   * apart do not overlap by any arithmetic and still read as a mistake. So a
   * gap smaller than PLACEMENT_CLEARANCE has to count as occupied — dropping
   * the constant to 0 is otherwise invisible.
   */
  it("treats a gap narrower than the clearance as occupied", () => {
    // A LITERAL, not `PLACEMENT_CLEARANCE - 6`. Deriving the fixture from the
    // constant under test makes the test move with it: dropping the clearance
    // to 0 moved this neighbour to 6px of overlap and the case passed for the
    // wrong reason. Six pixels apart is the thing a person calls a pile, and
    // it stays six pixels whatever the constant says.
    const SIX = 6;
    expect(PLACEMENT_CLEARANCE).toBeGreaterThan(SIX);
    const snug = size + SIX;
    for (const [dx, dy] of [
      [snug, 0],
      [0, snug],
      [-snug, 0],
      [0, -snug],
    ] as const) {
      const canvas = canvasOf(item("there", dx, dy, size, size));
      expect(resolvePlacement(canvas, { x: 0, y: 0 }, size, size), `${dx},${dy}`).not.toEqual({
        x: 0,
        y: 0,
      });
    }
  });
});

/**
 * Where the search puts things, not merely that it puts them somewhere.
 *
 * The docstring promises three specific things — a lattice of the item's own
 * size PLUS the gap, the NEAREST free cell, and ties broken right-before-down
 * — and none of the three was checked. Three separate mutations (dropping the
 * gap from the step, flattening the distance sort, reversing the tie order)
 * all survived the suite, which means "it moved somewhere" was the whole of
 * what was being asserted.
 *
 * It is worth pinning exactly because it is arbitrary: the value of a
 * deterministic layout is that two clients agree, and nothing agrees with a
 * rule nobody wrote down.
 */
describe("where a displaced item goes", () => {
  const w = 120;
  const h = 90;

  it("steps one lattice cell to the RIGHT first", () => {
    const canvas = canvasOf(item("a", 0, 0, w, h));
    expect(resolvePlacement(canvas, { x: 0, y: 0 }, w, h)).toEqual({ x: w + PLACEMENT_GAP, y: 0 });
  });

  it("goes DOWN when the cell to the right is taken, not further right", () => {
    // The nearest free cell is the one below; a search that ignored distance,
    // or ranked up before down, would answer somewhere else.
    const canvas = canvasOf(item("a", 0, 0, w, h), item("b", w + PLACEMENT_GAP, 0, w, h));
    expect(resolvePlacement(canvas, { x: 0, y: 0 }, w, h)).toEqual({ x: 0, y: h + PLACEMENT_GAP });
  });

  it("lands on the lattice, so a batch lines up instead of scattering", () => {
    let canvas = canvasOf();
    const placed: { x: number; y: number; width: number; height: number }[] = [];
    for (let i = 0; i < 9; i++) {
      const at = resolvePlacement(canvas, { x: 0, y: 0 }, w, h);
      placed.push({ ...at, width: w, height: h });
      canvas = canvasOf(...placed.map((p, n) => item(`i${n}`, p.x, p.y, p.width, p.height)));
    }
    for (const p of placed) {
      expect(p.x % (w + PLACEMENT_GAP) === 0, `x=${p.x} is off the lattice`).toBe(true);
      expect(p.y % (h + PLACEMENT_GAP) === 0, `y=${p.y} is off the lattice`).toBe(true);
    }
  });

  /**
   * The last resort, which no ordinary test reaches: the search gives up after
   * MAX_RINGS and goes round the right-hand side, level with where it was
   * asked for. Reached here by filling every cell it would look at, which is
   * also the only place the "a thousand items" edge gets exercised.
   */
  it("goes round the side of a canvas dense enough to defeat the search", () => {
    const rings = 14; // MAX_RINGS, private to the module
    const stepX = w + PLACEMENT_GAP;
    const stepY = h + PLACEMENT_GAP;
    const want = { x: 1000, y: 500, width: w, height: h };
    const occupied = [];
    for (let dx = -rings; dx <= rings; dx++) {
      for (let dy = -rings; dy <= rings; dy++) {
        occupied.push({ x: want.x + dx * stepX, y: want.y + dy * stepY, width: w, height: h });
      }
    }
    expect(occupied).toHaveLength(29 * 29);
    const right = Math.max(...occupied.map((o) => o.x + o.width));
    expect(nearestFreeSpot(want, occupied)).toEqual({ x: right + PLACEMENT_GAP, y: want.y });
  });
});
