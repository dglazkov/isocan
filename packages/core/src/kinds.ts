/**
 * What an item IS, in the one word a person would use: a drawing, an image, a
 * document, a site. Derived from the blob it carries, never stored — the file
 * is the truth, and a second copy of it would be a second thing to keep right.
 *
 * Shared so the web app's files panel and `isocan ls --kind` group the canvas
 * the same way. A kind that means one thing in a list and another in a filter
 * is worse than no kinds at all.
 */

import { BROWSER_MIME } from "./browseritem.ts";
import { isDrawingItem } from "./drawing.ts";
import type { Item } from "./model.ts";

export type ItemKind =
  | "drawing"
  | "screen"
  | "image"
  | "video"
  | "document"
  | "site"
  | "other";

/** In the order a list should show them: what you made, then what you brought. */
export const ITEM_KINDS: readonly ItemKind[] = [
  "drawing",
  "screen",
  "image",
  "video",
  "document",
  "site",
  "other",
];

export function itemKind(item: Item): ItemKind {
  if (isDrawingItem(item)) return "drawing";
  const current = item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions[0];
  const mime = current?.mimeType ?? "";
  if (mime === BROWSER_MIME) return "site";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  // A SCREEN is the thing this canvas mostly holds — an HTML page you can
  // look at and point at — and it is worth its own word. It was "document"
  // until the cards grew a type icon and one glyph had to stand for both a
  // designed screen and a paragraph of notes. They are not the same object:
  // you review a screen and you read a document.
  //
  // `site` stays separate and stays above this: a mini-browser item is HTML
  // too, but it is somebody else's page being watched live rather than a page
  // that lives here.
  if (mime === "text/html") return "screen";
  if (mime.startsWith("text/") || mime === "application/pdf") return "document";
  return "other";
}
