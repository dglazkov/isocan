// @vitest-environment jsdom

/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { describe, expect, it } from "vitest";
import {
  CAMERA_ACK_DURATION_MS,
  animateViewportTo,
  easeOutCubic,
} from "../src/lib/cameraAck.ts";
import type { Viewport } from "../src/lib/viewport.ts";

function makeFrameDriver() {
  let clock = 0;
  let nextId = 1;
  const pending = new Map<number, FrameRequestCallback>();

  return {
    now: () => clock,
    requestFrame: (cb: FrameRequestCallback) => {
      const id = nextId++;
      pending.set(id, cb);
      return id;
    },
    cancelFrame: (id: number) => {
      pending.delete(id);
    },
    stepTo(timeMs: number) {
      clock = timeMs;
      const batch = [...pending.entries()];
      pending.clear();
      for (const [, cb] of batch) cb(clock);
    },
    pendingCount: () => pending.size,
  };
}

describe("cameraAck — animateViewportTo (ADR 0304)", () => {
  it("tweens over 320ms ease-out and resolves verified only after settling", async () => {
    expect(CAMERA_ACK_DURATION_MS).toBe(320);
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875, 5);
    expect(easeOutCubic(1)).toBe(1);

    let viewport: Viewport = { tx: 0, ty: 0, scale: 1 };
    const driver = makeFrameDriver();
    let settled = false;

    const promise = animateViewportTo(
      { tx: 400, ty: 200, scale: 2 },
      {
        getViewport: () => viewport,
        setViewport: (next) => {
          viewport = next;
        },
        now: driver.now,
        requestFrame: driver.requestFrame,
        cancelFrame: driver.cancelFrame,
        reducedMotion: false,
      },
    ).then((res) => {
      settled = true;
      return res;
    });

    // Halfway through 320ms: viewport moved along ease-out curve, promise NOT resolved yet.
    driver.stepTo(160);
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(viewport.tx).toBeCloseTo(350, 3);
    expect(viewport.ty).toBeCloseTo(175, 3);
    expect(viewport.scale).toBeCloseTo(1.875, 3);

    // At 320ms: lands exactly on target and resolves "verified".
    driver.stepTo(320);
    const result = await promise;
    expect(settled).toBe(true);
    expect(result).toEqual({
      status: "verified",
      viewport: { tx: 400, ty: 200, scale: 2 },
    });
    expect(driver.pendingCount()).toBe(0);
  });

  it("cancels immediately on user wheel and resolves interrupted", async () => {
    let viewport: Viewport = { tx: 0, ty: 0, scale: 1 };
    const driver = makeFrameDriver();

    const promise = animateViewportTo(
      { tx: 300, ty: 0, scale: 1 },
      {
        getViewport: () => viewport,
        setViewport: (next) => {
          viewport = next;
        },
        now: driver.now,
        requestFrame: driver.requestFrame,
        cancelFrame: driver.cancelFrame,
        reducedMotion: false,
      },
    );

    driver.stepTo(80);
    const midTx = viewport.tx;
    expect(midTx).toBeGreaterThan(0);
    expect(midTx).toBeLessThan(300);

    window.dispatchEvent(new Event("wheel", { bubbles: true }));
    const result = await promise;
    expect(result.status).toBe("interrupted");
    expect(result.viewport.tx).toBeCloseTo(midTx, 5);
    expect(driver.pendingCount()).toBe(0);
  });

  it("cancels immediately on user pointerdown and resolves interrupted", async () => {
    let viewport: Viewport = { tx: 10, ty: 20, scale: 1 };
    const driver = makeFrameDriver();

    const promise = animateViewportTo(
      { tx: 510, ty: 220, scale: 1.5 },
      {
        getViewport: () => viewport,
        setViewport: (next) => {
          viewport = next;
        },
        now: driver.now,
        requestFrame: driver.requestFrame,
        cancelFrame: driver.cancelFrame,
        reducedMotion: false,
      },
    );

    driver.stepTo(64);
    window.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    const result = await promise;
    expect(result.status).toBe("interrupted");
    expect(result.viewport.tx).toBeLessThan(510);
    expect(driver.pendingCount()).toBe(0);
  });

  it("settles immediately as verified when reduced motion is preferred", async () => {
    let viewport: Viewport = { tx: 0, ty: 0, scale: 1 };
    const result = await animateViewportTo(
      { tx: 120, ty: 240, scale: 1.25 },
      {
        getViewport: () => viewport,
        setViewport: (next) => {
          viewport = next;
        },
        reducedMotion: true,
      },
    );
    expect(result).toEqual({
      status: "verified",
      viewport: { tx: 120, ty: 240, scale: 1.25 },
    });
  });
});
