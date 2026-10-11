import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isLiving, isTheme, themeCursorName, themeLabel } from "@isocan/core";

import { FILL_RATE, PACK_STEP, easeGust, fillSteps, gustTarget, packNext, pressOf } from "../src/lib/snowpack.ts";
import { EBB_RATE, LEAN_SIGMA, easeEnergy, itemLight, leanAt } from "../src/lib/auroralight.ts";
import { PAINTED } from "../src/components/themes/PaintedGround.tsx";
import { TILE } from "../src/components/themes/snow.ts";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

/**
 * **Snow and Aurora, living grounds phase 4: the parts a test can hold
 * without a GPU.** The snow's pack (fill in whole 8-bit steps, pressed by the
 * trail's core) and its gusts, and the aurora's energies, lean and item light,
 * are pure functions; the drawing is the `snow` and `aurora` journeys'.
 */
describe("Snow and Aurora are living grounds", () => {
  it("are grounds core knows, that move, with real labels and borrowed cursors", () => {
    expect(isTheme("snow") && isLiving("snow")).toBe(true);
    expect(isTheme("aurora") && isLiving("aurora")).toBe(true);
    expect(themeLabel("snow")).toBe("Snow");
    expect(themeLabel("aurora")).toBe("Aurora");
    expect(themeCursorName("snow")).toBe("sparkle");
    expect(themeCursorName("aurora")).toBe("crescent");
  });

  it("have stills: Snow tiled at its own period, Aurora covering the window like Night", () => {
    expect(PAINTED.snow).toEqual({ world: TILE });
    expect(PAINTED.aurora?.pinned).toBe(true);
  });

  it("are loaded only through import()", () => {
    const living = read("../src/components/themes/LivingGround.tsx");
    expect(living).toMatch(/import\("\.\/snow\.ts"\)/);
    expect(living).toMatch(/import\("\.\/aurora\.ts"\)/);
    expect(living).not.toMatch(/^import .*(snow|aurora)\.ts/m);
  });
});

describe("snow fills back in, only while awake", () => {
  it("hands the shader whole 8-bit steps and carries the rest, so 60 fps still fills", () => {
    let carry = 0;
    let filled = 0;
    for (let i = 0; i < 60; i++) {
      const f = fillSteps(carry, 1 / 60);
      carry = f.carry;
      filled += f.fill;
      expect(Math.round(f.fill / PACK_STEP) * PACK_STEP).toBeCloseTo(f.fill, 12);
    }
    // One awake second fills FILL_RATE, to within one step.
    expect(Math.abs(filled - FILL_RATE)).toBeLessThanOrEqual(PACK_STEP);
    // A single 60 fps frame alone would round to nothing in 8 bits.
    expect((1 / 60) * FILL_RATE).toBeLessThan(PACK_STEP);
  });

  it("fills nothing in a frame of no time (a Calm paint)", () => {
    expect(fillSteps(0, 0)).toEqual({ fill: 0, carry: 0 });
  });

  it("keeps a print through the time the host's trail fades, and fills it over about 20 awake seconds", () => {
    let v = packNext(0, 1, 0);
    expect(v).toBe(1);
    // The host's trail fades in ~1.4 s; the pack holds what it pressed.
    for (let t = 0; t < 1.4; t += 0.1) v = packNext(v, Math.max(0, 1 - t / 1.4), 0.1 * FILL_RATE);
    expect(v).toBeGreaterThan(0.9);
    for (let t = 0; t < 20; t += 0.1) v = packNext(v, 0, 0.1 * FILL_RATE);
    expect(v).toBeLessThan(0.05);
  });

  it("presses only the trail's core, so a print is narrower than the host's soft stamp", () => {
    expect(pressOf(0.25)).toBe(0);
    expect(pressOf(0.8)).toBe(1);
    expect(pressOf(0.5)).toBeGreaterThan(0);
    expect(pressOf(0.5)).toBeLessThan(1);
  });
});

describe("flakes swirl round a fast cursor, then settle", () => {
  it("stirs nothing for a slow or stopped cursor, fully for a flick", () => {
    expect(gustTarget(200, true)).toBe(0);
    expect(gustTarget(5000, true)).toBe(1);
    expect(gustTarget(5000, false)).toBe(0);
  });

  it("eases out to exactly zero within the sleep cap", () => {
    let g = 1;
    let t = 0;
    while (g > 0 && t < 10) {
      g = easeGust(g, 0, 1 / 60);
      t += 1 / 60;
    }
    expect(g).toBe(0);
    expect(t).toBeLessThan(3);
  });
});

describe("the aurora leans toward a cursor, and lets go", () => {
  it("rises while the pointer moves and ebbs to exactly zero inside the 3 s cap", () => {
    let e = 0;
    for (let i = 0; i < 30; i++) e = easeEnergy(e, true, 1, 1 / 60);
    expect(e).toBeGreaterThan(0.8);
    let t = 0;
    while (e > 0 && t < 10) {
      e = easeEnergy(e, false, 1, 1 / 60);
      t += 1 / 60;
    }
    expect(e).toBe(0);
    expect(t).toBeLessThan(3);
    expect(EBB_RATE).toBeGreaterThan(0);
  });

  it("leans over the pointer's column and not three sigmas away", () => {
    const leans = [{ x: 400, e: 1 }];
    expect(leanAt(400, leans)).toBeCloseTo(1, 6);
    expect(leanAt(400 + 3.2 * LEAN_SIGMA, leans)).toBeLessThan(0.01);
    expect(leanAt(400, [])).toBe(0);
  });

  it("lights an item under a lit column, an item far across none, and caps the light", () => {
    const leans = [{ x: 400, e: 1 }];
    expect(itemLight(380, 90, leans)).toBeGreaterThan(0.3);
    expect(itemLight(1100, 90, leans)).toBeLessThan(0.02);
    expect(itemLight(380, 90, [{ x: 400, e: 1 }, { x: 410, e: 1 }])).toBeLessThanOrEqual(0.5);
  });

  it("writes its light as its own property, never Night's", () => {
    const src = read("../src/components/themes/aurora.ts");
    expect(src).toMatch(/--aurora-glow/);
    expect(src).not.toMatch(/--ground-glow/);
    expect(src).toMatch(/glowWrite\(/);
  });
});
