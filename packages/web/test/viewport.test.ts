import { describe, expect, it } from "vitest";
import {
  fitBounds,
  pan,
  screenToWorld,
  worldToScreen,
  zoomAt,
  type Viewport,
} from "../src/lib/viewport.ts";

describe("viewport math", () => {
  const vp: Viewport = { tx: 100, ty: 50, scale: 2 };

  it("worldToScreen and screenToWorld are inverses", () => {
    const screen = worldToScreen(vp, 30, -40);
    expect(screen).toEqual({ x: 160, y: -30 });
    const world = screenToWorld(vp, screen.x, screen.y);
    expect(world.x).toBeCloseTo(30);
    expect(world.y).toBeCloseTo(-40);
  });

  it("zoomAt keeps the cursor's world point fixed on screen", () => {
    const cursor = { x: 400, y: 300 };
    const before = screenToWorld(vp, cursor.x, cursor.y);
    const zoomed = zoomAt(vp, cursor.x, cursor.y, 1.7);
    const after = screenToWorld(zoomed, cursor.x, cursor.y);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
    expect(zoomed.scale).toBeCloseTo(3.4);
  });

  it("zoomAt clamps scale", () => {
    expect(zoomAt(vp, 0, 0, 100).scale).toBe(8);
    expect(zoomAt(vp, 0, 0, 0.0001).scale).toBe(0.05);
  });

  it("pan shifts the translation only", () => {
    expect(pan(vp, 10, -5)).toEqual({ tx: 110, ty: 45, scale: 2 });
  });

  it("fitBounds centers the box in the view", () => {
    const fitted = fitBounds({ minX: 0, minY: 0, maxX: 100, maxY: 100 }, 800, 600, 50);
    // box center should land at view center
    const center = worldToScreen(fitted, 50, 50);
    expect(center.x).toBeCloseTo(400);
    expect(center.y).toBeCloseTo(300);
  });
});
