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
/**
 * Raised 6 Sep 2026, 731,012 → 736,800, and the reason belongs here rather
 * than only in a commit.
 *
 * The growth is the fix for the bug that froze a browser: `useOnScreen`, and
 * the gate on `ItemThumb` that stops a Chat panel mounting a live HTML
 * document per message card. A canvas with a long agent thread held 163 of
 * them, 764MB, a pegged core, and a tab that died the longer it stayed open.
 * Five kilobytes of download to stop that is not a close call.
 *
 * `VersionFanOut` was made lazy in the same change and gave 1,174 bytes back
 * — unfolding an item's whole history is rare and deliberate, so every
 * visitor was paying for a gesture most sessions never make.
 *
 * The number is the local build plus a small allowance: this machine measures
 * ~736,540 and CI's build has run a few dozen bytes higher than local all
 * along (731,012 was set while local read 730,989). The allowance covers that
 * gap and nothing else — any real growth still fails here, which is the point.
 *
 * **The goal is now 96,800 bytes away**, and that is the debt this records.
 * Three of these raises have been justified individually; the fourth should
 * be somebody deciding to spend a session on shell code instead.
 */
/**
 * **Lowered again, 727,300 → 690,000 — and the whole story is that nobody was
 * looking.**
 *
 * This number went UP twice on 6 September, for a browser-freeze fix and for
 * two features, and the file said there should be no third raise before
 * somebody took bytes out. Four lookings later:
 *
 *   menuentries.tsx   11,116   every row the canvas can offer, on every visit
 *   CanvasCard         2,457   a placed canvas's miniature; 1 exists in 22 canvases
 *   FullScreen        ~33,000   a route, with ArtifactStage behind it
 *   IdentityMenu       ~2,400   opened from a click
 *
 * **768,993 → 689,550 in a day, and not one of them was hard.** Every one was
 * a component mounted behind a condition — a route, a click, a gesture most
 * sessions never make — that was nonetheless in the bytes of every first
 * visit. Nothing was refactored and nothing was removed; they are imported
 * when they are asked for.
 *
 * The lesson to keep, because it is cheaper than any of the fixes: the entry
 * chunk grew for months not because the app needs those bytes at load, but
 * because a static import is the default and no instrument asked. The first
 * four places anybody looked held seventy-nine kilobytes.
 *
 * **The goal is 49,550 away** — close enough to be a target rather than a
 * debt. Same rule: this comes down, not up.
 *
 * **691,500 (6 Sep, +856).** `lib/whilevisible.ts`, which stops every
 * repeating fetch while the tab is hidden. Paid deliberately and in the entry
 * chunk on purpose: it is imported by the presence poll and the sprint clock,
 * both of which a first visit runs, so deferring it would defer the thing that
 * makes a background tab quiet. Under a kilobyte to stop a hidden tab polling
 * the daemon forever is the right side of this trade — and this is the shape
 * the ratchet is for: a raise that is one line, in the diff, with the reason
 * beside it, rather than a hundred kilobytes arriving as a hundred unremarked
 * commits.
 *
 * **692,500 (7 Sep, +407).** `core/summons.ts` and the clock `OnIt` now reads,
 * for #197 phase 1 — the receipt that lets a summons say "nothing answered"
 * instead of "Sent. One agent is listening." forever. Four hundred bytes for
 * the difference between silence and a fact.
 *
 * Three raises in one day is itself a finding, and Dion named the right shape
 * for it: **this should trigger an effort to slim down without blocking a
 * release, and only a MAJOR jump should stop one** — a jump being the shape of
 * a mistake (an eager import of something large) rather than a decision. Not
 * built; the catch is that a soft tier needs somewhere it can still fail, and
 * the queue that would hold it only sees findings once the nightly persona PR
 * is merged. See #198's neighbours.
 *
 * **693,800 (7 Sep, +956).** The background submenu — the first nested menu in
 * this app, plus `themeLabel`. Four raises in one day, none of them careless,
 * which is the argument for the tiering rather than against it: a bound that
 * has to be edited four times to ship four deliberate things is teaching
 * people to edit it without reading it, and that is how the hundred kilobytes
 * arrived the first time.
 *
 * **694,300 (7 Sep, +272).** Keeping a submenu on screen — the child menu
 * shipped without the edge-avoidance the parent has had since it was written,
 * and a screenshot of the real thing near the bottom of a window is what
 * found it. Fifth raise in a day, same argument.
 *
 * **694,800 (7 Sep, +203).** `themeCursor` — the half of #195 its own title
 * named and that shipped without being built. Sixth raise, and the last one
 * before the tiering is worth doing rather than talked about.
 *
 * **695,200 (7 Sep, +16).** Hold-to-borrow for H and T, which is smaller than
 * the code it replaced — the +16 is the comment explaining why tool keys now
 * live in one file.
 */
const CEILING = 695_200;

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
