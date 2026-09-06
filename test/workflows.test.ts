import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL("../.github/workflows", import.meta.url));
const files = readdirSync(dir).filter((f) => /\.ya?ml$/.test(f));
const read = (f: string) => readFileSync(`${dir}/${f}`, "utf8");

/**
 * **A workflow that runs the suite must check out the history the suite
 * reads.**
 *
 * `actions/checkout` defaults to `fetch-depth: 1`, and the suite is not a
 * pure function of the working tree: `changelog-day.mjs` asks `git log` what
 * landed on a day, and `changelog.test.ts` drives it against the earliest
 * entry. On a depth-1 clone that day has no commits in view, so the generator
 * answers "nothing landed" where the test expects "already written".
 *
 * This is written down because of how it happened. `release.yml` has carried
 * `fetch-depth: 0` since it was written — for a completely unrelated reason,
 * stated beside it: it pushes a release commit naming two parents by sha, and
 * a shallow clone cannot push a history it does not have. When `pr.yml` was
 * added on 6 September it shared everything the two files have in common
 * through a composite action, deliberately, with a comment saying the drift
 * that matters is this file falling behind that one. **A checkout cannot live
 * in a composite action**, so it was the one step that could not be shared —
 * and the reason written next to it in `release.yml` was not the reason the
 * suite needs it, so copying it did not look necessary. The suite went red on
 * the first pull request that ran it.
 *
 * The general shape, and the reason this is a test rather than a third
 * comment: **two files kept in step by a comment are two files that will
 * drift.** The bit that is shared is shared; the bit that cannot be is
 * asserted.
 */
describe("every workflow that runs the suite", () => {
  /** A workflow runs the suite if it invokes vitest, directly or through the
   * npm script that does. Found rather than listed, so a third one added next
   * month is covered without anybody remembering this file. */
  const runsSuite = files.filter((f) => /vitest|npm (run )?test\b/.test(read(f)));

  it("finds them at all — a search over nothing always passes", () => {
    expect(runsSuite.length, "no workflow appears to run the suite").toBeGreaterThan(0);
  });

  it("checks out the whole history, because the suite reads it", () => {
    const shallow = runsSuite.filter((f) => !/fetch-depth:\s*0/.test(read(f)));
    expect(
      shallow,
      "these run the suite on a shallow checkout. `actions/checkout` defaults to depth 1, and " +
        "`changelog.test.ts` drives `changelog-day.mjs`, which asks git log what landed on a day — " +
        "a day a depth-1 clone cannot see. Add `with: { fetch-depth: 0 }` to the checkout.",
    ).toEqual([]);
  });
});
