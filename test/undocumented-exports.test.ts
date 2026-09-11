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
 * future: it does not ask anybody to document every export, it asks that the
 * next one arrive with a sentence. The goal stays printed, and the distance to
 * it stays visible, because the number falling is a good thing to see when it
 * happens for the right reason.
 *
 * ## What the first hundred-and-eight would have been, and what was done
 *
 * 361 → 331 on 6 September, by documenting `protocol.ts` — thirty wire types
 * with well-documented FIELDS and nothing saying what the exchange was FOR.
 * That file is the contract both surfaces speak, so a reader arriving at
 * `RcHoldRequest` or `ParkClaimResponse` and finding only field comments has
 * to reconstruct the conversation from its parts. Those thirty were worth
 * thirty sentences.
 *
 * **The remaining 78 to the goal were deliberately not written.** The next
 * cluster is `ids.ts` — `newItemId`, `newVersionId`, `newThreadId` — and a
 * comment reading "makes a new item id" above `newItemId` is exactly the
 * failure this file names below: it satisfies the counter and leaves the
 * codebase worse, because now there is a comment to keep in step with a name
 * that already said everything. `paths.ts` is the same: `canvasFile`,
 * `oplogFile`, `blobsDir` are a layout, and the layout wants one header, not
 * fifteen restatements.
 *
 * So the number moved by the amount that had something to say. That is the
 * measure working as intended: it asked, somebody read, and the answer was
 * "thirty of these, not a hundred and eight".
 *
 * **331 → 315 on 10 Sep 2026, by documenting the model and the vocabulary.**
 * `model.ts` and `ops.ts` are the other half of the contract `protocol.ts`
 * is: what a canvas, an item, a version and an operation ARE, as both
 * surfaces hold them. Seven types and a constructor in the model and seven
 * types in the vocabulary had nothing saying what they were for — `Operation`
 * among them, the one type the isomorphism is written against. The sixteenth
 * is `overlaps`, which #228 named as owed along with `VisualFace`.
 *
 * Done for room rather than tidiness. A ratchet sitting exactly at its
 * ceiling reddens on the next bare export, and 332 would also have outgrown
 * the answer covering the reviewer's finding (accepted at 301, so good to
 * 331.1 and no further) — one export turning one red test into four. Sixteen
 * sentences that each say something is the honest way to buy that room;
 * raising the ceiling was the other way.
 *
 * ## Why the ceiling is 315
 *
 * It is the measurement after the second pass — the same trade
 * `test/bundle-budget.test.ts` and `test/unused-exports.test.ts` make, for
 * the same reason: a test asserting the goal would redden the trunk on every
 * commit and be turned off within the day.
 *
 * Measured through `scripts/measure.mjs`, the instrument the persona itself
 * declares, so the suite and the nightly can never answer differently for one
 * name (`docs/reviews/lessons.md` #5).
 */
const CEILING = 315;
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
