import { describe, expect, it } from "vitest";
// @ts-expect-error — a .mjs script with no types, imported for its parser on
// purpose: a second copy of "what `unanswered` means" is the thing this guard
// exists to prevent one level up.
import { ANSWER_DAYS, findUnanswered, reviewPages } from "../scripts/reviews.mjs";

/**
 * **The queue can fail.**
 *
 * Phase 3 of `docs/research/2026-09-06-agents-you-can-trust.md` (#197), and
 * the item that note calls its highest-value one.
 *
 * The cheap tier already works. Nine personas run nightly, each measuring a
 * named number against a declared bound, each writing its findings as
 * `(number, bound, verdict)` rows with an `unanswered` / `accepted` /
 * `rejected` column that IS a handoff protocol to something more expensive.
 *
 * And on 6 September 2026 it failed exactly: **26 findings sat `unanswered`
 * across six nights** while the entry chunk one of them described went
 * 600,420 → 768,993. Every report was correct. Every report was written. The
 * column was ignorable, so it was decorative — and the reports piled up in
 * unmerged pull requests where they were, functionally, never written at all.
 *
 * The model to copy was already in the building: the bundle bound became *a
 * number that can redden a commit* and stopped drifting the same week. This
 * is that shape applied to the queue itself.
 *
 * ## Why this could be a bound and not a ratchet
 *
 * `test/bundle-budget.test.ts` had to assert "no worse than the last agreed
 * number", because its goal was already missed the day it landed and a guard
 * that is red on arrival is a red trunk, not a guard.
 *
 * This one asserts **zero**, because the queue was drained to zero on
 * 6 September before it was written. That timing is the whole reason it can
 * be honest: the next time findings pile up, this same test could only have
 * been added as a ratchet at whatever the pile happened to be. A guard is
 * cheapest to install at the moment the thing it guards is already true.
 */
describe("no finding sits unanswered", () => {
  it(`is answered within ${ANSWER_DAYS} days, or it reddens this`, () => {
    const late = findUnanswered(reviewPages());
    expect(
      late.map((f: { file: string; age: number; what: string }) => `${f.file} (${f.age}d): ${f.what}`),
      late.length === 0
        ? ""
        : `${late.length} finding${late.length === 1 ? " has" : "s have"} gone unanswered past ` +
          `${ANSWER_DAYS} days — the oldest is ${late[0].age} days old.\n` +
          `  Answering one is a single word in its Outcome cell: \`accepted\` or \`rejected\`, ` +
          `with the reason beside it.\n` +
          `  A finding that keeps reappearing wants a guard rather than a third mention ` +
          `(docs/reviews/README.md).\n` +
          `  Then run \`node scripts/reviews.mjs\` so the index agrees.`,
    ).toEqual([]);
  });

  /**
   * The three tests below are about the DETECTOR, not the queue.
   *
   * The assertion above passes today because the queue is empty — and it would
   * pass just as happily if `findUnanswered` always returned nothing. This
   * repo has already deleted two guards that asserted something vacuously
   * true, so a guard whose subject is usually empty has to demonstrate that it
   * can still see.
   */
  const page = (date: string, outcome: string) => [
    {
      file: `${date}-fixture.md`,
      date,
      persona: "fixture",
      goals: [],
      findings: [{ what: "the fixture's number is 9, past 1", outcome }],
    },
  ];
  const now = new Date("2026-09-10T12:00:00Z");

  it("catches a finding that has aged past the bound, and says which", () => {
    const late = findUnanswered(page("2026-09-01", "unanswered"), ANSWER_DAYS, now);
    expect(late).toHaveLength(1);
    expect(late[0].file).toBe("2026-09-01-fixture.md");
    expect(late[0].age).toBe(9);
    // The words of the finding travel with it: a failure that says only "1
    // unanswered" sends a person to grep, which is the friction that turns a
    // guard into something people disable.
    expect(late[0].what).toContain("past 1");
  });

  it("leaves tonight's run alone", () => {
    // A persona files a finding at 2am; the guard must not redden the first
    // commit of the morning. `ANSWER_DAYS` is a grace period, and the boundary
    // is the half of it that gets tested wrong.
    expect(findUnanswered(page("2026-09-10", "unanswered"), ANSWER_DAYS, now)).toEqual([]);
    expect(findUnanswered(page("2026-09-07", "unanswered"), ANSWER_DAYS, now)).toEqual([]);
    // Exactly one day past the grace period is the first day that counts.
    expect(findUnanswered(page("2026-09-06", "unanswered"), ANSWER_DAYS, now)).toHaveLength(1);
  });

  it("counts anything that is not a decision as unanswered", () => {
    // The direction that matters, and the one the first draft got backwards.
    // Asking `outcome === "unanswered"` fails OPEN: `unanswered — the metric
    // was retired` is plainly unanswered and was invisible to both the index
    // and this guard. Asking for the decision instead fails closed, so a typo
    // makes the queue louder rather than shorter.
    for (const outcome of ["unanswered", "unanswered — still thinking", "", "TBD", "acepted"]) {
      expect(
        findUnanswered(page("2026-09-01", outcome), ANSWER_DAYS, now),
        `"${outcome}" is not a decision and must still be in the queue`,
      ).toHaveLength(1);
    }
  });

  it("never chases a finding somebody has already answered", () => {
    // The queue is not a backlog to be cleared for tidiness. An `accepted`
    // finding stays on the page as the record of what was decided, however
    // old, and this guard must never create pressure to delete it.
    expect(findUnanswered(page("2026-01-01", "accepted — guarded from today"), ANSWER_DAYS, now)).toEqual([]);
    expect(findUnanswered(page("2026-01-01", "rejected — measures evidence, not proof"), ANSWER_DAYS, now)).toEqual([]);
  });
});
