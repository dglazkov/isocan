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

import type { GroupAction, GroupOperation } from "./canvas-group-types.ts";

/**
 * Insert a prepared forest through the native bounded creation resolver.
 * Records have fresh IDs and explicit parents; this does not claim an existing
 * source artifact. The current canvas ID governs external annotation handling.
 * The writer stamps all records and logs one create change, with one inverse.
 */
export function preparedGroupCreation(canvasId: string, items: Extract<GroupAction, { kind: "copy" }>["items"], at: { x: number; y: number }): GroupOperation {
  const ids = new Set(items.map((item) => item.id));
  return { type: "group.change", action: {
    kind: "copy", sourceCanvasId: canvasId, items,
    rootIds: items.filter((item) => !item.containerId || !ids.has(item.containerId)).map((item) => item.id),
    at, groupPlacement: "preserve",
  } };
}
