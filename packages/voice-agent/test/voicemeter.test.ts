import { describe, expect, it } from "vitest";
import { LevelMeter, METER_FLOOR_DB, METER_GATE_DB, barsFromDb, dbfs } from "../src/voiceAudio.ts";

/**
 * **The meter Paul said "just clips and maxes out" — driven by signals whose
 * level is known.**
 *
 * The screenshot could not catch this: the reading was `0.35 + Math.random()`,
 * so a still frame looked like a working meter and a person in a quiet room
 * watched it pin the top half of the bars. A sine at −20 dBFS and one at
 * −60 dBFS can tell the difference where a picture cannot, and they are the
 * two levels speech and a room actually sit at.
 */

const RATE = 16000;

/** A sine whose RMS is exactly `db` dBFS: peak amplitude = rms · √2. */
function sineAt(db: number, length = 160): Float32Array {
  const amplitude = 10 ** (db / 20) * Math.SQRT2;
  return Float32Array.from({ length }, (_, i) => amplitude * Math.sin((2 * Math.PI * 440 * i) / RATE));
}

/** The reading `blocks` display ticks into a signal of a known level. */
function levelOf(db: number, blocks = 10): ReturnType<LevelMeter["tick"]> {
  const meter = new LevelMeter(28);
  let reading = meter.tick();
  for (let i = 0; i < blocks; i++) {
    meter.feed(sineAt(db, 160));
    reading = meter.tick();
  }
  return reading;
}

describe("a level meter reads loudness, not presence", () => {
  it("puts a −20 dBFS sine in the upper half, not at the top", () => {
    const reading = levelOf(-20);
    expect(reading.db).toBeCloseTo(-20, 0);
    expect(reading.level).toBeGreaterThan(0.4);
    expect(reading.level).toBeLessThan(1);
  });

  it("puts a −60 dBFS sine at zero bars — below the gate", () => {
    const reading = levelOf(-60);
    expect(reading.db).toBeLessThanOrEqual(METER_GATE_DB);
    expect(reading.level).toBe(0);
    expect(reading.peak).toBe(0);
  });

  it("separates the two — the bug where every level pinned the top", () => {
    expect(levelOf(-20).level).not.toBe(levelOf(-60).level);
    expect(levelOf(-20).level).toBeGreaterThan(levelOf(-60).level);
  });

  it("holds a peak above the falling level, then lets it go", () => {
    const meter = new LevelMeter(28);
    for (let i = 0; i < 10; i++) {
      meter.feed(sineAt(-20, 160));
      meter.tick();
    }
    const loud = meter.tick();
    expect(loud.peak).toBeGreaterThan(0.4);
    let held = loud;
    for (let i = 0; i < 8; i++) held = meter.tick();
    expect(held.level).toBe(0); // the level has fallen below the gate
    expect(held.peak).toBeGreaterThan(0); // the peak is still on screen
  });

  it("clamps at full scale and never exceeds it", () => {
    expect(barsFromDb(0, 28)).toBe(28);
    expect(barsFromDb(6, 28)).toBe(28);
    expect(barsFromDb(-Infinity, 28)).toBe(0);
    expect(barsFromDb(METER_FLOOR_DB, 28)).toBe(0);
  });

  it("names the floor, so silence is the floor rather than a twitching bar", () => {
    expect(dbfs(new Float32Array(160))).toBe(-Infinity);
    expect(dbfs(sineAt(-70))).toBe(METER_FLOOR_DB);
  });
});
