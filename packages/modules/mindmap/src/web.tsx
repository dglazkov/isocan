import type { ComponentType } from "react";
import type { ModuleAction, RendererFacts, UnderlayFacts, WebModule } from "@isocan/core";
import { mapOf, mapsOn, mindmap, tidyMap } from "./core.ts";
import { MapEdges } from "./edges.tsx";

/**
 * **Tidy the map the selection is in, or the only one there is.**
 *
 * Ambiguity is refused rather than guessed, the same rule `resolveMap` follows
 * in the CLI: with two maps on a canvas and nothing selected, tidying one of
 * them at random rearranges work somebody did not ask about.
 *
 * One `items.move`, so one undo — the first thing anybody does after an
 * automatic layout is decide they preferred it before. The shell sends it;
 * this only says what to send (`ModuleAction`, core/modules.ts).
 */
const tidy: ModuleAction = {
  id: "tidy-map",
  name: "Tidy the mind map",
  hint: "one column per depth, parents centred on their children — one undo",
  // Offered only where there is one to tidy: a menu that lists what it
  // cannot do lies.
  available: ({ canvas }) => mapsOn(canvas).length > 0,
  run: ({ canvas, selection }) => {
    const maps = mapsOn(canvas);
    const fromSelection = selection
      .map((id) => canvas.items[id])
      .map((item) => (item ? mapOf(item) : null))
      .find((mapId): mapId is string => mapId !== null);
    const mapId = fromSelection ?? (maps.length === 1 ? maps[0]!.id : null);
    if (!mapId) return;
    const moves = tidyMap(canvas, mapId);
    if (moves.length === 0) return;
    return [{ type: "items.move", moves }];
  },
};

/**
 * **The mind map's web half**: the lines, as an underlay the shell mounts
 * inside `.world` under the items, fed the canvas and the live drag as props;
 * and the tidy, as a palette action over facts. Nothing here knows the
 * shell's stores (`docs/projects/modules/design.md`).
 */
export const mindmapWeb: WebModule<ComponentType<UnderlayFacts>, ComponentType<RendererFacts>> = {
  core: mindmap,
  underlays: [MapEdges],
  actions: [tidy],
};

export default mindmapWeb;
