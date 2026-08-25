import { describe, expect, it } from "vitest";
import { findNextItem, nearestToPoint, type Rect } from "../src/lib/spatialnav.ts";
import { GLIDE_MS, smoothEase } from "../src/lib/zoomactions.ts";

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

  /**
   * ALL FOUR DIRECTIONS, because the bug was in the rule and the rule has four
   * copies.
   *
   * The fix above was written for Up and tested for Up. Applying the same
   * one-character regression to Down (`node.y > current.y`) and to Left
   * (`node.x + node.width < current.x + current.width`) left the whole web
   * suite green, 178/178 — the identical bug, on three of the four arms of
   * the same switch, invisible.
   *
   * So the case is stated once and run four times. `nudged` is the neighbour
   * that caused it: a box offset by a single pixel in the direction of travel
   * while still overlapping you, which is BESIDE you and never a way out.
   */
  describe("the same rule, on all four arms", () => {
    const box = { id: "here", x: 1000, y: 1000, width: 480, height: 434 };
    const dirs = [
      { dir: "ArrowUp", dx: 0, dy: -1 },
      { dir: "ArrowDown", dx: 0, dy: 1 },
      { dir: "ArrowLeft", dx: -1, dy: 0 },
      { dir: "ArrowRight", dx: 1, dy: 0 },
    ] as const;

    for (const { dir, dx, dy } of dirs) {
      it(`${dir}: a neighbour one pixel that way is beside you, not through you`, () => {
        const nudged = { ...box, id: "nudged", x: box.x + dx, y: box.y + dy };
        expect(findNextItem(box, [box, nudged], dir)).toBeNull();
      });

      it(`${dir}: a neighbour clear of the edge you leave IS reachable`, () => {
        // The negative control. A rule that answers null to everything would
        // pass the case above and be useless.
        const away = {
          ...box,
          id: "away",
          x: box.x + dx * (box.width + 200),
          y: box.y + dy * (box.height + 200),
        };
        expect(findNextItem(box, [box, away], dir)?.id).toBe("away");
      });
    }
  });
});

/**
 * The score, whose two halves were only ever tested one at a time.
 *
 * `ORTHOGONAL_WEIGHT` is a tuning constant and the docstring makes a claim
 * about it — sideways drift costs "~2.5×", which "keeps a walk inside its own
 * lane". Setting it to 1 changed nothing anywhere in the suite. A constant no
 * test can see is a constant anybody may edit.
 *
 * A single number cannot be pinned by one assertion without freezing it, so it
 * is BRACKETED: one case that only passes if the weight is above 1, one that
 * only passes if it is below 9. That leaves room to tune and no room to
 * delete.
 */
describe("what sideways drift costs", () => {
  const from = { id: "from", x: 0, y: 0, width: 100, height: 100 };

  it("is more than nothing: an aligned item beats a nearer one out of the lane", () => {
    // aligned: 300 away, no drift.  drifting: 100 away, 100 of drift.
    // Weight 1 would pick the drifting one (200 < 300); 2.5 picks the lane.
    const aligned = { id: "aligned", x: 400, y: 0, width: 100, height: 100 };
    const drifting = { id: "drifting", x: 200, y: 200, width: 100, height: 100 };
    expect(findNextItem(from, [aligned, drifting], "ArrowRight")?.id).toBe("aligned");
  });

  it("is not everything: a moderate drift still beats a much longer walk", () => {
    // near: 100 along, 100 of drift  ->  100 + 100w.
    // far:  400 along, no drift      ->  400.
    // The near one wins while w <= 3 (at exactly 3 the scores tie and the
    // first listed takes it) and loses above that. With the case above, which
    // needs w > 2, the pair brackets the constant into 2 < w <= 3 — room to
    // tune, none to delete.
    const near = { id: "near", x: 200, y: 200, width: 100, height: 100 };
    const far = { id: "far", x: 500, y: 0, width: 100, height: 100 };
    expect(findNextItem(from, [near, far], "ArrowRight")?.id).toBe("near");
  });

  /**
   * Overlap is FREE, and free is a floor. Deleting the `return 0` leaves
   * `aStart - bEnd`, which is negative for an overlapping pair — so a big
   * item far away that happens to straddle your row scores better than the
   * one beside you, and the further it straddles the better it does.
   */
  it("never pays you to overlap: a straddling item far away does not win", () => {
    // The straddler is 1900px away and 3000px tall, so a scheme that PAID for
    // overlap would score it at -2100 against `beside`'s honest 100 — and the
    // taller it got, the better it would look.
    const beside = { id: "beside", x: 200, y: 0, width: 100, height: 100 };
    const straddling = { id: "straddling", x: 2000, y: -1400, width: 100, height: 3000 };
    expect(findNextItem(from, [beside, straddling], "ArrowRight")?.id).toBe("beside");
  });

  /**
   * Two candidates that score identically must resolve the same way every
   * time: pressing the same arrow twice from the same place is one gesture a
   * person repeats, and "whichever the loop saw last" is not an answer that
   * survives a reordered roster.
   */
  it("breaks an exact tie by taking the first, so the walk is repeatable", () => {
    const one = { id: "one", x: 300, y: 0, width: 100, height: 100 };
    const two = { id: "two", x: 300, y: 0, width: 100, height: 100 };
    expect(findNextItem(from, [one, two], "ArrowRight")?.id).toBe("one");
    expect(findNextItem(from, [two, one], "ArrowRight")?.id).toBe("two");
  });
});

/**
 * `nearestToPoint` is where a walk STARTS — the item nearest the middle of the
 * viewport when nothing is selected. It measures centre to centre, and
 * measuring from the top-left corner instead passed every case above, because
 * every fixture in this file is the same size. A canvas is not: a full-bleed
 * screen and a sticky note have corners in wildly different places from their
 * middles, and the corner answer is the wrong item.
 */
describe("where a walk starts", () => {
  it("measures from the middle of an item, not its corner", () => {
    const huge = { id: "huge", x: 480, y: 480, width: 2000, height: 2000 };
    const small = { id: "small", x: 400, y: 400, width: 200, height: 200 };
    // `huge`'s corner is 28px from the point; its middle is 1386px away.
    // `small` is centred on the point exactly.
    expect(nearestToPoint([huge, small], 500, 500)?.id).toBe("small");
  });
});

describe("node travel glide transition", () => {
  it("defaults to 500ms duration", () => {
    expect(GLIDE_MS).toBe(500);
  });

  it("smoothEase provides a continuous smooth acceleration and deceleration curve", () => {
    expect(smoothEase(0)).toBe(0);
    expect(smoothEase(1)).toBe(1);
    expect(smoothEase(0.5)).toBe(0.5);
    // starts gentle (below linear progress)
    expect(smoothEase(0.2)).toBeLessThan(0.2);
    // ends gentle (above linear progress)
    expect(smoothEase(0.8)).toBeGreaterThan(0.8);
  });
});

