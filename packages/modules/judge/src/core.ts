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

import { judgeModule } from "./record.ts";

/**
 * **Judge** (`docs/projects/judge/design.md`).
 *
 * A typed judge returns a decision and a probability and cannot cite, so it
 * may triage and never rule — and no phase may act on one before a phase has
 * reported its calibration. Phase 1 is the corpus that makes that possible:
 * a READER over what the wireframe flow already recorded (round 1's P(yes)
 * as `need`, who answered as `by`) and what the running person then did.
 * `corpus.ts` is the fold, `wire-format.ts` the stored format it reads.
 * Phase 2 is the reading (`reading.ts`): the reliability curve of the P
 * those rows recorded, written as a page by `scripts/calibrate.ts`.
 *
 * The record (`record.ts`) owns nothing: the reader writes nothing to any
 * canvas. Delete this directory and its two list entries and the feature
 * never existed — the removability test the design asked for.
 */
export { judgeModule };
export * from "./wire-format.ts";
export * from "./corpus.ts";
export * from "./reading.ts";

export default judgeModule;
