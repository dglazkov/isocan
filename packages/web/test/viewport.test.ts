import { describe, expect, it } from "vitest";
import {
  fitBounds,
  pan,
  pinch,
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

/**
 * **A pinch** (#182 stage 0).
 *
 * Measured 5 Sep: this canvas had no pinch at all. Zoom was two paths that
 * only a trackpad can reach — a `ctrlKey` wheel and WebKit's `gesturestart`
 * — plus the +/- buttons, and `touch-action: none` had switched the browser's
 * own zoom off. On a phone the canvas could not be zoomed.
 *
 * The arithmetic is asserted here rather than through a browser because the
 * property that matters is geometric: **the point under your fingers must not
 * move.** Driving two synthetic touches through the real component proves the
 * wiring and cannot see a canvas sliding out from under the hand doing the
 * gesture — which is what a pinch that zooms about a fixed point does, and it
 * looks like a bug in the fingers rather than in the code.
 */
describe("two fingers", () => {
  const vp: Viewport = { tx: 100, ty: 50, scale: 2 };
  const pair = (ax: number, ay: number, bx: number, by: number) => ({
    a: { x: ax, y: ay },
    b: { x: bx, y: by },
  });

  it("keeps the world point under the midpoint still while it spreads", () => {
    /* The whole property. Fingers at 300 and 500 on one row spread to 200 and
       600 — the midpoint has not moved, so nothing but the zoom happens, and
       the world point there is the one the hand is on. */
    const from = pair(300, 400, 500, 400);
    const to = pair(200, 400, 600, 400);
    const held = screenToWorld(vp, 400, 400);
    const after = pinch(vp, from, to);
    expect(after.scale).toBeCloseTo(4);
    const still = screenToWorld(after, 400, 400);
    expect(still.x).toBeCloseTo(held.x);
    expect(still.y).toBeCloseTo(held.y);
  });

  it("carries the canvas with the midpoint as well as scaling it", () => {
    /* A pinch is two gestures at once, and the pan half is the one that gets
       dropped: a hand that spreads AND travels expects the canvas to come with
       it. The world point under the fingers before must be under them after,
       at wherever they ended up. */
    const from = pair(300, 400, 500, 400);
    const to = pair(320, 500, 680, 500);
    const held = screenToWorld(vp, 400, 400);
    const after = pinch(vp, from, to);
    expect(after.scale).toBeCloseTo(3.6);
    const still = screenToWorld(after, 500, 500);
    expect(still.x).toBeCloseTo(held.x);
    expect(still.y).toBeCloseTo(held.y);
  });

  it("is a pure pan when the fingers hold their distance", () => {
    const from = pair(300, 400, 500, 400);
    const to = pair(360, 430, 560, 430);
    const after = pinch(vp, from, to);
    expect(after.scale).toBeCloseTo(vp.scale);
    expect(after.tx).toBeCloseTo(vp.tx + 60);
    expect(after.ty).toBeCloseTo(vp.ty + 30);
  });

  it("pinches in as well as out", () => {
    const after = pinch(vp, pair(200, 400, 600, 400), pair(350, 400, 450, 400));
    expect(after.scale).toBeCloseTo(0.5);
  });

  it("refuses two reports at one point rather than zooming by infinity", () => {
    // A touchscreen does emit this — two contacts resolving to the same
    // coordinates for a frame — and the honest answer is to do nothing, not
    // to divide by zero and hand the canvas a NaN transform it cannot leave.
    const still = pinch(vp, pair(300, 400, 300, 400), pair(200, 400, 600, 400));
    expect(still).toEqual(vp);
  });

  it("obeys the same zoom floor and ceiling every other gesture does", () => {
    /* `zoomAt` owns the clamp — "a caller reaching for these is a caller about
       to build a second clamp with its own opinion" — so this asserts that the
       pinch goes THROUGH it rather than around it. A gesture with its own
       limits is how a phone ends up able to zoom somewhere a mouse cannot. */
    const wayOut = pinch({ tx: 0, ty: 0, scale: 4 }, pair(0, 0, 10, 0), pair(0, 0, 1000, 0));
    expect(wayOut.scale).toBeLessThanOrEqual(8);
    const wayIn = pinch({ tx: 0, ty: 0, scale: 0.2 }, pair(0, 0, 1000, 0), pair(0, 0, 1, 0));
    expect(wayIn.scale).toBeGreaterThanOrEqual(0.05);
  });
});
