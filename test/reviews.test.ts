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
