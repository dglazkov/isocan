import { describe, expect, it } from "vitest";
// @ts-expect-error — a .mjs script with no types, imported for its parser on
// purpose: a second copy of "what `unanswered` means" is the thing this guard
// exists to prevent one level up.
import { ANSWER_DAYS, WORSE_BY, findUnanswered, findingKey, reviewPages } from "../scripts/reviews.mjs";

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

/**
 * **The same question, asked again every night.**
 *
 * A persona writes one finding per missed goal per run, so a bound that stays
 * missed writes a new `unanswered` row every night. Answered row by row that is
 * a daily chore for a question nobody's answer changed — and a guard that nags
 * every morning is a guard somebody turns off, which would undo the whole
 * point of making the queue able to fail.
 *
 * This is what makes it safe to let the nightly reports reach `main` at all.
 */
describe("an answer covers the nights that repeat it", () => {
  const page = (date: string, what: string, outcome: string) => ({
    file: `${date}-fixture.md`,
    date,
    persona: "fixture",
    goals: [],
    findings: [{ what, outcome }],
  });
  const now = new Date("2026-09-20T12:00:00Z");
  const chunk = (n: number) => `the entry chunk a first visit downloads is ${n}, past 640000`;

  it("identifies a bound-finding by its goal and bound, not its text", () => {
    // The value moves nightly; the question does not.
    expect(findingKey(chunk(722753))).toMatchObject({ goal: "the entry chunk a first visit downloads", bound: "640000" });
    expect(findingKey(chunk(722753))?.value).toBe(722753);
  });

  it("has no identity for a finding somebody wrote in their own words", () => {
    // Prose is asked once and answered once; there is nothing to match it to.
    expect(findingKey("the header row jumps 7px on select")).toBeNull();
  });

  it("lets one answer stand for later nights at the same bound", () => {
    const pages = [
      page("2026-09-01", chunk(700000), "accepted — splitting is spent, tracked in #185"),
      page("2026-09-02", chunk(701000), "unanswered"),
      page("2026-09-03", chunk(702000), "unanswered"),
    ];
    expect(findUnanswered(pages, ANSWER_DAYS, now)).toEqual([]);
  });

  it("asks again when the number gets materially worse", () => {
    /**
     * The failure this whole file exists for: 600,420 → 768,993 across six
     * nights while every report said MISSED. Identity alone would have let one
     * early "accepted" cover all six — a treadmill fixed by inducing a coma.
     *
     * That drift was +28%, so it has to be asked again. This is the case that
     * proves the bound catches the thing it was written for.
     */
    const pages = [
      page("2026-09-01", chunk(600420), "accepted — the split is planned"),
      page("2026-09-06", chunk(768993), "unanswered"),
    ];
    const late = findUnanswered(pages, ANSWER_DAYS, now);
    expect(late).toHaveLength(1);
    expect(late[0].what).toContain("768993");
  });

  it("holds the worse-by boundary on both sides", () => {
    const covered = [page("2026-09-01", chunk(100000), "accepted"), page("2026-09-06", chunk(100000 * (1 + WORSE_BY)), "unanswered")];
    expect(findUnanswered(covered, ANSWER_DAYS, now), "exactly at the line is still covered").toEqual([]);
    const past = [page("2026-09-01", chunk(100000), "accepted"), page("2026-09-06", chunk(100000 * (1 + WORSE_BY) + 1), "unanswered")];
    expect(findUnanswered(past, ANSWER_DAYS, now), "a hair past it is asked again").toHaveLength(1);
  });

  it("measures drift from the smallest number anybody said yes to", () => {
    /* Otherwise a series of small accepted steps launders a large one: answer
       at 100k, again at 109k, again at 119k, and nothing is ever "materially
       worse" than the step before it. The question a person answered was about
       the number in front of them. */
    const pages = [
      page("2026-09-01", chunk(100000), "accepted"),
      page("2026-09-02", chunk(109000), "accepted"),
      page("2026-09-03", chunk(118000), "unanswered"),
    ];
    expect(findUnanswered(pages, ANSWER_DAYS, now)).toHaveLength(1);
  });

  it("does not let an answer for one goal cover another", () => {
    const pages = [
      page("2026-09-01", chunk(700000), "accepted"),
      page("2026-09-02", "CSS rule bodies copied word for word from elsewhere is 60, past 47", "unanswered"),
    ];
    expect(findUnanswered(pages, ANSWER_DAYS, now)).toHaveLength(1);
  });

  it("asks again when somebody tightens the bound", () => {
    // A new bound is a new question — which is what makes tightening one an
    // act with a consequence rather than a note.
    const pages = [
      page("2026-09-01", chunk(700000), "accepted"),
      page("2026-09-02", "the entry chunk a first visit downloads is 700000, past 600000", "unanswered"),
    ];
    expect(findUnanswered(pages, ANSWER_DAYS, now)).toHaveLength(1);
  });
});
