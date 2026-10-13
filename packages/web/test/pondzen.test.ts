import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { CRUISE, DART, FLEE_PX, KOI_COUNT, spawnKoi, stirred, swim, turn, type Koi } from "../src/lib/koi.ts";
import { RAKE_R, SOFTEN_S, TINE, rakeEdge, rakeOffset, rakeStrength, simRect } from "../src/lib/rake.ts";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

/**
 * **Living grounds phase 4: Pond and Zen garden.** The arithmetic each one's
 * shaders mirror — where the state texture sits, where a point sits across a
 * rake stroke, how a raked line softens — and the koi, the Pond's one piece
 * of CPU state. What only a browser can show (ripples at the crossed point,
 * the sleep bound, the still under reduced motion) is the `pond` and `zen`
 * journeys.
 */

const view = { scale: 1, tx: 0, ty: 0 };
const bounds = { x: 0, y: 0, w: 1200, h: 800 };
const copy = (k: Koi[]) => k.map((f) => ({ ...f }));

describe("the state texture under a living ground", () => {
  it("covers the view with whole power-of-two texels", () => {
    const r = simRect(view, 1440, 900, 768);
    expect(Math.log2(r.texel) % 1).toBe(0);
    expect(r.size).toBe(r.texel * 768);
    expect(r.x).toBeLessThanOrEqual(0);
    expect(r.y).toBeLessThanOrEqual(0);
    expect(r.x + r.size).toBeGreaterThanOrEqual(1440);
    expect(r.y + r.size).toBeGreaterThanOrEqual(900);
  });

  it("moves by whole texels on a pan, so a ripple or a line is copied, not blurred", () => {
    const a = simRect(view, 1440, 900, 768);
    const b = simRect({ scale: 1, tx: -37, ty: 11 }, 1440, 900, 768);
    expect(b.texel).toBe(a.texel);
    expect(Math.abs(((b.x - a.x) / a.texel) % 1)).toBe(0);
    expect(Math.abs(((b.y - a.y) / a.texel) % 1)).toBe(0);
  });

  it("keeps its resolution felt on screen as the zoom changes", () => {
    const near = simRect({ scale: 1, tx: 0, ty: 0 }, 1440, 900, 768);
    const far = simRect({ scale: 0.25, tx: 0, ty: 0 }, 1440, 900, 768);
    expect(far.texel).toBe(near.texel * 4);
  });
});

describe("the rake", () => {
  it("gives a point its signed offset across the stroke", () => {
    expect(rakeOffset(50, 10, 0, 0, 100, 0)).toBeCloseTo(10);
    expect(rakeOffset(50, -10, 0, 0, 100, 0)).toBeCloseTo(-10);
    expect(rakeOffset(50, 0, 0, 0, 100, 0)).toBeCloseTo(0);
  });

  it("owns nothing behind where the stroke began, and nothing past its width", () => {
    // Behind `a` is the last segment's, so a path of short segments does not
    // stamp a fan of rings at every joint.
    expect(rakeOffset(-5, 3, 0, 0, 100, 0)).toBeNull();
    expect(rakeOffset(50, RAKE_R + 1, 0, 0, 100, 0)).toBeNull();
    expect(rakeOffset(10, 0, 0, 0, 0, 0)).toBeNull();
  });

  it("rounds the end where the rake was lifted", () => {
    expect(Math.abs(rakeOffset(110, 0, 0, 0, 100, 0)!)).toBeCloseTo(10);
    expect(Math.abs(rakeOffset(106, 8, 0, 0, 100, 0)!)).toBeCloseTo(10);
  });

  it("softens back over twenty seconds of awake time", () => {
    expect(SOFTEN_S).toBe(20);
    expect(rakeStrength(0)).toBe(1);
    expect(rakeStrength(10)).toBeCloseTo(0.5);
    expect(rakeStrength(20)).toBe(0);
    expect(rakeStrength(60)).toBe(0);
  });

  it("presses lighter at its outer tines, and fully between them", () => {
    expect(rakeEdge(0)).toBe(1);
    expect(rakeEdge(RAKE_R * 0.7)).toBe(1);
    expect(rakeEdge(RAKE_R)).toBe(0);
    expect(rakeEdge(RAKE_R * 0.875)).toBeCloseTo(0.5);
  });

  it("rakes at the base pattern's own pitch, which divides the tile", () => {
    const zen = read("../src/components/themes/zen.ts");
    const tile = Number(/export const TILE = (\d+)/.exec(zen)![1]);
    expect(tile % TINE).toBe(0);
  });

  it("never keeps the garden awake to soften it", () => {
    // Softening is the clock (`ease`-weighted), not motion: `step` is at rest
    // exactly when the host's envelope is, as Meadow's.
    const zen = read("../src/components/themes/zen.ts");
    expect(zen).toMatch(/clock \+= dt \* f\.ease;/);
    expect(zen).toMatch(/return f\.ease > 0\.002;\n/);
  });
});

describe("the koi", () => {
  it("spawn the same pond every time, inside the view", () => {
    const a = spawnKoi(KOI_COUNT, bounds);
    expect(a).toEqual(spawnKoi(KOI_COUNT, bounds));
    for (const k of a) {
      expect(k.x).toBeGreaterThan(bounds.x);
      expect(k.x).toBeLessThan(bounds.x + bounds.w);
      expect(k.y).toBeGreaterThan(bounds.y);
      expect(k.y).toBeLessThan(bounds.y + bounds.h);
    }
  });

  it("cruise with the ambient, and hold still under Calm when nobody is near", () => {
    const k = spawnKoi(KOI_COUNT, bounds);
    const before = copy(k);
    swim(k, 0.5, 0, 0, [], new Float32Array(0), bounds, 1);
    expect(k.map((f) => [f.x, f.y, f.heading])).toEqual(before.map((f) => [f.x, f.y, f.heading]));
    expect(stirred(k)).toBe(false);
    swim(k, 0.5, 1, 0, [], new Float32Array(0), bounds, 1);
    const moved = k.map((f, i) => Math.hypot(f.x - before[i]!.x, f.y - before[i]!.y));
    for (const d of moved) expect(d).toBeCloseTo(CRUISE * 0.5, 0);
  });

  it("dart away from a cursor that just moved near — under Calm too", () => {
    const k: Koi[] = [{ x: 500, y: 400, heading: Math.PI, flee: 0, size: 40, tail: 0, seed: 0.5 }];
    const cursor = { x: 440, y: 400, fresh: true };
    const d0 = Math.hypot(k[0]!.x - cursor.x, k[0]!.y - cursor.y);
    for (let i = 0; i < 45; i++) swim(k, 1 / 60, 0, 0, [cursor], new Float32Array(0), bounds, 1);
    expect(stirred(k)).toBe(true);
    expect(Math.abs(turn(k[0]!.heading, 0))).toBeLessThan(Math.PI / 2);
    expect(Math.hypot(k[0]!.x - cursor.x, k[0]!.y - cursor.y)).toBeGreaterThan(d0 + 10);
  });

  it("ignore a cursor that is far, or parked", () => {
    const k: Koi[] = [{ x: 500, y: 400, heading: 0, flee: 0, size: 40, tail: 0, seed: 0.5 }];
    swim(k, 0.1, 0, 0, [{ x: 500 + FLEE_PX + 5, y: 400, fresh: true }, { x: 510, y: 400, fresh: false }], new Float32Array(0), bounds, 1);
    expect(k[0]!.flee).toBe(0);
  });

  it("feel near in screen pixels, so zooming out widens their fright in the world", () => {
    const k: Koi[] = [{ x: 500, y: 400, heading: 0, flee: 0, size: 40, tail: 0, seed: 0.5 }];
    swim(k, 0.01, 0, 0, [{ x: 500 + FLEE_PX * 1.5, y: 400, fresh: true }], new Float32Array(0), bounds, 0.5);
    expect(k[0]!.flee).toBeGreaterThan(0);
  });

  it("calm down within the sleep bound once the cursor has gone", () => {
    const k: Koi[] = [{ x: 500, y: 400, heading: 0, flee: 1, size: 40, tail: 0, seed: 0.5 }];
    let t = 0;
    while (stirred(k) && t < 10) {
      swim(k, 1 / 60, 0, 0, [], new Float32Array(0), bounds, 1);
      t += 1 / 60;
    }
    expect(t).toBeLessThan(2);
    expect(DART).toBeGreaterThan(CRUISE);
  });

  it("are brought back in when a pan leaves them far behind", () => {
    const k: Koi[] = [{ x: 9000, y: 9000, heading: 0, flee: 0, size: 40, tail: 0, seed: 0.5 }];
    swim(k, 0.1, 1, 0, [], new Float32Array(0), bounds, 1);
    expect(Math.hypot(k[0]!.x - 600, k[0]!.y - 400)).toBeLessThan(Math.hypot(bounds.w, bounds.h));
  });
});

describe("Pond and Zen garden on the living layer", () => {
  it("load each ground only through import()", () => {
    const living = read("../src/components/themes/LivingGround.tsx");
    expect(living).toMatch(/pond: \(\) => import\("\.\/pond\.ts"\)/);
    expect(living).toMatch(/zen: \(\) => import\("\.\/zen\.ts"\)/);
    expect(living).not.toMatch(/^import .*(pond|zen)\.ts/m);
  });

  it("stop the ripple pass once the water is flat, inside the settle cap", () => {
    const pond = read("../src/components/themes/pond.ts");
    const life = Number(/export const RIPPLE_LIFE = ([\d.]+)/.exec(pond)![1]);
    expect(life).toBeLessThan(3);
    expect(pond).toMatch(/return f\.ease > 0\.002 \|\| simClock - lastPress < RIPPLE_LIFE \|\| stirred\(koi\);/);
  });
});
