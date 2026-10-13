import { describe, expect, it } from "vitest";
// @ts-expect-error — a plain .mjs script, imported for its two pure readers.
import { frameStats, groundCost, longFrames, selfTimeBySource } from "../scripts/frames.mjs";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { LIVING } from "@isocan/core";

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

describe("longFrames", () => {
  it("splits each long frame into script and the browser's own work, and names what ran", () => {
    const got = longFrames([
      { duration: 60, render: 10, scripts: [{ duration: 45, invoker: "DOMWindow.onwheel" }] },
      { duration: 170, render: 42, scripts: [{ duration: 20, invoker: "MessagePort.onmessage" }, { duration: 104, invoker: "DOMWindow.onwheel" }] },
      { duration: 185, render: 1, scripts: [] },
    ]);
    expect(got.count).toBe(3);
    expect(got.scriptMs).toBe(169);
    expect(got.renderMs).toBe(53);
    expect(got.worst.map((w: { ms: number; by: string }) => [w.ms, w.by])).toEqual([[185, "no script"], [170, "DOMWindow.onwheel 104 ms"], [60, "DOMWindow.onwheel 45 ms"]]);
  });

  it("says nothing when no frame was long", () => {
    expect(longFrames([])).toEqual({ count: 0, scriptMs: 0, renderMs: 0, worst: [] });
  });
});

describe("groundCost", () => {
  it("counts dropped frames against the refresh, not against a threshold", () => {
    // Eighteen smooth frames, one that took two refreshes and one that took
    // three: three frames a 60 Hz screen showed twice.
    const c = groundCost([...Array(18).fill(16.7), 33.3, 50]);
    expect(c.frames).toBe(20);
    expect(c.p50).toBe(16.7);
    expect(c.p95).toBe(50);
    expect(c.worst).toBe(50);
    expect(c.dropped).toBe(3);
  });

  it("drops nothing on a faster screen that kept up, and says nothing happened when nothing did", () => {
    expect(groundCost([8.3, 8.4, 8.3], 120).dropped).toBe(0);
    expect(groundCost([16.7, 16.7], 120).dropped).toBe(2);
    expect(groundCost([])).toEqual({ frames: 0, p50: 0, p95: 0, worst: 0, dropped: 0 });
  });
});

/**
 * **The reading the performance persona's number is read from** (living
 * grounds phase 5). `measure.mjs ground-frame-ms` takes the costliest ground
 * in `scripts/ground-frames.json`; a ground added to `LIVING` and never walked
 * would simply be absent from that maximum, and the number would go on
 * reading as held.
 */
describe("the living grounds' recorded reading", () => {
  const reading = JSON.parse(readFileSync(fileURLToPath(new URL("../scripts/ground-frames.json", import.meta.url)), "utf8"));

  it("covers every living ground, and only those", () => {
    expect(Object.keys(reading.grounds).sort()).toEqual([...LIVING].sort());
  });

  it("says what it was taken on", () => {
    for (const key of ["at", "commit", "machine", "chrome", "gl", "page", "throttle"]) expect(reading[key], key).toBeTruthy();
    expect(reading.gl, "a software rasteriser's numbers are not a GPU's").not.toMatch(/swiftshader|llvmpipe/i);
  });

  it("records no ground drawing while nothing moved", () => {
    for (const [name, g] of Object.entries<{ asleepFrames: number; groundFrames: number }>(reading.grounds)) {
      expect(g.asleepFrames, `${name} drew frames asleep`).toBe(0);
      expect(g.groundFrames, `${name} was not awake for its walk`).toBeGreaterThan(100);
    }
  });
});
