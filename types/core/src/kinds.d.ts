/**
 * What an item IS, in the one word a person would use: a drawing, an image, a
 * document, a site. Derived from the blob it carries, never stored — the file
 * is the truth, and a second copy of it would be a second thing to keep right.
 *
 * Shared so the web app's files panel and `isocan ls --kind` group the canvas
 * the same way. A kind that means one thing in a list and another in a filter
 * is worse than no kinds at all.
 */
import type { Item } from "./model.js";
export type ItemKind = "drawing" | "text" | "screen" | "image" | "video" | "document" | "site" | "canvas" | "other";
/** In the order a list should show them: what you made, then what you brought. */
export declare const ITEM_KINDS: readonly ItemKind[];
export declare function itemKind(item: Item): ItemKind;
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
export declare function isFramedItem(item: Item): boolean;
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
export declare function editableText(mimeType: string): boolean;
