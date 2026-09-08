import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **A test that has finished can still fail on the way out.**
 *
 * Measured 8 Sep 2026, six clean sequential runs of the whole suite: one
 * failed, and the assertion had passed. The failure was
 * `ENOTEMPTY: directory not empty, rmdir '…/isocan-rc-hGlGQ0'` — `rc.test.ts`
 * removing its scratch home in `afterEach` while something the daemon started
 * was still writing into it.
 *
 * **The file it lands on is arbitrary**, which is what makes this expensive to
 * diagnose. `rc.test.ts` alone, twelve times, never failed; it only loses the
 * race with the whole suite on the machine, and on another run it will be some
 * other file. So it reads as "the suite is flaky" rather than as one thing.
 *
 * ## Why retrying is not hiding a signal
 *
 * The scratch directory is scaffolding, not the subject. Nothing here asserts
 * anything about it; it exists so the test has somewhere to put a home, and
 * the test's own claim was already proved by the time this runs.
 *
 * Node gave `fs.rm` `maxRetries` for exactly this, and retries exactly the
 * errors a race produces — `EBUSY`, `EMFILE`, `ENFILE`, `ENOTEMPTY`, `EPERM`.
 * A directory that is genuinely wedged still fails, five attempts and half a
 * second later, with its name.
 *
 * And it is not a new idea in this repository: `scripts/journeys.mjs` and
 * `scripts/lib/browser.mjs` have both removed their scratch this way for
 * days. The suite was the one place the habit had not reached — 140 call
 * sites across 99 files, every one of them the same two shapes, and not one
 * with a retry.
 *
 * ## What this guard is for
 *
 * The hundredth file. This is the shape `test/ports.ts` already has for
 * ports — *"use this rather than a local `listen(0)`, and if you find one of
 * those, move it"* — and the reason it needs enforcing rather than
 * remembering is that the cost lands on somebody else's test, on a different
 * run, months later.
 */
const here = fileURLToPath(new URL(".", import.meta.url));
const repo = path.resolve(here, "..");

/** Every test file in the suite, the same set `vitest.config.ts` includes. */
function testFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      // This file holds a deliberately-wrong call site as a fixture below, so
      // it is the one file the scan must not read. Skipped by name rather
      // than by a comment marker, because a marker is a second thing a future
      // fixture would have to remember.
      else if (entry.name.endsWith(".test.ts") && entry.name !== "teardown.test.ts") out.push(full);
    }
  };
  walk(path.join(repo, "test"));
  walk(path.join(repo, "packages"));
  return out;
}

describe("removing a scratch directory retries", () => {
  it("carries the retry at every call site in the suite", () => {
    /* A recursive removal with no retry is a race whose loser is whichever
       test happened to be holding a file — so the failure is attributed at
       random and reads as the suite being unreliable. */
    const missing: string[] = [];
    for (const file of testFiles()) {
      const src = readFileSync(file, "utf8");
      // Every `rm` that walks a tree. `force` alone does not help: it
      // suppresses "not found", not "not empty".
      for (const call of src.match(/rm(?:Sync)?\([^;]*?recursive:\s*true[^;]*?\)/gs) ?? []) {
        if (!/maxRetries/.test(call)) {
          missing.push(`${path.relative(repo, file)}: ${call.replace(/\s+/g, " ").slice(0, 90)}`);
        }
      }
    }
    expect(
      missing,
      "a recursive rm with no `maxRetries` loses to a process that is still writing — " +
        "add `maxRetries: 5, retryDelay: 100`, the same options `scripts/journeys.mjs` uses",
    ).toEqual([]);
  });

  it("can see a call site that forgot", () => {
    /* The assertion above passes today because every site was fixed at once,
       and it would pass just as happily if the matcher saw nothing. This repo
       has already deleted two guards that asserted something vacuously true. */
    const forgot = `await fs.rm(home, { recursive: true, force: true })`;
    expect(/rm(?:Sync)?\([^;]*?recursive:\s*true[^;]*?\)/s.test(forgot)).toBe(true);
    expect(/maxRetries/.test(forgot)).toBe(false);
    const fixed = `await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })`;
    expect(/maxRetries/.test(fixed)).toBe(true);
  });

  it("finds the suite's test files at all", () => {
    // The walk is the other way this could pass vacuously.
    expect(testFiles().length).toBeGreaterThan(300);
  });
});
