import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repo = fileURLToPath(new URL("..", import.meta.url));

/**
 * **A CSS rule body that already exists word for word, as a thing that can
 * redden a commit.**
 *
 * The reviewer persona has declared `at most: 47` since 30 August. On 31
 * August it measured 49, and it said so every night after: 48, 53, 53, 56,
 * **60**. Six nights, six reports, one number climbing, and nothing failed —
 * because the only reader was the nightly, and a nightly report is not a
 * commit failing.
 *
 * That is the third metric to arrive at this same finding. `bundle-bytes`
 * went 600,420 → 768,993 unremarked; `unused-exports` went 0 → 56 with the
 * bound sitting at its floor the whole time. The lesson `docs/reviews/
 * README.md` writes for exactly this case — *"a finding that keeps
 * reappearing is a finding that needs a guard, not a third mention"* — was on
 * its sixth mention when this file was written.
 *
 * ## Why a copied rule is worth counting at all
 *
 * `measure.mjs`'s own words: each one is "a copy that cannot notice when the
 * next copy is forgotten". Two rules with the same body are one decision
 * written twice, and the day somebody changes the colour in one of them is
 * the day the sheet quietly disagrees with itself. This repository has paid
 * that bill in the visible way already — the paper swatches, where two
 * same-specificity selectors and source order decided which one a person
 * actually saw.
 *
 * ## What the sixty actually are, having looked
 *
 * The measure's own note says a rise is "a question, not a verdict: is this
 * one thing written twice, or two things that agree?" Asked, on 6 September,
 * and the answer is mostly the second — which is why this ceiling moved by one
 * and not by thirteen.
 *
 * `.btn.primary`, `.btn.active`, `.tool-btn.active`, `.stage-editor-btn.primary`,
 * `.wb-follow.on` and `.sprint-action.primary` all carry
 * `background/border-color/color: var(--accent…)`. Six different controls
 * agreeing about what "on" looks like is a vocabulary, not a copy, and the
 * sheet already refuses the merge in those words: a selector list spanning
 * them "would be one rule pretending two different elements are the same
 * element. The values are what agree, not the code." The same is true of the
 * flex-row and flex-column bodies that account for most of the rest: three
 * menus being flex columns is three menus, not one menu written three times.
 *
 * **One was the first kind and is now merged.** `.conn.reconnecting::before`
 * and `.conn.offline::before` are the same element in two states wearing the
 * same dot for the same reason — adjacent in the sheet, separated only by the
 * comment explaining why offline is not an error. That is one treatment
 * written twice, and it is one rule now.
 *
 * Three more look like the first kind and were left alone deliberately: the
 * `.face-mark` sizing repeated across three roster rows, and `.item.ink` /
 * `.item.textnode`'s chromeless body. Merging those means moving a rule
 * thousands of lines, and **source order in this sheet has already cost a
 * day**: the paper swatches were invisible because two same-specificity
 * selectors resolved by which came later. They want a person with the app in
 * front of them, not a script.
 *
 * ## Why the ceiling is 59 and not 47
 *
 * Because 47 is the goal and 59 is the truth, and a test asserting the goal
 * would fail on every commit from the moment it landed. That is not a guard,
 * it is a red trunk — the trade `test/bundle-budget.test.ts` reasons through
 * at length and settles the same way. So this asserts **no worse than the
 * last number somebody agreed to**, and prints the distance to the goal
 * rather than enforcing it.
 *
 * Lowering `CEILING` as duplicates go is the point, and raising it is allowed
 * — one line, in the diff, with a reason beside it. What must not happen
 * again is thirteen copies arriving as thirteen unremarked commits.
 *
 * The number comes from the same `scripts/measure.mjs` the persona declares,
 * never a second copy of the scan (`docs/reviews/lessons.md` #5): a guard
 * that measures differently from the instrument it guards is two numbers
 * with one name.
 */
const CEILING = 59;
const GOAL = 47;

describe("CSS rule bodies copied word for word", () => {
  it("is no more than the last number somebody agreed to", () => {
    const measured = Number(
      execFileSync("node", [path.join(repo, "scripts/measure.mjs"), "copied-rules"], {
        cwd: repo,
        encoding: "utf8",
        timeout: 120_000,
      }).trim(),
    );
    expect(Number.isFinite(measured), "measure.mjs did not answer a number").toBe(true);

    const overGoal = measured - GOAL;
    expect(
      measured,
      `${measured} CSS rule bodies are copied word for word from elsewhere in the sheet, past the ` +
        `agreed ${CEILING}` +
        (overGoal > 0 ? ` (${overGoal} over the ${GOAL} goal)` : "") +
        ".\n" +
        "  Each copy is a decision written twice, and it cannot notice when the next copy is\n" +
        "  forgotten — which is how a stylesheet comes to disagree with itself.\n" +
        "  Fold the duplicate into the rule it repeats, or raise CEILING here and say why.\n" +
        "  Which ones: node scripts/measure.mjs copied-rules --names",
    ).toBeLessThanOrEqual(CEILING);
  }, 120_000);
});
