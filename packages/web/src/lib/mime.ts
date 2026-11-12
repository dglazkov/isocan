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

import { mimeFromName } from "@isocan/core";

/**
 * What a dropped file is. **The browser is asked first** and usually right —
 * it gets `image/png` right and `.md` wrong — so core's table is consulted
 * only as a patch, when `file.type` is empty or the browser's own shrug
 * (`application/octet-stream`). See `core/media.ts`: this and the CLI's
 * `mimeFor` are two entry points onto one table, deliberately, because they
 * start from different amounts of knowledge.
 */
export function mimeTypeOf(file: File): string {
  if (file.type && file.type !== "application/octet-stream") return file.type;
  return mimeFromName(file.name) ?? file.type ?? "application/octet-stream";
}
