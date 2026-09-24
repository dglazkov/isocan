import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FULL_LABEL_ROOM, hasRoomForChrome, underRowSpellsItOut } from "../src/lib/chrome.ts";

/**
 * **Every zoom threshold asks core's one rule** (#203 phase 1).
 *
 * The four were written separately once — `textIsLegible`, `hasRoomForChrome`,
 * `underRowSpellsItOut`, the galaxy's fade — and a fifth that re-derives its
 * own `worldSize * scale >= N` would bring back both the drift and the flicker
 * that `holdsAtZoom`'s memory removes. So this reads the sources, the way
 * `worldchrome.test.ts` reads the stylesheet: the precedent here for a rule
 * that is about where code lives rather than what it returns.
 */
const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const chrome = read("../src/lib/chrome.ts");
const itemView = read("../src/components/ItemView.tsx");
const galaxy = read("../src/components/themes/Galaxy.tsx");
const textnode = read("../../core/src/textnode.ts");

describe("the zoom thresholds read one rule", () => {
  it("textIsLegible asks holdsAtZoom", () => {
    expect(textnode).toMatch(/export function textIsLegible\([^)]*was\?: boolean\)[^{]*\{\s*return holdsAtZoom\(/);
  });

  it("hasRoomForChrome and underRowSpellsItOut ask holdsAtZoom", () => {
    expect(chrome).toMatch(/export function hasRoomForChrome\([^)]*was\?: boolean\)[^{]*\{\s*return holdsAtZoom\(/);
    expect(chrome).toMatch(/export function underRowSpellsItOut\([^)]*was\?: boolean\)[^{]*\{\s*return holdsAtZoom\(/);
  });

  it("the galaxy's ground fades through zoomFade, not an inline curve", () => {
    expect(galaxy).toContain("zoomFade(scale,");
    expect(galaxy).not.toMatch(/\(scale - [\d.]+\) \/ [\d.]+/);
  });

  it("ItemView hands each rule its last answer, so the memory is actually used", () => {
    expect(itemView).toMatch(/held\.r = hasRoomForChrome\([^)]*held\.r\)/);
    expect(itemView).toMatch(/held\.t = textIsLegible\([^)]*held\.t\)/);
    expect(itemView).toMatch(/held\.s = underRowSpellsItOut\([\s\S]*?held\.s\)/);
    // The preview mounts on the SAME held answer as the chrome, not a fresh one.
    expect(itemView).toContain("!(nearWindow && roomy)");
  });

  it("no consumer re-derives a threshold by hand", () => {
    for (const [name, src] of [["chrome.ts", chrome], ["textnode.ts", textnode]] as const) {
      expect(src, name).not.toMatch(/\* scale [<>]=? [A-Z_]+/);
    }
  });
});

describe("the web consumers keep the hysteresis", () => {
  it("chrome resting on the line does not blink", () => {
    // 200×150 at the scale where the width is exactly 56px on screen.
    const edge = 56 / 200;
    let was = hasRoomForChrome(200, 150, edge + 0.0001);
    for (let i = 0; i < 20; i++) {
      const now = hasRoomForChrome(200, 150, edge + (i % 2 ? 0.0001 : -0.00001), was);
      if (i > 0) expect(now).toBe(was);
      was = now;
    }
  });

  it("the spelled-out row still never shows below its measured floor", () => {
    expect(underRowSpellsItOut(FULL_LABEL_ROOM - 1, 1, 0, true)).toBe(false);
    expect(underRowSpellsItOut(FULL_LABEL_ROOM + 5, 1, 0, false)).toBe(false);
    expect(underRowSpellsItOut(FULL_LABEL_ROOM + 5, 1, 0, true)).toBe(true);
  });
});
