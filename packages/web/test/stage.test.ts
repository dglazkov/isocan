import { describe, expect, it } from "vitest";
import { fitInto, revealDelta, worldToScreen } from "../src/lib/viewport.ts";

/**
 * Fitting has to aim at the part of the window the canvas actually has. The
 * bug this covers: fit into the right WIDTH but draw from x=0, and the left
 * edge of everything lands underneath the panel you were reading.
 */
const WINDOW = { w: 1440, h: 900 };
const withPanel = { x: 320, y: 48, width: WINDOW.w - 320 - 76, height: WINDOW.h - 48 };
const bare = { x: 0, y: 48, width: WINDOW.w - 76, height: WINDOW.h - 48 };

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

  it("clears the right tool rail gutter when no panels are docked", () => {
    const at = onScreen(small, bare);
    expect(at.left).toBeGreaterThanOrEqual(0);
    expect(at.right).toBeLessThanOrEqual(WINDOW.w - 76);
    const leftGap = at.left - bare.x;
    const rightGap = bare.x + bare.width - at.right;
    expect(Math.abs(leftGap - rightGap)).toBeLessThan(1);
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

describe("revealing items on the visible stage", () => {
  const stage = withPanel; // x: 320, y: 48, width: 1120, height: 852
  const margin = 76;

  it("does not move when already fully visible inside stage margins", () => {
    const item = { left: 450, top: 150, right: 850, bottom: 450 };
    const { dx, dy } = revealDelta(item, stage, margin);
    expect(dx).toBe(0);
    expect(dy).toBe(0);
  });

  it("slides an item in from under the left panel", () => {
    // Left edge is at 100px (under 320px panel)
    const item = { left: 100, top: 150, right: 500, bottom: 450 };
    const { dx, dy } = revealDelta(item, stage, margin);
    expect(dx).toBe(stage.x + margin - item.left);
    expect(dy).toBe(0);
    expect(item.left + dx).toBe(stage.x + margin);
  });

  it("slides an item in from beyond the right edge/toolbar", () => {
    // Right edge is at 1400px (past stage right edge minus margin: 1440 - 76 = 1364)
    const item = { left: 1000, top: 150, right: 1400, bottom: 450 };
    const { dx, dy } = revealDelta(item, stage, margin);
    const maxX = stage.x + stage.width - margin;
    expect(dx).toBe(maxX - item.right);
    expect(dy).toBe(0);
    expect(item.right + dx).toBe(maxX);
  });

  it("centres an item that is too wide to fit in the stage margins", () => {
    // Item width 1100px > stage.width - 2*margin (1120 - 152 = 968)
    const item = { left: 200, top: 150, right: 1300, bottom: 450 };
    const { dx, dy } = revealDelta(item, stage, margin);
    const stageCenterX = stage.x + stage.width / 2;
    const itemCenterX = (item.left + item.right) / 2;
    expect(dx).toBe(stageCenterX - itemCenterX);
    expect(dy).toBe(0);

    const newLeft = item.left + dx;
    const newRight = item.right + dx;
    const leftGap = newLeft - stage.x;
    const rightGap = stage.x + stage.width - newRight;
    expect(leftGap).toBe(rightGap);
  });

  it("centres an item that is too tall to fit in the stage margins", () => {
    // Item height 800px > stage.height - 2*margin (852 - 152 = 700)
    const item = { left: 450, top: 0, right: 850, bottom: 800 };
    const { dx, dy } = revealDelta(item, stage, margin);
    const stageCenterY = stage.y + stage.height / 2;
    const itemCenterY = (item.top + item.bottom) / 2;
    expect(dy).toBe(stageCenterY - itemCenterY);
    expect(dx).toBe(0);

    const newTop = item.top + dy;
    const newBottom = item.bottom + dy;
    const topGap = newTop - stage.y;
    const bottomGap = stage.y + stage.height - newBottom;
    expect(topGap).toBe(bottomGap);
  });
});

