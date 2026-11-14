/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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
