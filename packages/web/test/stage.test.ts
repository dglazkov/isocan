import { describe, expect, it } from "vitest";
import { fitInto, worldToScreen } from "../src/lib/viewport.ts";

/**
 * Fitting has to aim at the part of the window the canvas actually has. The
 * bug this covers: fit into the right WIDTH but draw from x=0, and the left
 * edge of everything lands underneath the panel you were reading.
 */
const WINDOW = { w: 1440, h: 900 };
const withPanel = { x: 320, y: 48, width: WINDOW.w - 320, height: WINDOW.h - 48 };
const bare = { x: 0, y: 48, width: WINDOW.w, height: WINDOW.h - 48 };

/** Where the box's corners land on screen. */
function onScreen(box: { minX: number; minY: number; maxX: number; maxY: number }, stage: typeof bare) {
  const v = fitInto(box, stage);
  const tl = worldToScreen(v, box.minX, box.minY);
  const br = worldToScreen(v, box.maxX, box.maxY);
  return { left: tl.x, top: tl.y, right: br.x, bottom: br.y, scale: v.scale };
}

describe("fitting into the visible canvas", () => {
  const small = { minX: 0, minY: 0, maxX: 800, maxY: 400 };

  it("keeps everything clear of the panel", () => {
    const at = onScreen(small, withPanel);
    expect(at.left).toBeGreaterThanOrEqual(withPanel.x);
    expect(at.right).toBeLessThanOrEqual(withPanel.x + withPanel.width);
  });

  it("clears the top bar too", () => {
    expect(onScreen(small, withPanel).top).toBeGreaterThanOrEqual(withPanel.y);
  });

  it("centres in the stage, not in the window", () => {
    const at = onScreen(small, withPanel);
    const leftGap = at.left - withPanel.x;
    const rightGap = withPanel.x + withPanel.width - at.right;
    expect(Math.abs(leftGap - rightGap)).toBeLessThan(1);
  });

  it("uses the whole window when nothing is docked", () => {
    const at = onScreen(small, bare);
    expect(at.left).toBeGreaterThanOrEqual(0);
    expect(Math.abs(at.left - (WINDOW.w - at.right))).toBeLessThan(1);
  });

  it("scales down for a panel — the same box gets less room", () => {
    expect(onScreen(small, withPanel).scale).toBeLessThan(onScreen(small, bare).scale);
  });

  it("still centres what is too big to fit, so it spills evenly", () => {
    // A canvas larger than the screen at minimum zoom cannot be fully
    // visible; what it must not do is hide one side and not the other.
    const huge = { minX: 0, minY: 0, maxX: 400000, maxY: 400000 };
    const at = onScreen(huge, withPanel);
    const leftSpill = withPanel.x - at.left;
    const rightSpill = at.right - (withPanel.x + withPanel.width);
    expect(Math.abs(leftSpill - rightSpill)).toBeLessThan(1);
  });
});
