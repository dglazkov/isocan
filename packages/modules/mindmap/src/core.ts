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
