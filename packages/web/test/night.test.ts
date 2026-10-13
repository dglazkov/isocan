import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isLiving, isTheme, themeCursorName, themeLabel } from "@isocan/core";

import {
  FLY_CAP,
  GLOW_REACH_PX,
  GLOW_STEP,
  LIFE_MIN,
  LIFE_SPAN,
  SPAWN_PX,
  drift,
  flyLight,
  glowWrite,
  itemGlow,
  wake,
  type Fly,
} from "../src/lib/fireflies.ts";
import { PAINTED } from "../src/components/themes/PaintedGround.tsx";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

/** A seeded generator, so a spawn is a fact rather than a chance. */
function seeded(seed = 7): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * **Night, living grounds phase 3: the parts a test can hold without a GPU.**
 *
 * The swarm (spawn along a path, drift up, blink, fade in 5–10 s) and the
 * item glow (measured only within reach, written only when it moves) are pure
 * functions in `lib/fireflies.ts`; the drawing is the `night` journey's.
 */
describe("Night is a living ground", () => {
  it("is a ground core knows, that moves, labelled Night, wearing a firefly", () => {
    expect(isTheme("night")).toBe(true);
    expect(isLiving("night")).toBe(true);
    expect(themeLabel("night")).toBe("Night");
    expect(themeCursorName("night")).toBe("firefly");
  });

  it("has a still that covers the window rather than tiling, since its sky is screen space", () => {
    expect(PAINTED.night).toEqual({ world: 1600, pinned: true });
  });

  it("is loaded only through import()", () => {
    const living = read("../src/components/themes/LivingGround.tsx");
    expect(living).toMatch(/import\("\.\/night\.ts"\)/);
    expect(living).not.toMatch(/^import .*night\.ts/m);
  });
});

describe("fireflies wake along a path, drift, and fade", () => {
  it("wakes one chance per SPAWN_PX of screen travel, along the segment, below it", () => {
    const flies: Fly[] = [];
    const rand = seeded();
    const left = wake(flies, 0, { x: 0, y: 0 }, { x: 100, y: 0 }, 100 * 2, 2, rand);
    // 200 px is 12 chances (and 8 px over), each 60%: some, never more than 12.
    expect(left).toBeCloseTo(200 - 12 * SPAWN_PX);
    expect(flies.length).toBeGreaterThan(0);
    expect(flies.length).toBeLessThanOrEqual(12);
    for (const q of flies) {
      expect(q.x).toBeGreaterThan(-34);
      expect(q.x).toBeLessThan(134);
      expect(q.y).toBeGreaterThan(0); // out of the grass beneath the path
      expect(q.vy).toBeLessThan(0); // and rising
      expect(q.life).toBeGreaterThanOrEqual(LIFE_MIN);
      expect(q.life).toBeLessThan(LIFE_MIN + LIFE_SPAN);
    }
  });

  it("wakes nothing for a pointer that did not move, and carries short moves over", () => {
    const flies: Fly[] = [];
    expect(wake(flies, 0, { x: 5, y: 5 }, { x: 5, y: 5 }, 0, 1, seeded())).toBe(0);
    expect(wake(flies, 0, { x: 0, y: 0 }, { x: 10, y: 0 }, 10, 1, seeded())).toBe(10);
    expect(flies).toHaveLength(0);
  });

  it("never holds more than the cap", () => {
    const flies: Fly[] = [];
    wake(flies, 0, { x: 0, y: 0 }, { x: 1e5, y: 0 }, 1e5, 1, seeded());
    expect(flies.length).toBe(FLY_CAP);
  });

  it("drifts up while it lives, and is gone after its life", () => {
    const flies: Fly[] = [];
    wake(flies, 0, { x: 0, y: 0 }, { x: 400, y: 0 }, 400, 1, seeded(3));
    const n = flies.length;
    const y0 = flies.reduce((a, q) => a + q.y, 0) / n;
    let alive = drift(flies, 1, 1);
    expect(alive).toHaveLength(n);
    expect(alive.reduce((a, q) => a + q.y, 0) / n).toBeLessThan(y0);
    for (let t = 0; t < LIFE_MIN - 1.5; t += 0.5) alive = drift(alive, 0.5, 1);
    expect(alive.length).toBe(n); // nobody dies before 5 s
    for (let t = 0; t < LIFE_SPAN + 1; t += 0.5) alive = drift(alive, 0.5, 1);
    expect(alive).toHaveLength(0); // everybody is gone by 10 s
  });

  it("fades in, blinks, fades out, and is dark when the ground's ambient is", () => {
    const q: Fly = { x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 6, ph: Math.PI / 2, rate: 0, seed: 0 };
    expect(flyLight(q, 1)).toBe(0); // just woken
    q.age = 2;
    expect(flyLight(q, 1)).toBeGreaterThan(0.9); // at the top of its blink
    expect(flyLight(q, 0)).toBe(0); // settled: dark
    q.age = 6;
    expect(flyLight(q, 1)).toBe(0); // at the end of its life
  });
});

describe("items catch the light, cheaply", () => {
  it("lights an item near a firefly, and an item out of reach not at all", () => {
    const lights = [{ x: 100, y: 100, i: 1 }];
    expect(itemGlow(120, 80, 200, 100, lights)).toBeGreaterThan(0.1); // the light is over its edge
    expect(itemGlow(100 + GLOW_REACH_PX + 50, 100, 200, 100, lights)).toBe(0);
  });

  it("writes only on a change bigger than GLOW_STEP, and clears exactly once", () => {
    expect(glowWrite(0, 0)).toBeNull(); // never lit: never touched
    expect(glowWrite(0, GLOW_STEP / 2)).toBeNull(); // too faint to be worth a write
    expect(glowWrite(0, 0.3)).toBe(0.3);
    expect(glowWrite(0.3, 0.31)).toBeNull(); // a wobble is not a write
    expect(glowWrite(0.3, 0.35)).toBe(0.35);
    expect(glowWrite(0.35, 0)).toBe(0); // the light left: one clear
    expect(glowWrite(0, 0.001)).toBeNull(); // and then nothing
  });

  it("measures only items within reach and writes through glowWrite, never every item every frame", () => {
    const night = read("../src/components/themes/night.ts");
    expect(night).toMatch(/const near = lit\.some/);
    expect(night).toMatch(/near \? itemGlow\(/);
    expect(night).toMatch(/glowWrite\(written\.get\(id\) \?\? 0, g\)/);
    expect(night).toMatch(/if \(out === null\) continue;/);
  });
});
