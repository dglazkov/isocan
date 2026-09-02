/**
 * The web side of #item-references: which items can be referenced, and where
 * a chip takes you. Resolution itself lives in `@isocan/core` — this module
 * only feeds it the live items and performs the catapult.
 */
import { useMemo } from "react";
import type { CanvasContents, ItemRefCandidate } from "@isocan/core";
import { collectItemRefCandidates } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { centerOn } from "./viewport.ts";

/** One referable item, as offered by the "#" menu. */
export interface ItemEntry {
  id: string;
  title: string;
}

interface ItemRefRoster {
  /** One entry per name an item answers to (title and id); feeds core. */
  candidates: ItemRefCandidate[];
  /** One entry per item, most recently touched first; feeds the "#" menu. */
  entries: ItemEntry[];
}

function itemRefRoster(canvas: CanvasContents | null): ItemRefRoster {
  if (!canvas) return { candidates: [], entries: [] };
  const entries = Object.values(canvas.items)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((item) => ({ id: item.id, title: item.title.trim() || item.id }));
  return { candidates: collectItemRefCandidates(canvas), entries };
}

/** `itemRefRoster` over the live store. */
export function useItemRefRoster(): ItemRefRoster {
  const canvas = useCanvasStore((s) => s.canvas);
  return useMemo(() => itemRefRoster(canvas), [canvas]);
}

/** Fly the viewport to an item and select it — the reader lands looking at
 * the thing the comment was talking about. */
export function catapultToItem(itemId: string): void {
  const item = useCanvasStore.getState().canvas?.items[itemId];
  if (!item) return; // deleted since the chip was drawn
  const ui = useUiStore.getState();
  ui.setViewport(
    centerOn(
      ui.viewport,
      item.x + item.width / 2,
      item.y + item.height / 2,
      window.innerWidth,
      window.innerHeight,
    ),
  );
  ui.select(item.id);
}
