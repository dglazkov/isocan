import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("..", import.meta.url));

/**
 * `docs/reviews/README.md`'s table is the memory the persona arrangement runs
 * on — the README says a run "reads before it looks" so it can say "still
 * true", "fixed" or "worse" instead of rediscovering. Hand-kept, it fell four
 * run-days behind between 24 Aug and 1 Sep, so every run in that stretch
 * opened an index that ended before the previous week.
 *
 * A generated index nothing checks goes stale by a slower route, which is why
 * this exists beside `roadmap.test.ts` and says the same thing.
 */
describe("the review index is derived, not written", () => {
  it("is current — run `node scripts/reviews.mjs`", () => {
    const out = execFileSync("node", [`${repo}/scripts/reviews.mjs`, "--check"], {
      cwd: repo,
      encoding: "utf8",
      timeout: 60_000,
    });
    expect(out).toContain("is current");
  }, 120_000);

  it("lists every automated run, and no hand-written one", () => {
    // The negative half is the one worth holding: the August reviews are
    // paragraphs of measured prose that no generator could reconstruct, and a
    // regeneration that swallowed them would destroy the most detailed reading
    // this codebase has had.
    const page = readFileSync(`${repo}/docs/reviews/README.md`, "utf8");
    const generated = page.slice(page.indexOf("<!-- generated"), page.indexOf("<!-- end generated"));
    expect(generated).toContain("2026-09-01-architect.md");
    expect(generated).not.toContain("2026-08-23-architecture.md");
    expect(page).toContain("2026-08-23-architecture.md");
  });

  it("says it is generated, in the file itself", () => {
    const page = readFileSync(`${repo}/docs/reviews/README.md`, "utf8");
    expect(page).toContain("scripts/reviews.mjs");
  });
});

/**
 * **A lesson's number is its name, and a name has to be free** (#206 phase 5).
 *
 * Found by the decisions index the moment it was generated: `lessons.md` had
 * **three lesson 16s**, two 17s, two 18s and two 20s — and a stray 36 and 37
 * sitting between 29 and 30. So `see lessons.md #16` pointed at three
 * different lessons, and it was already going wrong in the tree:
 * `titlebar.test.ts` means the second one, `tokens.test.ts` the third, and
 * `docs/changelog/2026-09-01.md` the first.
 *
 * **The same shape as lesson 41, arriving through a number instead of a file
 * name.** Appending to a numbered list is a claim that the next number is
 * free, and nothing announced that it was not — so four lessons written on
 * 8 Sep took 36–39 and two of them collided. Those are 40–43 now.
 *
 * The archaeology is done and the ratchet is at zero. Each later duplicate
 * was read to see which lesson its citations meant, then moved to a free
 * number — the existence check to 38, the NaN one to 39, deduplicating-by-a-
 * finer-key to 45, the shared chrome budget to 46, the cheerful instrument to
 * 47 — and every first occurrence kept its number, so the citations that were
 * already right did not move. 36 and 37 went back after 35.
 */
describe("a lesson number means one lesson", () => {
  const numbers = () =>
    [...readFileSync(fileURLToPath(new URL("../docs/reviews/lessons.md", import.meta.url)), "utf8")
      .matchAll(/^\|\s*(\d+)\s*\|\s*\*\*/gm)].map((m) => Number(m[1]));

  /** Was 4 — 16, 17, 18 and 20 — until #206 phase 5 gave each one a name. */
  const INHERITED = 0;

  it(`has no more than ${INHERITED} numbers used twice`, () => {
    const seen = new Map<number, number>();
    for (const n of numbers()) seen.set(n, (seen.get(n) ?? 0) + 1);
    const doubled = [...seen].filter(([, count]) => count > 1).map(([n]) => n);
    expect(
      doubled.length,
      `lessons ${doubled.join(", ")} are used more than once — "see lessons.md #${doubled[0]}" ` +
        "then names more than one lesson. Take the next FREE number, not the next one after the last row.",
    ).toBeLessThanOrEqual(INHERITED);
  });

  it("can see a collision, and reads a table that is actually there", () => {
    // The other half: a matcher that found nothing would report no duplicates
    // forever, which is the vacuous guard this repo has deleted two of.
    expect(numbers().length, "there are lessons to count").toBeGreaterThan(30);
    const doubled = (ns: number[]) => {
      const seen = new Map<number, number>();
      for (const n of ns) seen.set(n, (seen.get(n) ?? 0) + 1);
      return [...seen].filter(([, c]) => c > 1).map(([n]) => n);
    };
    expect(doubled([1, 2, 2, 3])).toEqual([2]);
    expect(doubled([1, 2, 3])).toEqual([]);
  });
});
