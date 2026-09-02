import type { CanvasContents, Item } from "./model.js";
/**
 * Where an item came from.
 *
 * A canvas fills up with things made FROM other things — three variations of a
 * screen, a spec written from a sketch, a page split out of a page — and that
 * relationship is the difference between a canvas and a pile. Recording it
 * costs one property, so it costs nothing: `parent=<itemId>` on the child,
 * carried by `item.add`, undone by undo, read by anyone.
 *
 * Deliberately not an op and not a field on Item: a convention in `properties`
 * is how this codebase adds a relationship without teaching every client,
 * every version of the reducer, and every stored inverse about it (see
 * annotation.ts, which does the same for ink).
 */
export declare const PARENT_PROP = "parent";
/** The item this one was made from, if it says so. */
export declare function parentOf(item: Item): string | null;
/** Properties that say "this came from that" — spread into `item.add`. */
export declare function lineageProperties(parentId: string): Record<string, string>;
/** What was made from this item, oldest first — the order they were made in
 * is the order they should be read in. */
export declare function childrenOf(canvas: CanvasContents, itemId: string): Item[];
