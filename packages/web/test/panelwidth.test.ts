import { describe, expect, it } from "vitest";
import { PANEL_MIN_WIDTH, clampPanelWidth, maxPanelWidth } from "../src/stores/uiStore.ts";

/**
 * The docked panel's width: draggable, remembered, and never able to strand
 * either the panel or the canvas.
 *
 * The old fixed 320 is the FLOOR now rather than the only value — narrower and
 * the composer's selection chips wrap one per line, so it is a real constraint.
 */
describe("how wide the panel may be", () => {
  const WINDOW = 1440;

  it("never goes below the width it used to be fixed at", () => {
    expect(clampPanelWidth(10, WINDOW)).toBe(PANEL_MIN_WIDTH);
    expect(clampPanelWidth(-500, WINDOW)).toBe(PANEL_MIN_WIDTH);
    expect(clampPanelWidth(PANEL_MIN_WIDTH - 1, WINDOW)).toBe(PANEL_MIN_WIDTH);
  });

  it("leaves the canvas something to be a canvas with", () => {
    const wide = clampPanelWidth(99_999, WINDOW);
    expect(wide).toBeLessThan(WINDOW);
    expect(WINDOW - wide).toBeGreaterThanOrEqual(300);
  });

  it("passes through the widths somebody actually drags to", () => {
    for (const width of [321, 400, 560, 800]) {
      expect(clampPanelWidth(width, WINDOW)).toBe(width);
    }
  });

  it("rounds, because a width is device pixels and a drag is not", () => {
    expect(clampPanelWidth(432.6, WINDOW)).toBe(433);
  });

  /**
   * **A window that measures zero has not been measured.**
   *
   * Found by driving the drag from an automation tab: a hidden or backgrounded
   * tab reports `innerWidth: 0`, and so does a frame before layout. Taken at
   * face value it clamps the panel to its floor — and because the same clamp
   * feeds the setter that PERSISTS, it would write the floor over the width the
   * person had chosen. A preference destroyed by a tab being in the background
   * is a bug you would only ever notice afterwards, with nothing to point at.
   */
  it("treats an unmeasurable window as no ceiling, not as no room", () => {
    for (const bad of [0, -1, Number.NaN]) {
      expect(maxPanelWidth(bad), `window ${bad}`).toBe(Number.POSITIVE_INFINITY);
      expect(clampPanelWidth(720, bad), `window ${bad} must not shrink a real width`).toBe(720);
    }
  });

  it("still refuses a width that is not a number", () => {
    // The other half of the same idea: a drag whose arithmetic went wrong must
    // land on the floor, not on NaN — which renders as no width at all.
    expect(clampPanelWidth(Number.NaN, 1440)).toBe(PANEL_MIN_WIDTH);
  });

  it("gives up the ceiling before the floor on a genuinely tiny window", () => {
    // A phone-width window cannot honour both. The panel keeps its floor and
    // the canvas loses — which is the right way round, because the panel is
    // what you opened.
    expect(clampPanelWidth(400, 500)).toBe(400);
    expect(clampPanelWidth(100, 500)).toBe(PANEL_MIN_WIDTH);
  });
});
