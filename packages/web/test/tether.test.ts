import { describe, expect, it } from "vitest";
import type { Item } from "@isocan/core";
import { TETHER_MAX_RISE, TETHER_MAX_RUN, tetherFor } from "../src/lib/tether.ts";

/**
 * **Every rule here is a reason NOT to draw.**
 *
 * The costs are asymmetric. A tether that is missing costs a nicety. A tether
 * pointing at the wrong thing — off the edge, or across a screen at something
 * that happens to be in the way — costs the reader's trust in every other one
 * on the canvas, including the correct ones. So the honest default is no line.
 */
const view = { tx: 0, ty: 0, scale: 1 };
const screen = { left: 0, top: 0, right: 1000, bottom: 800 };
const item = (over: Partial<Item> = {}): Item =>
  ({ id: "itm_a", x: 400, y: 300, width: 200, height: 100, ...over }) as Item;

describe("a tether is drawn only when it can be followed", () => {
  it("joins a chip to the near edge of the item, vertically centred", () => {
    const t = tetherFor({ x: 300, y: 350 }, item(), view, screen);
    // The LEFT edge, not the middle: the line ends where the thing begins,
    // rather than plunging into it and appearing to point past it.
    expect(t).toEqual({ itemId: "itm_a", x1: 300, y1: 350, x2: 400, y2: 350 });
  });

  it("refuses an item that is off screen", () => {
    // A line to something two screens away points off the edge, and worse,
    // points at whatever happens to be at the edge instead.
    expect(tetherFor({ x: 300, y: 350 }, item({ x: 4000 }), view, screen)).toBeNull();
    expect(tetherFor({ x: 300, y: 350 }, item({ y: -4000 }), view, screen)).toBeNull();
  });

  it("refuses a climb steeper than it can read as a connection", () => {
    const gentle = tetherFor({ x: 300, y: 350 - TETHER_MAX_RISE }, item(), view, screen);
    expect(gentle).not.toBeNull();
    const steep = tetherFor({ x: 300, y: 350 - TETHER_MAX_RISE - 1 }, item(), view, screen);
    expect(steep, "a steep line reads as a scribble across the canvas").toBeNull();
  });

  it("refuses a run the eye stops tracking", () => {
    // Both chips sit ON the visible edge, so the visible run and the run from
    // the chip are the same number and the limit is being tested rather than
    // the clamp. (This test used to put the chip at x = -1, outside `screen`
    // — which the visible-run rule now correctly counts as 400 and allows.)
    const near = tetherFor({ x: 0, y: 350 }, item({ x: TETHER_MAX_RUN }), view, screen);
    expect(near).not.toBeNull();
    const far = tetherFor({ x: 0, y: 350 }, item({ x: TETHER_MAX_RUN + 1 }), view, screen);
    expect(far).toBeNull();
  });

  it("measures the run from where the line becomes visible, not from the chip", () => {
    /**
     * The chip is inside the rail, so the first stretch of every tether is
     * hidden behind the panel. Measuring from the chip measures mostly
     * invisible line and makes the rule depend on the rail's WIDTH — drag the
     * rail wider and the band where a tether is allowed shrinks to nothing,
     * so somebody who resized a panel would have silently turned the feature
     * off with no way to know why.
     */
    const behindAPanel = { left: 468, top: 0, right: 1000, bottom: 800 };
    // 480px from the chip — beyond the limit — but only 32px of it visible.
    const t = tetherFor({ x: 20, y: 350 }, item({ x: 500 }), view, behindAPanel);
    expect(t, "a short visible line behind a wide rail is still followable").not.toBeNull();
    // And the limit still bites on the visible part.
    const far = tetherFor({ x: 20, y: 350 }, item({ x: 468 + TETHER_MAX_RUN + 1 }), view, behindAPanel);
    expect(far).toBeNull();
  });

  it("refuses to double back behind the chip", () => {
    // An item to the LEFT of the panel would need a line crossing back over
    // the message that made it, which reads as pointing at the message.
    expect(tetherFor({ x: 700, y: 350 }, item({ x: 100 }), view, screen)).toBeNull();
  });

  it("follows the item through a zoom rather than freezing where it was", () => {
    // Screen space, computed from the live viewport. A tether cached in world
    // units would keep one end glued to a panel that does not scale.
    const zoomed = { tx: 0, ty: 0, scale: 0.5 };
    const t = tetherFor({ x: 100, y: 175 }, item(), zoomed, screen);
    expect(t?.x2).toBe(200);
    expect(t?.y2).toBe(175);
  });
});
