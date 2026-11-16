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

import type { CanvasContents, Item } from "./model.ts";
import { areasOf, isArea, inArea } from "./area.ts";
import { groupAncestors, isGroupItem } from "./canvas-groups.ts";

/** Explicit parents, nearest first; historical areas retain their geometric scope. */
export function canvasScopes(canvas: CanvasContents, item: Item): Item[] {
  if (isGroupItem(item)) return [item, ...groupAncestors(canvas, item.id)];
  const parents = groupAncestors(canvas, item.id);
  if (parents.length) return parents;
  const areas = areasOf(canvas).filter((area) => inArea(area, item)).sort((a, b) => a.width * a.height - b.width * b.height);
  return isArea(item) ? [item, ...areas] : areas;
}

/** A group's descendants belong even when moved; overlapping outsiders never do. */
export function inCanvasScope(canvas: CanvasContents, scope: Item, item: Item): boolean {
  return isGroupItem(scope)
    ? groupAncestors(canvas, item.id).some((parent) => parent.id === scope.id)
    : inArea(scope, item);
}
