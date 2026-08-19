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

export type ItemKind = "drawing" | "image" | "video" | "document" | "site" | "other";

/** In the order a list should show them: what you made, then what you brought. */
export const ITEM_KINDS: readonly ItemKind[] = [
  "drawing",
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
  if (mime.startsWith("text/") || mime === "application/pdf") return "document";
  return "other";
}
