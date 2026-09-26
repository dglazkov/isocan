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

/**
 * **The same names are the same list** (26 Sep 2026).
 *
 * The candidates are a function of each item's id and title and nothing else,
 * and they were rebuilt — a new array — on every operation, because the roster
 * was memoised on the canvas object, which is new on every operation. That
 * identity is what the Chat and every open thread hand the Markdown renderer as
 * its chip plugin, so a collaborator moving one item re-parsed every comment on
 * the screen, and rebuilt the candidates three times over (measured: 8% of the
 * main thread while somebody else dragged, on 250 items at 4x CPU).
 *
 * So the list is kept while the ids and titles are: the signature is one pass
 * of string joins, far cheaper than the rebuild, and cheaper still than what a
 * fresh identity costs downstream. Module-wide, because the three callers all
 * ask about the same canvas.
 */
let signed = { key: "", candidates: [] as ItemRefCandidate[] };
function stableCandidates(canvas: CanvasContents): ItemRefCandidate[] {
  let key = "";
  for (const item of Object.values(canvas.items)) key += `${item.id}\u0000${item.title}\u0001`;
  if (key !== signed.key) signed = { key, candidates: collectItemRefCandidates(canvas) };
  return signed.candidates;
}

const NO_CANDIDATES: ItemRefCandidate[] = [];

/** The roster over the live store: candidates kept while the names are, entries by recency. */
export function useItemRefRoster(): ItemRefRoster {
  const canvas = useCanvasStore((s) => s.canvas);
  const candidates = canvas ? stableCandidates(canvas) : NO_CANDIDATES;
  // Most recently touched first, for the "#" menu — this one does move with
  // every operation, and nothing downstream is keyed on it.
  const entries = useMemo(
    () =>
      canvas
        ? Object.values(canvas.items)
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .map((item) => ({ id: item.id, title: item.title.trim() || item.id }))
        : [],
    [canvas],
  );
  return useMemo(() => ({ candidates, entries }), [candidates, entries]);
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
