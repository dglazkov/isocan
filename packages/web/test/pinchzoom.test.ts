import { describe, expect, it } from "vitest";
import { pinchFactor } from "../src/lib/viewport.ts";

/**
 * **A trackpad pinch zooms like Figma** (8 Oct 2026, "part of it is how MUCH
 * it zooms"). The rate is tldraw's and Excalidraw's; the cap keeps a ⌃-held
 * mouse wheel, ~100 a notch, from tripling the zoom in one click.
 */
describe("one pinch event's zoom", () => {
  it("zooms in for a negative delta and out for a positive one, symmetrically", () => {
    expect(pinchFactor(-4)).toBeGreaterThan(1);
    expect(pinchFactor(4)).toBeLessThan(1);
    expect(pinchFactor(-4) * pinchFactor(4)).toBeCloseTo(1, 10);
  });

  it("is twice the old rate: a typical pinch of 100 px of deltas zooms about 3×", () => {
    let factor = 1;
    for (let i = 0; i < 25; i++) factor *= pinchFactor(-4);
    expect(factor).toBeGreaterThan(2.9);
    expect(factor).toBeLessThan(3.1);
  });

  it("caps one event, so a ⌃ mouse-wheel notch is a step, not a leap", () => {
    expect(pinchFactor(-100)).toBe(pinchFactor(-40));
    expect(pinchFactor(-100)).toBeLessThan(1.6);
  });

  it("reads Firefox's lines as 16 px each", () => {
    expect(pinchFactor(-1, 1)).toBeCloseTo(pinchFactor(-16), 10);
  });
});
