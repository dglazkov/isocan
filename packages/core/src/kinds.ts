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
import { isCanvasItem } from "./canvasitem.ts";
import { isDrawingItem } from "./drawing.ts";
import { moduleKindOf, moduleKinds } from "./modules.ts";
import { isTextItem } from "./textnode.ts";
import type { Item } from "./model.ts";

/** The kinds the product ships with — the ones every record below names. */
export type BuiltinKind =
  | "drawing"
  | "text"
  | "screen"
  | "image"
  | "video"
  | "document"
  | "site"
  | "canvas"
  | "other";

/**
 * **A kind: one of the built-ins, or the id of a kind a loaded module adds**
 * (`docs/projects/modules/design.md`, phase 2).
 *
 * This is the union becoming a string, paid on purpose in one commit: a
 * module's kind cannot be in a union the compiler closed before the module
 * existed. What survives the widening is exhaustiveness over the BUILT-INS —
 * `Record<BuiltinKind, …>` still names a missing label or mark — and a
 * lookup with a fallback for everything else (`kindLabel`, `kindNoun`,
 * `iconKindFor` in the web app). `(string & {})` keeps the built-in names as
 * completions rather than collapsing the whole type to `string`.
 */
export type ItemKind = BuiltinKind | (string & {});

/** In the order a list should show them: what you made, then what you brought. */
export const ITEM_KINDS: readonly BuiltinKind[] = [
  "drawing",
  "text",
  "screen",
  "image",
  "video",
  "document",
  "site",
  "canvas",
  "other",
];

export function isBuiltinKind(kind: string): kind is BuiltinKind {
  return (ITEM_KINDS as readonly string[]).includes(kind);
}

/**
 * Every kind a list can group under right now: the built-ins, with the loaded
 * modules' kinds before `other` — a diagram is a thing you made, and "Files"
 * stays the last word.
 */
export function itemKinds(): ItemKind[] {
  const added = moduleKinds().map((k) => k.id);
  return [...ITEM_KINDS.filter((k) => k !== "other"), ...added, "other"];
}

export function itemKind(item: Item): ItemKind {
  if (isDrawingItem(item)) return "drawing";
  // Words typed onto the canvas, beside ink drawn onto it — both are things
  // somebody MADE here rather than brought, and both are marked by
  // `properties.kind` rather than by their blob, because the blob is a
  // perfectly ordinary `.md` and an `.svg`. It sits above the mime tests for
  // that reason: a text node is markdown, and "document" is what markdown
  // somebody UPLOADED is.
  if (isTextItem(item)) return "text";
  // A canvas placed on a canvas carries the same blob a site does — an
  // address — and is told apart the way a text node is: by `kind`. Above the
  // mime tests for that reason (`core/canvasitem.ts`).
  if (isCanvasItem(item)) return "canvas";
  const current = item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions[0];
  const mime = current?.mimeType ?? "";
  // A loaded module's claim on a mime comes before the built-in tests, and
  // after the property-marked kinds above: a module names files, and a text
  // node or a canvas card is a file it did not make. With the module gone
  // the same item falls through to whatever the tests below call it — a
  // diagram is a document, which is exactly what a `.mmd` file is.
  const added = moduleKindOf(mime);
  if (added) return added.id;
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

/**
 * **Is this item drawn inside an iframe?**
 *
 * A screen is an HTML document and a site is somebody else's page; both are
 * live frames rather than pictures. That matters to anything that wants to
 * ANIMATE one, because a sandboxed cross-origin frame cannot be captured:
 * a view-transition snapshot of it is a blank rectangle, and animating that
 * is a white flash across the screen. Reported from a presentation, on every
 * flip, and no amount of caching touches it — the frame was loaded the whole
 * time, it simply cannot be photographed.
 *
 * In core because it is a fact about the item, and both surfaces will want it
 * the moment either grows a transition.
 */
export function isFramedItem(item: Item): boolean {
  const kind = itemKind(item);
  return kind === "screen" || kind === "site";
}

/**
 * Can this content be edited as TEXT — the question the stage's Edit mode
 * asks before offering itself. A png simply has no Edit tab, rather than an
 * empty box.
 *
 * In core because both surfaces answer it: the web editor gates its mode on
 * this, and `isocan edit` opens the same set in $EDITOR. Deliberately by
 * mime, not by kind — a "screen" is text/html (editable) but an "image" that
 * is image/svg+xml is text too, and the kind vocabulary rounds that away.
 */
export function editableText(mimeType: string): boolean {
  return (
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    mimeType === "image/svg+xml"
  );
}
