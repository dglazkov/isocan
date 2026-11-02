import type { Item } from "./model.ts";
import { CANVAS_PATH_PREFIX, canvasUrl, parseCanvasAddress } from "./address.ts";
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

/** Automatic readers inspect declared addresses before choosing a MIME renderer:
 * changing kind cannot turn a personal canvas into an unguarded site or image.
 * Pass the raw canvas property, not canvasIdOf's kind-dependent result. This
 * extracts a target only; its authoritative classification still precedes IO. */
export function automaticCanvasTarget(declaredCanvasId: string | null, source: string | null):
  | { kind: "none" }
  | { kind: "canvas"; canvasId: string; source: string | null }
  | { kind: "unavailable"; refused: string } {
  const unavailable = { kind: "unavailable" as const, refused: "This card's declared canvas address is incomplete or inconsistent." };
  const validId = (id: string) => /^[A-Za-z0-9_-]+$/.test(id);
  if (declaredCanvasId !== null && !validId(declaredCanvasId)) return unavailable;
  let address: ReturnType<typeof parseCanvasAddress> = null;
  if (source?.trim()) {
    try { address = parseCanvasAddress(source); } catch { return unavailable; }
    if (!address) {
      // An item, deck, workbench or malformed subpath still names a canvas.
      // Use the shared root parser; its setup-specific exact-path semantics
      // remain unchanged. Relative canvas routes have no asserted authority.
      let url: URL | undefined;
      try {
        const raw = source.trim();
        url = new URL(raw.startsWith("/") || /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`, "https://invalid.invalid");
      } catch { /* A non-canvas URL stays the ordinary renderer's concern. */ }
      if (url?.pathname.split("/")[1] === CANVAS_PATH_PREFIX.slice(1)) {
        if (source.trim().startsWith("/") || !["http:", "https:"].includes(url.protocol)) return unavailable;
        try { address = parseCanvasAddress(`${url.origin}${url.pathname.split("/").slice(0, 3).join("/")}`); }
        catch { return unavailable; }
        if (!address) return unavailable;
      }
    }
    if (!address && declaredCanvasId !== null) return unavailable;
  }
  if (address) {
    if (!validId(address.canvasId) || (declaredCanvasId !== null && declaredCanvasId !== address.canvasId)) return unavailable;
    return { kind: "canvas", canvasId: address.canvasId, source: canvasUrl(address.origin, address.canvasId) };
  }
  return declaredCanvasId === null ? { kind: "none" } : { kind: "canvas", canvasId: declaredCanvasId, source: null };
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
