import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repo = fileURLToPath(new URL("..", import.meta.url));

/**
 * **An export with no comment above it, as a thing that can redden a commit.**
 *
 * The third of the reviewer persona's three ratchets, and the one that ran
 * furthest while nobody was reading: `at most: 253`, and it went 304, 307,
 * 301, 312, 344, **361**. A hundred and eight undocumented exports arrived
 * across six nights that each reported the growth accurately and stopped
 * anything not at all.
 *
 * ## Why this one is a ratchet and not a rule
 *
 * Because "every export has a comment" is not this project's rule and should
 * not become one by accident. `AGENTS.md` asks for comments that carry the
 * REASONING — what was wrong, what it cost, why the fix is shaped this way —
 * and a codebase that answers a counter by writing a doc comment reading
 * "The id." above a field named `id` has satisfied the number and lost the
 * point. That failure is worse
 * than the gap, because it is invisible to the instrument that caused it.
 *
 * So this guard is deliberately weak about the past and strict about the
 * future: it does not ask anybody to document 361 exports, it asks that the
 * 362nd arrive with a sentence. The goal stays printed, and the distance to
 * it stays visible, because the number falling is a good thing to see when it
 * happens for the right reason.
 *
 * ## Why the ceiling is 361
 *
 * It is the measurement at the commit that added this file — the same trade
 * `test/bundle-budget.test.ts` and `test/unused-exports.test.ts` make, for
 * the same reason: a test asserting the goal would redden the trunk on every
 * commit and be turned off within the day.
 *
 * Measured through `scripts/measure.mjs`, the instrument the persona itself
 * declares, so the suite and the nightly can never answer differently for one
 * name (`docs/reviews/lessons.md` #5).
 */
const CEILING = 361;
const GOAL = 253;

describe("exports with no comment above them", () => {
  it("is no more than the last number somebody agreed to", () => {
    const measured = Number(
      execFileSync("node", [path.join(repo, "scripts/measure.mjs"), "undocumented-exports"], {
        cwd: repo,
        encoding: "utf8",
        timeout: 120_000,
      }).trim(),
    );
    expect(Number.isFinite(measured), "measure.mjs did not answer a number").toBe(true);

    const overGoal = measured - GOAL;
    expect(
      measured,
      `${measured} exports have no comment above them, past the agreed ${CEILING}` +
        (overGoal > 0 ? ` (${overGoal} over the ${GOAL} goal)` : "") +
        ".\n" +
        "  An export is read by somebody who did not write it; the comment is where the reason\n" +
        "  lives, and the reason is the half that cannot be recovered from the code.\n" +
        "  Write the sentence — what it is FOR, not what it is — or raise CEILING here and say why.\n" +
        "  A comment written only to satisfy this number is worse than the gap it closes.\n" +
        "  Which ones: node scripts/measure.mjs undocumented-exports --names",
    ).toBeLessThanOrEqual(CEILING);
  }, 120_000);
});
