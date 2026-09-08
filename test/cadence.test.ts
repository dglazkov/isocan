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

  it("reads the workflow that actually fires them", () => {
    // The other half of the reconciliation, and the half that can rot
    // silently: if this stops finding the schedule, every row below reads
    // "declares a cron nothing fires" and the guard becomes noise.
    expect(firedCrons(), "the nightly's schedule is readable").not.toEqual([]);
    for (const cron of firedCrons()) expect(cron).toMatch(/^[\d*,/ -]+$/);
  });

  /**
   * **A ratchet, not a bound, and the difference is honest.**
   *
   * `journeys` declares `17 7 * * 1` and runs nightly, so this is red on
   * arrival — and a guard that is red on arrival is a red trunk rather than a
   * guard (`test/bundle-budget.test.ts` made the same call for the same
   * reason). Whether the journeys should walk weekly or nightly is a decision
   * about cost, not a typo, and #206's phase 1 exists to put it in front of
   * somebody rather than to answer it.
   *
   * What the number stops is a TENTH persona joining it quietly.
   */
  const AGREED_MISMATCHES = 1;

  it(`has no more than ${AGREED_MISMATCHES} declaring a cron nothing fires`, () => {
    const mismatched = cadenceRows()
      .filter((r: { verdict: string }) => r.verdict === "declares a cron nothing fires")
      .map((r: { name: string; cron: string }) => `${r.name} says ${r.cron}`);
    expect(
      mismatched.length,
      `${mismatched.join("; ")} — the workflow fires ${firedCrons().join(", ")}. ` +
        "Either the file is wrong, or the schedule is; lowering this number is how you win.",
    ).toBeLessThanOrEqual(AGREED_MISMATCHES);
  });

  it("can see a mismatch, rather than passing because it looks at nothing", () => {
    /* The three assertions above are about a set that is nearly empty, and a
       guard whose subject is usually empty has to show it can still see. This
       repo has deleted two that asserted something vacuously true. */
    const rows = cadenceRows();
    expect(rows.length, "there are personas to read").toBeGreaterThan(5);
    expect(rows.some((r: { verdict: string }) => r.verdict === "declares a cron nothing fires")).toBe(true);
    expect(rows.every((r: { name: string }) => typeof r.name === "string")).toBe(true);
  });
});
