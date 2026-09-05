import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DECAY_MS, MAX_FLICK, coastDistance, coastFrame, flickVelocity } from "../src/lib/inertia.ts";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const viewport = read("../src/components/CanvasViewport.tsx");
const item = read("../src/components/ItemView.tsx");
const css = read("../src/styles.css");

/**
 * **Motion that decides where things end up** (motion note, recommendation
 * 1) is the one kind this canvas never had, added once and under the note's
 * three conditions: gentle and short, interruptible, off under reduced
 * motion. And recommendation 2: an item that arrives from somebody else
 * comes in rather than popping — kind 1, skippable, guarded.
 */
describe("a flick coasts; a stop stops", () => {
  const drag = (speed: number) => [
    { t: 0, x: 0, y: 0 },
    { t: 40, x: speed * 40, y: 0 },
    { t: 80, x: speed * 80, y: 0 },
  ];

  it("reads the hand's speed from the last moments only, and a slow release does not coast", () => {
    expect(flickVelocity(drag(1), 80)).toEqual({ vx: 1, vy: 0 });
    expect(flickVelocity(drag(0.1), 80)).toBeNull();
    // Fast earlier, then resting before the lift: a stop.
    expect(flickVelocity(drag(2), 400)).toBeNull();
  });

  it("caps a wild throw so it still lands nearby", () => {
    const v = flickVelocity(drag(20), 80)!;
    expect(Math.hypot(v.vx, v.vy)).toBeCloseTo(MAX_FLICK, 6);
    expect(coastDistance(MAX_FLICK)).toBeLessThan(400);
  });

  it("decays to rest within a few hundred milliseconds, and a slow frame covers the same ground as quick ones", () => {
    let v = { vx: 2, vy: 0 };
    let travelled = 0;
    let t = 0;
    for (; t < 2000; t += 16) {
      const f = coastFrame(v, 16);
      travelled += f.dx;
      v = f.next;
      if (f.done) break;
    }
    expect(t).toBeLessThan(700);
    // Within a few pixels of v·τ: the loop stops at REST rather than at zero.
    expect(Math.abs(travelled - coastDistance(2))).toBeLessThan(4);
    const one = coastFrame({ vx: 2, vy: 0 }, 32);
    const two = coastFrame(coastFrame({ vx: 2, vy: 0 }, 16).next, 16);
    expect(one.dx).toBeCloseTo(coastFrame({ vx: 2, vy: 0 }, 16).dx + two.dx, 9);
    expect(DECAY_MS).toBeLessThan(200);
  });
});

describe("the viewport honours the three conditions", () => {
  it("coasts on release, and a press or a wheel stops the coast where it is", () => {
    expect(viewport).toContain("const v = flickVelocity(samples, performance.now());");
    expect(viewport).toContain("stopCoast();");
    expect(viewport).toMatch(/function stopCoast\(\)/);
  });

  it("does not coast under reduced motion", () => {
    expect(viewport).toContain('matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;');
  });
});

describe("an item from somebody else arrives rather than pops", () => {
  it("wears `arrived` on mount when it is new and not yours, and the keyframe is guarded", () => {
    expect(item).toContain("item.createdBy.id !== actor.id");
    expect(item).toContain("ARRIVAL_MS");
    expect(css).toContain(".item.arrived");
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[^}]*\.item\.arrived/);
  });
});
