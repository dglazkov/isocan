import type { Item } from "./model.ts";
import { isCanvasItem } from "./canvasitem.ts";

/*
 * **The memory mark on a canvas card** (moved out of `memory.ts` on
 * 14 Oct 2026, unchanged; `memory.ts` re-exports it).
 *
 * A card's `memory=inherit` or `memory=personal` is read as the canvas
 * draws, so these few lines are in the web app's first paint. The layers they
 * lead to — inherited pieces, the governing design, the Context sheet, and the
 * context reader behind them — are read by the Context panel, the composer and
 * the CLI, and while they shared a file with the mark they were in every
 * first visit too: a module in the entry chunk carries every export any chunk
 * uses.
 */
export const MEMORY_PROP = "memory";
export const MEMORY_INHERIT = "inherit";
/** Phase 2's value — the person's own canvas, read only by their actors. */
export const MEMORY_PERSONAL = "personal";

export type MemoryLink = "inherit" | "personal";

/** What a canvas card says about the memory behind it, or nothing. */
export function memoryOf(item: Item): MemoryLink | null {
  if (!isCanvasItem(item)) return null;
  const raw = item.properties?.[MEMORY_PROP];
  return raw === MEMORY_INHERIT || raw === MEMORY_PERSONAL ? raw : null;
}

/** The patch that sets or clears the link — one spelling for both surfaces,
 *  cleared with `removeProperties` for the reason `markPatch` records. */
export function memoryPatch(
  memory: MemoryLink | null,
): { properties: Record<string, string> } | { removeProperties: string[] } {
  return memory === null ? { removeProperties: [MEMORY_PROP] } : { properties: { [MEMORY_PROP]: memory } };
}
