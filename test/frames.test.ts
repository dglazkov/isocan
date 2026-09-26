import { describe, expect, it } from "vitest";
// @ts-expect-error — a plain .mjs script, imported for its two pure readers.
import { frameStats, selfTimeBySource } from "../scripts/frames.mjs";

/**
 * **The frame census reads what it says it reads** — lesson 100's rule, applied
 * before its first reading is believed: an instrument gets a known answer.
 */
describe("frameStats", () => {
  it("reports the tail, not an average", () => {
    // Six smooth frames and one long one: the average says 22 ms and hides it;
    // the tail names it.
    const s = frameStats([16.7, 16.7, 16.6, 16.7, 16.8, 16.7, 50]);
    expect(s.frames).toBe(7);
    expect(s.p50).toBe(16.7);
    expect(s.worst).toBe(50);
    expect(s.over16).toBe(2);
    expect(s.over32).toBe(1);
  });

  it("says nothing happened when nothing did", () => {
    expect(frameStats([])).toEqual({ frames: 0, p50: 0, p90: 0, p99: 0, worst: 0, over16: 0, over32: 0 });
  });
});

describe("selfTimeBySource", () => {
  it("groups samples by the node they landed on, falling back to native frames", () => {
    const profile = {
      nodes: [
        { id: 1, callFrame: { url: "", functionName: "(program)", lineNumber: -1, columnNumber: -1 } },
        { id: 2, callFrame: { url: "", functionName: "(idle)", lineNumber: -1, columnNumber: -1 } },
      ],
      samples: [1, 1, 2, 1],
      timeDeltas: [1000, 1000, 2000, 1000],
    };
    const got = selfTimeBySource(profile, "/nonexistent");
    expect(got.totalMs).toBe(5);
    expect(got.files.map((f: { file: string; ms: number }) => [f.file, f.ms])).toEqual([["((program))", 3], ["((idle))", 2]]);
  });
});
