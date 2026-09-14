import { DEEP, runningDeep, skippedLine } from "./deep.ts";

/**
 * **Say what this run did not check.**
 *
 * A fast lane is only safe while it is loud: a green `npm test` that quietly
 * left out a third of the suite is the shape of every instrument this repo has
 * caught reporting healthy while blind. So the run ends by naming what it
 * skipped and the command that does not skip it — the same courtesy
 * `test/emulator.ts` pays when the cloud suites cannot run.
 *
 * It runs once, in the main process, after every worker is done.
 */
export function setup(): void {
  if (!runningDeep() && DEEP.length > 0) {
    console.log(`\n[isocan] ${skippedLine()}\n`);
  }
}

export function teardown(): void {
  if (!runningDeep() && DEEP.length > 0) console.log(`[isocan] ${skippedLine()}`);
}
