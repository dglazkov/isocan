import { defineConfig } from "vitest/config";
import { DEEP, runningDeep } from "./test/deep.ts";

export default defineConfig({
  test: {
    include: ["packages/*/test/**/*.test.ts", "packages/modules/*/test/**/*.test.ts", "test/**/*.test.ts"],
    /**
     * **The deep lane, left out unless asked for.** The files in `test/deep.ts`
     * drive the real binary and are about half this suite's CPU; `npm test`
     * skips them and says so, `npm run test:deep` runs them, and CI sets
     * `ISOCAN_REQUIRE_DEEP` so the run that decides a release never skips.
     * The exclusion has to be empty when that switch is set — an anti-skip
     * switch that skipped would be worse than no switch.
     */
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      ...(runningDeep() ? [] : DEEP.map((d) => d.file)),
    ],
    // Runs in every worker, before every test file: see test/setup.ts for what
    // a run leaves behind without it.
    setupFiles: ["test/setup.ts"],
    /* The default reporter prints the duration; `timing-reporter.ts` is what
       remembers it. Every run, no flag — `scripts/timings.mjs` reads them back
       and says which kind of run is getting slower. */
    reporters: ["default", "./test/timing-reporter.ts"],
    /**
     * NOT the 5-second default, and this is the third time it has been paid
     * for.
     *
     * Most of this suite spawns real processes: a daemon, or `bin/isocan.js`
     * itself, several times per test. Under load those are seconds, and the
     * default put a hard 5s line straight through the middle of the
     * distribution — so a test passed alone, passed on a fast laptop, and
     * failed on a shared runner, which is the most expensive kind of failure
     * there is because it teaches people to re-run.
     *
     * It was fixed twice by raising the limit on the ONE test that had been
     * named: `daemon.test.ts`'s hundred-item move, then
     * `session-identity.test.ts`'s "presence beats never cross" (3c7825e,
     * found by CI rather than locally). Measured on 2026-08-24 with the suite
     * under 24x CPU oversubscription: 90 tests ran over 2500ms, and five
     * failed at 5.0-5.5s in three files that had never been named —
     * `identity.test.ts`, `restart.test.ts` and three MORE cases in
     * `session-identity.test.ts` itself. The limit was never the problem of
     * one test.
     *
     * This is not phase 7.5's forbidden move — no signal is hidden. Nothing
     * here asserts on elapsed time; the assertions are about roster state,
     * process output and files on disk. And a genuinely wedged test still
     * FAILS, with its name, 25 seconds later — which lessons.md #6 is the
     * argument for: a hang that never fails is the thing to avoid, not a slow
     * test that eventually does.
     */
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Runs ONCE, in the main process, before any worker exists — which is the
    // only place a Firestore emulator can be started and have every worker
    // inherit its address. See test/emulator.ts for the three tiers and for
    // what happens on a machine that has none.
    globalSetup: ["test/emulator.ts", "test/deepgate.ts"],
  },
});
