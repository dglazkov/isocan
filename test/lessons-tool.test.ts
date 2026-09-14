import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collisions, nextFree, rows } from "../scripts/lessons.mjs";

/**
 * **The number is the name, so allocating it wrongly is expensive.**
 *
 * `see lessons.md #8` appears 112 times in this tree and `#5` 111 — 728
 * citations in all. A number everybody cites cannot be renamed later, which
 * makes the moment of allocation the only chance to get it right, and that
 * moment happens on a branch that cannot see the other branches.
 *
 * Nothing can prevent that collision outright short of giving up numbers,
 * which 728 citations say we will not. What can be removed is the rest of the
 * cost: `reviews.test.ts` has always caught the clash, and the afternoon went
 * on working out which number was free and which citations had quietly become
 * ambiguous. `scripts/lessons.mjs` answers both.
 */
const repo = fileURLToPath(new URL("..", import.meta.url));

describe("choosing a lesson number", () => {
  it("reads the real table, not an empty one", () => {
    // The failure this file would otherwise have: a regex that matches nothing
    // makes every assertion below it vacuously true.
    const real = rows();
    expect(real.length).toBeGreaterThan(50);
    expect(real.map((row) => row.number)).toContain(1);
  });

  it("takes the lowest FREE number, not one past the last row", () => {
    // The distinction is the whole point: a gap exists exactly when somebody
    // else's branch landed a number while yours was open.
    expect(nextFree([1, 2, 3])).toBe(4);
    expect(nextFree([1, 3, 4])).toBe(2);
    expect(nextFree([2, 3])).toBe(1);
    expect(nextFree([])).toBe(1);
  });

  it("finds two rows wearing one number", () => {
    const clash = collisions([
      { number: 51, opening: "a modification timestamp" },
      { number: 51, opening: "a selftest's mutation" },
      { number: 52, opening: "something else" },
    ]);
    expect(clash).toHaveLength(1);
    expect(clash[0]![0]).toBe(51);
    expect(clash[0]![1]).toHaveLength(2);
  });

  it("says nothing is wrong when nothing is", () => {
    expect(collisions([{ number: 1, opening: "a" }, { number: 2, opening: "b" }])).toEqual([]);
  });

  it("is named where somebody about to allocate one is looking", () => {
    // A tool nobody is told about is `lessons.md` #13: a guard that exists and
    // is invoked by nothing.
    const doc = readFileSync(path.join(repo, "docs/reviews/lessons.md"), "utf8");
    expect(doc).toContain("scripts/lessons.mjs --next");
    const guard = readFileSync(path.join(repo, "test/reviews.test.ts"), "utf8");
    expect(guard, "the failure should say what to run").toContain("scripts/lessons.mjs --check");
  });
});
