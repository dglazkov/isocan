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

import { latelyOrder } from "@isocan/core";
import { readRecents } from "./recents.ts";
import { seenMarks } from "./seen.ts";

/**
 * **Where you were lately** — the switcher's leading list, shared across your
 * machines rather than kept per browser (#134, walk step 4).
 *
 * The home's marks first, newest visit first; then anything this browser
 * remembers that the home has no mark for, in the order it remembers. That
 * order is the answer to the failure this replaces AND to the one it must not
 * cause: a person on two machines finds the same canvases at the top of ⌘O,
 * and a person whose daemon is down still finds the ones they were just on,
 * because `readRecents` is still written on every visit and is still the
 * whole list offline.
 */
export function latelyIds(actorId: string): string[] {
  const marks = latelyOrder(seenMarks(actorId)).map((row) => row.canvasId);
  const known = new Set(marks);
  return [...marks, ...readRecents().map((row) => row.id).filter((id) => !known.has(id))];
}
