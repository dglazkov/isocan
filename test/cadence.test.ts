import { describe, expect, it } from "vitest";
// @ts-expect-error — a .mjs script with no types, imported for its reading on
// purpose: a second copy of "how many times does this file declare a trigger"
// is the thing this guard exists to prevent one level up.
import { cadenceRows, declaredTriggers, firedCrons } from "../scripts/cadence.mjs";

/**
 * **A persona's cadence is a claim, and until now nothing checked it.**
 *
 * #206 phase 1. `trigger` is read by exactly two things in this tree —
 * `isocan persona ls` and the board's panel — and **both only display it**.
 * `.github/workflows/persona.yml` holds one hardcoded cron and runs
 * `persona-run.mjs --all`, which filters on nothing. So a persona could say
 * anything at all about when it runs and be believed by every reader and
 * contradicted by the machine.
 *
 * Three of nine were wrong on 7 Sep 2026, and none of them could have been
 * noticed:
 *
 * - **`design-auditor` declared `trigger` twice.** YAML takes the last key, so
 *   `parsePersona` returned 08:23 while the workflow ran it at 08:43, and the
 *   08:43 line written above it was dead text in a file whose entire job is to
 *   say when this runs.
 * - **`market-researcher` declared nothing**, so `readTrigger` called it
 *   `manual` — while it wrote a page every night for nine nights.
 * - **`journeys` declares Mondays and runs nightly** with the rest.
 */
describe("what a persona says about when it runs", () => {
  it("says it once", () => {
    /**
     * Counted from the RAW front matter, because the parser is the thing that
     * cannot tell: it builds a map, so a key written twice is silently the
     * last one. Asking `parsePersona` how many triggers a file has would be
     * asking the mechanism that lost the information.
     */
    const twice = [...declaredTriggers()]
      .filter(([, d]: [string, { count: number }]) => d.count > 1)
      .map(([name]: [string]) => name);
    expect(
      twice,
      "a second `trigger:` silently wins and the first becomes dead text — delete one",
    ).toEqual([]);
  });

  it("says it at all, if it runs", () => {
    /* An undeclared trigger reads as `manual` everywhere it is shown, which is
       a lie about a persona the nightly runs. Gated on having actually run, so
       a persona written today and not yet scheduled is not a failure. */
    const silentlyScheduled = cadenceRows()
      .filter((r: { lastRan: string | null; declaredTimes: number }) => r.lastRan && r.declaredTimes === 0)
      .map((r: { name: string }) => r.name);
    expect(silentlyScheduled, "it has run, so it has a cadence — write it down").toEqual([]);
  });

  it("reads EVERY workflow that fires a persona, not just the nightly", () => {
    /**
     * The other half of the reconciliation, and the half that can rot
     * silently: if this stops finding a schedule, every row below reads
     * "declares a cron nothing fires" and the guard becomes noise.
     *
     * It did exactly that on the day it was written. `journeys` has its OWN
     * workflow, so reading only `persona.yml` reported it as declaring a cron
     * nothing fires — when the cron it declared was fired, on schedule, by a
     * file the reading was not looking at. **A reading that cannot see half
     * the schedule invents drift**, which is worse than not reading at all.
     */
    const fires = firedCrons();
    expect(fires.size, "at least one schedule is readable").toBeGreaterThan(0);
    for (const [cron] of fires) expect(cron).toMatch(/^[\d*,/ -]+$/);
    expect(
      new Set(fires.values()).size,
      "more than one workflow schedules something — read them all",
    ).toBeGreaterThan(1);
  });

  /**
   * **Zero, and it was one for an afternoon.**
   *
   * This shipped as a ratchet at 1, because `journeys` read as declaring a
   * cron nothing fires — and it turned out the reading was wrong rather than
   * the persona: `journeys.yml` was firing it and `firedCrons` was only
   * looking at `persona.yml`. Fixing the reading took it to zero on its own,
   * which is the better outcome and the one worth remembering: **a ratchet
   * left above its floor can be hiding a broken instrument rather than an
   * accepted debt.**
   */
  const AGREED_MISMATCHES = 0;

  it(`has no more than ${AGREED_MISMATCHES} declaring a cron nothing fires`, () => {
    const mismatched = cadenceRows()
      .filter((r: { verdict: string }) => r.verdict === "declares a cron nothing fires")
      .map((r: { name: string; cron: string }) => `${r.name} says ${r.cron}`);
    expect(
      mismatched.length,
      `${mismatched.join("; ")} — the workflows fire ` +
        [...firedCrons()].map(([cron, file]) => `${cron} (${file})`).join(", ") +
        ". " +
        "Either the file is wrong, or the schedule is; lowering this number is how you win.",
    ).toBeLessThanOrEqual(AGREED_MISMATCHES);
  });

  it("can see a mismatch, on a tree where one exists", () => {
    /**
     * The assertions above are about a set that is now empty, and a guard
     * whose subject is empty has to show it can still see — this repo has
     * deleted two that asserted something vacuously true.
     *
     * Built from synthetic readings rather than from the real tree, because
     * the first version of this control asserted that a real mismatch EXISTS,
     * which passed only while something was broken and failed the moment it
     * was fixed. A control that needs a live defect is not a control.
     */
    const rows = cadenceRows(new Date("2026-09-08T00:00:00Z"), {
      declared: new Map([
        ["punctual", { count: 1, persona: { trigger: { kind: "schedule", cron: "43 8 * * *" } } }],
        ["adrift", { count: 1, persona: { trigger: { kind: "schedule", cron: "9 4 * * 3" } } }],
        ["twice", { count: 2, persona: { trigger: { kind: "schedule", cron: "43 8 * * *" } } }],
        ["silent", { count: 0, persona: { trigger: undefined } }],
      ]),
      fires: new Map([["43 8 * * *", "persona.yml"]]),
      last: new Map([["punctual", "2026-09-07"], ["adrift", "2026-09-07"], ["twice", "2026-09-07"], ["silent", "2026-09-07"]]),
    });
    const verdict = (name: string) => rows.find((r: { name: string }) => r.name === name)?.verdict;
    expect(verdict("punctual")).toBe("agrees");
    expect(verdict("adrift")).toBe("declares a cron nothing fires");
    expect(verdict("twice")).toBe("declared twice");
    expect(verdict("silent")).toBe("runs, declares nothing");
    expect(rows.find((r: { name: string }) => r.name === "punctual")?.firedBy).toBe("persona.yml");
    expect(rows.find((r: { name: string }) => r.name === "punctual")?.ageDays).toBe(1);
  });
});
