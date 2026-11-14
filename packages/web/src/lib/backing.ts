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

import type { Backing } from "@isocan/core";

/**
 * What the file mark says when you rest on it.
 *
 * One sentence per state, and each one says what it MEANS rather than naming
 * the state: "drifted" is a word this product invented, and a person reading
 * a tooltip should not have to have read the design doc.
 */
export function fileMarkTip(backing: Backing): string {
  switch (backing.state) {
    case "written":
      return `${backing.path} — this item is that file, and the file matches`;
    case "behind":
      return `${backing.path} — the file holds an older version of this item; saving catches it up`;
    case "drifted":
      return `${backing.path} — the file changed outside the canvas; saving would overwrite it`;
    case "absent":
      return `${backing.path} — not written on this machine yet`;
    case "unbound":
      return `${backing.path} — no directory is bound to this canvas here`;
  }
}
