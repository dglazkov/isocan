import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **An export nothing outside its file uses, as a thing that can redden a
 * commit.**
 *
 * Step 8 of `docs/research/2026-09-06-architecture-review.md`, and the review
 * undersold it. It reported "49 unused exports, not 47" — a small thing, same
 * direction. The sharper finding is in `.agents/personas/reviewer.md`, which
 * has said **`at most: 0`** since 2 September, with the reasoning written out
 * beside it: *"a ratchet set above its floor is slack nobody decided to leave.
 * The next one fails on the commit that adds it, which is the whole point."*
 *
 * Four days later it was **56**. The ratchet was at its floor, the principle
 * was written down, and fifty-six arrived anyway — because only the nightly
 * ever read the number, and a nightly report is not a commit failing. This is
 * step 2's finding about the bundle, on a second metric, which is what makes
 * it a pattern rather than an incident: **a bound nothing enforces is a
 * comment.**
 *
 * So the number is measured in the ordinary suite now, through the same
 * instrument the persona declares (`scripts/measure.mjs`, never a second copy
 * of the scan — `docs/reviews/lessons.md` #5).
 *
 * ## Why the ceiling is 39 and not 0
 *
 * Fifteen of the fifty-six were server internals and web-app `lib/` — nothing
 * outside this repository can import those, so they were simply un-exported,
 * with the compiler as the check. The remaining 39 are all in
 * `packages/core/src`, and core is what a runtime module is handed at load
 * (`globalThis.isocan`). Deleting from it is a decision about **what
 * `@isocan/core` promises a module author**, not a tidy-up: some of these
 * (`ModuleEdge`, `ModuleActionFacts`, the DTCG token types) look exactly like
 * surface somebody would build against, and an unused export in a published
 * package is not the same fact as an unused export in a private one.
 *
 * That decision wants a person, so it is left as one — named here rather than
 * made quietly in a commit about something else. What is NOT left is the
 * drift: 39 is the line now, and the fortieth fails.
 */

const repo = fileURLToPath(new URL("..", import.meta.url));

/**
 * **The last agreed number of exports nothing outside their own file uses.**
 *
 * 39 on 2026-09-06, all of them in `packages/core/src` — down from 56 by
 * un-exporting every server and web `lib/` name on the list.
 *
 * **Lower it when you win**, and the honest way to win is to decide core's
 * public surface rather than to delete whatever the scan happens to name.
 */
const CEILING = 39;

describe("exports that promise something to nobody", () => {
  it("is no more than the last number somebody agreed to", () => {
    // Through the instrument the persona declares, so the suite and the
    // nightly cannot disagree about the number.
    const measured = Number(
      execFileSync("node", [path.join(repo, "scripts/measure.mjs"), "unused-exports"], {
        cwd: repo,
        encoding: "utf8",
        timeout: 120_000,
      }).trim(),
    );
    expect(Number.isFinite(measured), "measure.mjs did not answer a number").toBe(true);

    expect(
      measured,
      `${measured} exports are used nowhere outside their own file, past the agreed ${CEILING}.\n` +
        "  An export is a promise that something outside this file needs it; one nothing uses is a\n" +
        "  promise to nobody, and the next reader has to treat it as API before finding out it is not.\n" +
        "  Un-export it, or — if it is deliberately public surface — raise CEILING here and say why.\n" +
        "  Which ones: node scripts/measure.mjs unused-exports --names",
    ).toBeLessThanOrEqual(CEILING);
  }, 120_000);
});
