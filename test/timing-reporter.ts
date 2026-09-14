import type { Reporter } from "vitest/node";
import { filteredRun } from "./deep.ts";
import { laneOf, record } from "./timings.ts";

/**
 * **Every run records itself, because a habit is not a measurement.**
 *
 * Wired into `vitest.config.ts` beside the default reporter, so there is no
 * command to remember and no flag to pass: `npm test`, `npm run test:deep`,
 * `npm run test:ci`, a CI shard and one filtered file on a laptop all leave
 * the same line behind. `scripts/timings.mjs` reads them back.
 *
 * A reporter rather than a wrapper script for exactly that reason. Wrapping
 * `npm test` would measure the runs that go through the wrapper and miss every
 * bare `npx vitest`, which is most of what an agent actually types — and the
 * runs you forget to measure are the ones that tell you what is slow.
 *
 * It reports nothing to the screen. The default reporter already prints a
 * duration; this one is only here to remember it.
 */
export default class TimingReporter implements Reporter {
  private started = 0;

  onInit(): void {
    this.started = Date.now();
  }

  onFinished(files: { result?: { state?: string }; tasks?: unknown[] }[] = []): void {
    try {
      const tasks = (file: { tasks?: unknown[] }): number => {
        let count = 0;
        const walk = (list: unknown[]): void => {
          for (const one of list) {
            const task = one as { type?: string; tasks?: unknown[] };
            if (task.tasks) walk(task.tasks);
            else count += 1;
          }
        };
        walk(file.tasks ?? []);
        return count;
      };
      record({
        at: new Date().toISOString(),
        lane: laneOf(),
        ...(process.env["VITEST_SHARD"] ? { shard: process.env["VITEST_SHARD"] } : {}),
        filtered: filteredRun(),
        files: files.length,
        tests: files.reduce((total, file) => total + tasks(file), 0),
        failed: files.filter((file) => file.result?.state === "fail").length,
        ms: Date.now() - this.started,
      });
    } catch {
      /* Never the reason a suite goes red — see `test/timings.ts`. */
    }
  }
}
