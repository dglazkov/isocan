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

import type { CoreModule } from "@isocan/core";
import { MAP_PARENT_PROP, MAP_PROP, allMapEdges, mapsOn } from "./graph.ts";

export * from "./graph.ts";

/**
 * **What the mind map contributes to core** (`docs/projects/modules/design.md`).
 *
 * The graph itself is `graph.ts` — pure functions over items and two property
 * keys, which is all a map ever was. This record is the module's face to the
 * registry: the keys it owns, the row it adds to `isocan context` and the
 * Context view, and the edges the canvas draws and JSON Canvas exports. Both
 * surfaces register it from their lists; core never imports it.
 */

export const mindmap: CoreModule = {
  name: "@isocan/mindmap",
  propertyKeys: [MAP_PROP, MAP_PARENT_PROP],
  itemReferenceProperties: [MAP_PARENT_PROP],
  groupIdentityProperties: [MAP_PROP],
  contextPieces: (canvas) => {
    const maps = mapsOn(canvas);
    if (maps.length === 0) return [];
    return [
      {
        name: "Mind maps",
        source: "canvas",
        present: true,
        size: maps.map((m) => `${m.title} (${m.nodes})`).join(", "),
      },
    ];
  },
  edges: allMapEdges,
};

export default mindmap;
