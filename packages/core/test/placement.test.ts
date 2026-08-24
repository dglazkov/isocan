import { describe, expect, it } from "vitest";
import type { CanvasState, Item } from "../src/model.ts";
import { PLACEMENT_CLEARANCE, resolvePlacement } from "../src/placement.ts";

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
