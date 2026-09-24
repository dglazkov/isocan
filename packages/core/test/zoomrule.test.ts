import { describe, expect, it } from "vitest";
import { holdsAtZoom, textIsLegible, zoomFade } from "../src/index.ts";

// The flicker, reproduced: `wobble` below is a zoom resting exactly on a
// threshold. Asked fresh each frame (the rule before #203 phase 1) it flips
// every frame; asked with its last answer it holds.

/** Ask the rule once per frame, threading its last answer — what ItemView does. */
function walk(pixels: number[], threshold: number, remember: boolean): boolean[] {
  let was: boolean | undefined;
  return pixels.map((px) => {
    const now = holdsAtZoom(px, threshold, remember ? was : undefined);
    was = now;
    return now;
  });
}
const flips = (answers: boolean[]) => answers.slice(1).filter((a, i) => a !== answers[i]).length;

describe("holdsAtZoom: one zoom rule, with hysteresis (#203 phase 1)", () => {
  // A trackpad settling at exactly 5px on screen: a few thousandths of a
  // pixel either side, frame after frame.
  const wobble = Array.from({ length: 40 }, (_, i) => 5 + (i % 2 ? 0.004 : -0.004));

  it("reproduces the flicker: without memory, a wobble on the line flips every frame", () => {
    // This is the old rule exactly — `worldSize * scale >= 5` asked fresh.
    expect(flips(walk(wobble, 5, false))).toBe(39);
  });

  it("with memory, the same wobble flips at most once", () => {
    expect(flips(walk(wobble, 5, true))).toBeLessThanOrEqual(1);
  });

  it("never flip-flops anywhere inside the band, whichever way it is entered", () => {
    const band = Array.from({ length: 200 }, (_, i) => 5 + ((i * 7919) % 50) / 100); // 5.00 … 5.49
    for (const start of [4, 6]) {
      const answers = walk([start, ...band], 5, true);
      expect(flips(answers.slice(1)), `entered from ${start}`).toBe(0);
    }
  });

  it("going down drops at the threshold itself — a measured floor is never undercut", () => {
    expect(holdsAtZoom(5, 5, true)).toBe(true);
    expect(holdsAtZoom(4.999, 5, true)).toBe(false);
  });

  it("coming back up waits for the band above the threshold", () => {
    expect(holdsAtZoom(5.2, 5, false)).toBe(false);
    expect(holdsAtZoom(5.5, 5, false)).toBe(true);
  });

  it("with no history it is the plain threshold, so a first render decides as it always did", () => {
    expect(holdsAtZoom(5, 5)).toBe(true);
    expect(holdsAtZoom(4.99, 5)).toBe(false);
    expect(textIsLegible(16, 0.3125)).toBe(true);
    expect(textIsLegible(16, 0.31)).toBe(false);
  });

  it("textIsLegible carries the memory through", () => {
    expect(textIsLegible(16, 0.32, false)).toBe(false); // 5.12px: inside the band, still a mark
    expect(textIsLegible(16, 0.32, true)).toBe(true); // …and still words, coming down
  });
});

describe("zoomFade: the same question as a ramp", () => {
  it("is 0 at or below gone, 1 at or above full, linear between", () => {
    expect(zoomFade(0.05, 0.1, 0.5)).toBe(0);
    expect(zoomFade(0.1, 0.1, 0.5)).toBe(0);
    expect(zoomFade(0.3, 0.1, 0.5)).toBeCloseTo(0.5);
    expect(zoomFade(0.5, 0.1, 0.5)).toBe(1);
    expect(zoomFade(4, 0.1, 0.5)).toBe(1);
  });

  it("agrees with the galaxy's old inline curve everywhere", () => {
    for (let s = 0; s <= 1; s += 0.01) {
      expect(zoomFade(s, 0.1, 0.5)).toBeCloseTo(Math.max(0, Math.min(1, (s - 0.1) / 0.4)), 10);
    }
  });
});
