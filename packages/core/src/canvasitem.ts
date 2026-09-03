import type { Item } from "./model.ts";
import { canvasUrl, parseCanvasAddress } from "./address.ts";
import { BROWSER_MIME, parseUriList } from "./browseritem.ts";

/**
 * **A canvas placed on a canvas** (`docs/projects/inception/design.md`).
 *
 * The same shape a site item has, and deliberately: an ordinary `item.add`
 * whose blob is a `text/uri-list` holding the other canvas's address, so
 * undo, versions, copy, `--in` and GC all come free, and a build that
 * predates this renders the generic file card instead of breaking. What
 * tells it apart from a site is `kind=canvas` — the way a text node is told
 * apart from a document it would otherwise look like — plus `canvas=<id>`
 * so a reader need not parse the address, and `source=<address>`, the one
 * property that means "this item points at something you can open in a
 * tab", which the Google Docs note proposes for documents and which the
 * app draws as a ↗.
 *
 * The card is drawn LIVE from the other canvas's snapshot by whoever
 * renders it; a screenshot is a later, optional `image/png` version of the
 * same item for a reader who cannot fetch (phase 2). Nothing here is a new
 * op type.
 */

export const CANVAS_KIND = "canvas";
/** `canvas=<id>` — which canvas this item points at. */
export const CANVAS_PROP = "canvas";
/** `source=<address>` — what the ↗ opens. Not canvas-specific on purpose. */
export const SOURCE_PROP = "source";
export const CANVAS_ITEM_FILENAME = "canvas.uri";
/** A screen's size: a canvas is a place, and a place wants room. */
export const CANVAS_ITEM_SIZE = { width: 800, height: 600 };

export function isCanvasItem(item: Item): boolean {
  return item.properties.kind === CANVAS_KIND;
}

/** The canvas this item points at, or null when it is not a canvas item. */
export function canvasIdOf(item: Item): string | null {
  if (!isCanvasItem(item)) return null;
  return item.properties[CANVAS_PROP] ?? null;
}

/** What the ↗ opens, on any item that has one. */
export function sourceOf(item: Item): string | null {
  return item.properties[SOURCE_PROP] ?? null;
}

/**
 * The properties a canvas item wears, and the blob it carries — one function,
 * so the CLI's `canvas place` and the app's popup cannot spell it two ways.
 */
export function canvasItemOf(
  origin: string,
  canvasId: string,
): { properties: Record<string, string>; blob: string; mimeType: string; filename: string } {
  const address = canvasUrl(origin, canvasId);
  return {
    properties: { kind: CANVAS_KIND, [CANVAS_PROP]: canvasId, [SOURCE_PROP]: address },
    blob: `${address}\n`,
    mimeType: BROWSER_MIME,
    filename: CANVAS_ITEM_FILENAME,
  };
}

/**
 * The address inside an older or hand-made canvas item's blob, when its
 * properties do not say — a reader's fallback, never the first place to
 * look.
 */
export function canvasIdFromBlob(text: string): string | null {
  const address = parseUriList(text);
  if (!address) return null;
  return parseCanvasAddress(address)?.canvasId ?? null;
}
