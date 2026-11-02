import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { kindOf, median, read, record, summarize, type RunRecord } from "./timings.ts";

/**
 * **The instrument, and the rule that it must never be the reason a run fails.**
 *
 * Timing is a convenience: it tells somebody which kind of run is getting
 * slower, and `scripts/timings.mjs --ci` tells them which CI step to shorten
 * first. A suite that went red because it could not append a line to a file
 * would have turned a convenience into a liability, so every path here
 * swallows its own trouble — and that has to be asserted, because "silently
 * does nothing wrong" is exactly the property nobody notices breaking.
 */
const repo = fileURLToPath(new URL("..", import.meta.url));
const at = (minutes: number): string => new Date(Date.UTC(2026, 8, 13, 12, minutes)).toISOString();
const run = (over: Partial<RunRecord> = {}): RunRecord => ({
  at: at(0), lane: "fast", filtered: false, files: 500, tests: 5000, failed: 0, ms: 100_000, ...over,
});

describe("runs record how long they took", () => {
  it("round-trips a run through a file", () => {
    const file = path.join(mkdtempSync(path.join(os.tmpdir(), "timings-")), "t.jsonl");
    record(run({ ms: 1234 }), file);
    record(run({ ms: 5678, lane: "deep" }), file);
    expect(read(file).map((one) => one.ms)).toEqual([1234, 5678]);
  });

  it("never throws, whatever the file is doing", () => {
    /**
     * **A file standing where a directory has to be** — ENOTDIR, which every
     * platform gives quickly and identically.
     *
     * This asked for `/proc/definitely/not/writable/t.jsonl` and hung CI for
     * three runs. On macOS `/proc` does not exist, so `mkdirSync` fails in
     * microseconds and the case passed in 2ms on the machine it was written
     * on. On Linux `/proc` is a live procfs mount, and recursive mkdir into
     * it does not fail fast — the file never finished, vitest never exited,
     * and the job was killed at its 20-minute timeout with no output to say
     * why. `green` stopped advancing at the commit that added it.
     *
     * The lesson is not about `/proc`. It is that a test which reaches for a
     * "surely impossible" path is naming a platform it did not think it was
     * naming — and the CI platform is the one it will be wrong about, because
     * it is the one nobody runs while writing.
     */
    const dir = mkdtempSync(path.join(os.tmpdir(), "timings-"));
    const blocked = path.join(dir, "not-a-directory");
    writeFileSync(blocked, "");
    expect(() => record(run(), path.join(blocked, "t.jsonl"))).not.toThrow();
    expect(read(path.join(blocked, "t.jsonl"))).toEqual([]);
    expect(read(path.join(dir, "never-written.jsonl"))).toEqual([]);
  });

  it("skips a half-written line rather than losing the file to it", () => {
    // A killed run can leave one. The rest of the history is still true.
    const file = path.join(mkdtempSync(path.join(os.tmpdir(), "timings-")), "t.jsonl");
    record(run({ ms: 10 }), file);
    writeFileSync(file, `${readFileSync(file, "utf8")}{"at":"broken`, { flag: "w" });
    record(run({ ms: 20 }), file);
    expect(read(file).map((one) => one.ms)).toEqual([10, 20]);
  });

  it("tells the kinds of run apart, because they are not comparable", () => {
    expect(kindOf(run({ filtered: true }))).toBe("filtered");
    expect(kindOf(run({ lane: "deep" }))).toBe("deep");
    expect(kindOf(run({ lane: "deep", shard: "1/4" }))).toBe("deep shard");
    // A filtered run is somebody asking one question; averaging it with the
    // gate would make the gate look fast and the question look slow.
    expect(kindOf(run({ filtered: true, lane: "deep" }))).not.toBe("deep");
  });

  it("reports the middle rather than the mean, so one bad run is not the story", () => {
    expect(median([1, 2, 3])).toBe(2);
    expect(median([1, 2, 3, 100])).toBe(3);
    expect(median([])).toBe(0);
  });

  it("says something useful with nothing to say", () => {
    expect(summarize([])).toContain("no runs recorded");
  });

  it("names each kind, its middle, its worst and its last", () => {
    const report = summarize([run({ ms: 90_000 }), run({ ms: 190_000, lane: "deep" }), run({ ms: 1_000, filtered: true })]);
    expect(report).toContain("fast");
    expect(report).toContain("deep");
    expect(report).toContain("filtered");
    expect(report).toMatch(/median/);
  });
});

describe("the instrument is wired to the runs that already happen", () => {
  const config = readFileSync(path.join(repo, "vitest.config.ts"), "utf8");

  it("records from the config, so no command has to be remembered", () => {
    // A wrapper script would measure the runs that went through the wrapper
    // and miss every bare `npx vitest`, which is most of what gets typed.
    expect(config).toContain('reporters: ["default", "./test/timing-reporter.ts"]');
  });

  it("keeps the default reporter, because the person still wants their output", () => {
    expect(config).toMatch(/reporters: \["default"/);
  });

  it("writes where nothing is committed, so it cannot become a conflict", () => {
    // A committed timings file would be written by every run and conflict on
    // every rebase — the exact problem `scripts/mergegen.mjs` exists to fix
    // one directory over.
    const ignored = readFileSync(path.join(repo, ".gitignore"), "utf8");
    expect(ignored).toMatch(/^\.isocan\/$/m);
    expect(readFileSync(path.join(repo, "test/timings.ts"), "utf8")).toContain('".isocan", "timings.jsonl"');
  });
});
