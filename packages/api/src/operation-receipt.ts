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

import type { GroupBox, Operation } from "@isocan/core";

/** Read creation geometry from the writer receipt, including atomic group insertion. */
export function insertedItemBox(op: Operation, itemId: string): GroupBox {
  if (op.type === "group.change" && op.action.kind === "apply") {
    const write = op.action.change.writes.find((entry) => entry.kind === "create" && entry.item.id === itemId);
    if (write?.kind === "create") return { x: write.item.x, y: write.item.y, width: write.item.width, height: write.item.height };
  }
  if (op.type === "item.add" && op.itemId === itemId && "x" in op.placement && "y" in op.placement) return { x: op.placement.x, y: op.placement.y, width: op.width, height: op.height };
  throw new Error(`writer receipt contains no creation geometry for ${itemId}`);
}
