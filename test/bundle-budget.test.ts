import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **What a first visit downloads, as a thing that can redden a commit.**
 *
 * Step 2 of `docs/research/2026-09-06-architecture-review.md`, and the one the
 * note says stops the others recurring: *"Until the number can redden a
 * commit, step 1 is a one-time cleanup rather than a floor."*
 *
 * The measurement already existed. `scripts/measure.mjs bundle-bytes` reads
 * the module script out of the built HTML — the one artifact that knows which
 * chunk the browser fetches first — and the performance persona declares the
 * goal (`at most: 640000`). What was missing is that **only the nightly read
 * it.** The entry chunk drifted about a hundred kilobytes past the bound while
 * three nightly reports said MISSED into a pull request nobody had merged.
 *
 * ## Why this is a ratchet and not the bound
 *
 * The bound is 640,000 and the entry chunk is over it today. A test asserting
 * the goal would fail on every commit from the moment it landed, which is not
 * a guard — it is a red trunk, and this repository spent a morning on what a
 * red trunk costs. So the assertion is **"no worse than the last agreed
 * number"**, and the gap to the goal is printed rather than enforced.
 *
 * Raising `CEILING` is allowed and is the point: it is one line, in the diff,
 * with a person's reason beside it. What must not happen again is a hundred
 * kilobytes arriving as a hundred unremarked commits.
 *
 * ## It measures the BUILD, and must never make one
 *
 * `packages/web/dist` is an artifact, and an artifact can be older than the
 * source it came from — `lessons.md`'s "verify against what is actually
 * served" is exactly this trap. It bit twice while this test was being
 * written, the second time worse than the first.
 *
 * First: the container's `dist` predated the lazy-loading commit and measured
 * 768,812 for a tree whose real answer was 722,753. The obvious fix was to
 * build when stale — so this test did.
 *
 * **Then it built from inside a parallel suite, and reported 1,093,766 for a
 * tree that actually produced 725,291.** `packages/web/dist` is read by four
 * other test files (`packaging`, `replica`, `authaction`, `shot`) and written
 * by a couple more. A test that rebuilds a shared artifact mid-run is not
 * measuring, it is racing everybody else — and the number it invented was 50%
 * wrong in the alarming direction.
 *
 * So it builds nothing. Missing or stale means SKIP, loudly, naming the
 * command — and `ISOCAN_REQUIRE_BUNDLE=1` turns that skip into a failure, the
 * same shape as `ISOCAN_REQUIRE_EMULATOR` and for the same reason: a
 * contributor may have a green run that says what it did not check, while CI
 * may not. CI never skips anyway, because `npm ci` runs `prepare`, which
 * builds.
 */

const repo = fileURLToPath(new URL("..", import.meta.url));

/**
 * **The last agreed size of the entry chunk, in bytes.**
 *
 * 730,736 on 2026-09-06 — 725,291 (step 1's lazy boundaries: `LensPage`,
 * `CanvasListPage`, `NotHerePage`, the Share dialog and the history scrubber,
 * 768,993 → 720,659, plus the content origin's couple of kilobytes) plus
 * **5,445 for extensions stage 1**: core's manifest reader, the rail's hook,
 * and twelve icons. Raised deliberately, which is what this number is for —
 * the feature is on the canvas page, so it is bytes a canvas visitor genuinely
 * needs, and it arrived as one commit with a reason rather than as a hundred
 * unremarked ones.
 *
 * **+276 on the same day** for step 4 of the architecture review: the web app
 * now reads the whole fourteen-row mime table out of core instead of keeping
 * its own five. The review guessed the other nine would be "dead weight" —
 * this is what that weighs, and it buys one table with one lookup order
 * instead of two that can drift.
 *
 * **Lower it when you win.** The goal is 640,000 and the note is clear that
 * splitting is spent: the remaining ~83KB is `ItemView`, `CanvasViewport`,
 * `api.ts` and the stores — the canvas itself — so getting under it honestly
 * means less shell code rather than another chunk boundary.
 */
const CEILING = 731_012;

/** The performance persona's goal, restated here only so the failure message
 * can say how far there is left to go. `.agents/personas/performance.md` is
 * where it is declared and decided. */
const GOAL = 640_000;

/** Everything a change to the web bundle could come from. */
const SOURCES = ["packages/web/src", "packages/web/index.html", "packages/web/vite.config.ts"];

function newestSourceMtime(): number {
  let newest = 0;
  const walk = (p: string) => {
    if (!existsSync(p)) return;
    const s = statSync(p);
    if (s.isDirectory()) {
      for (const entry of readdirSync(p)) walk(path.join(p, entry));
      return;
    }
    newest = Math.max(newest, s.mtimeMs);
  };
  for (const rel of SOURCES) walk(path.join(repo, rel));
  return newest;
}

/** The built entry chunk's path, read the way `measure.mjs` reads it — out of
 * the built HTML, never by picking the biggest file in the directory. */
function builtEntry(): string | null {
  const html = path.join(repo, "packages/web/dist/index.html");
  if (!existsSync(html)) return null;
  const found = /<script[^>]*\ssrc="\/assets\/([^"]+\.js)"/.exec(readFileSync(html, "utf8"));
  return found ? path.join(repo, "packages/web/dist/assets", found[1]) : null;
}

describe("what a first visit downloads", () => {
  it(
    "is no bigger than the last number somebody agreed to",
    (ctx) => {
      const entry = builtEntry();
      const stale =
        !entry || !existsSync(entry) || statSync(entry).mtimeMs < newestSourceMtime();
      if (stale) {
        const why = entry ? "older than packages/web/src" : "missing";
        if (process.env.ISOCAN_REQUIRE_BUNDLE === "1") {
          throw new Error(
            `ISOCAN_REQUIRE_BUNDLE=1, but packages/web/dist is ${why}. ` +
              "CI builds it through `npm ci` → prepare; if this fired, that did not happen.",
          );
        }
        // Loud, and it names the command. Building here would race the four
        // other suites that read this directory — see the note above.
        ctx.skip(`packages/web/dist is ${why} — run \`npm run build\` to measure it`);
        return;
      }

      // Through the real instrument rather than a second copy of it: a test
      // that reimplements the measurement is a test of its own copy
      // (`docs/reviews/lessons.md` #5).
      const bytes = Number(
        execFileSync("node", [path.join(repo, "scripts/measure.mjs"), "bundle-bytes"], {
          cwd: repo,
          encoding: "utf8",
          timeout: 120_000,
        }).trim(),
      );
      expect(Number.isFinite(bytes), "measure.mjs did not answer a number").toBe(true);

      const overGoal = bytes - GOAL;
      expect(
        bytes,
        `the entry chunk grew to ${bytes.toLocaleString()} bytes, past the agreed ` +
          `${CEILING.toLocaleString()}.\n` +
          `  If the growth is deliberate, raise CEILING in this file and say why in the commit.\n` +
          `  If it is not, that is ${(bytes - CEILING).toLocaleString()} bytes a first visit ` +
          `now waits for that it did not before.\n` +
          `  The goal is ${GOAL.toLocaleString()} and this is ${overGoal.toLocaleString()} over it.`,
      ).toBeLessThanOrEqual(CEILING);

      // Not an assertion: the gap to the goal is a fact worth printing on every
      // run, so it is visible when it closes rather than only when it widens.
      if (bytes > GOAL) {
        console.log(
          `bundle: ${bytes.toLocaleString()} bytes — ${overGoal.toLocaleString()} over the ${GOAL.toLocaleString()} goal (ceiling ${CEILING.toLocaleString()})`,
        );
      }
    },
    120_000,
  );
});
