import type { CanvasContents, Item } from "./model.js";
/** Explicit parents, nearest first; historical areas retain their geometric scope. */
export declare function canvasScopes(canvas: CanvasContents, item: Item): Item[];
/** A group's descendants belong even when moved; overlapping outsiders never do. */
export declare function inCanvasScope(canvas: CanvasContents, scope: Item, item: Item): boolean;
