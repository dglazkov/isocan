/**
 * An annotation: ink that is ABOUT something.
 *
 * The Pen already makes drawings. What makes one an annotation is that it
 * belongs to an item — the way an anchored comment belongs to one — so it can
 * be pointed at, acted on, and cleared when the thing it asked for is done.
 * Ink on bare canvas stays a drawing: nobody asked for anything, so there is
 * nothing to clear.
 *
 * Deliberately NOT a new op or a new kind: an annotation is an ordinary
 * drawing item wearing two properties, so undo, versions, GC, `isocan ls`, and
 * every older client keep working without knowing the word.
 */
import type { CanvasContents, Item } from "./model.js";
/** The item this ink is about. */
export declare const ANNOTATES_PROP = "annotates";
/** Where it lands on that item, as fractions: "x,y,w,h". */
export declare const REGION_PROP = "region";
export interface Box {
    x: number;
    y: number;
    width: number;
    height: number;
}
/** A rectangle in fractions of the target: 0,0 is its top-left, 1,1 bottom-right. */
export interface Region {
    x: number;
    y: number;
    width: number;
    height: number;
}
/**
 * Where `ink` sits on `target`, in fractions rather than pixels — so an agent
 * can say "the right-hand third of the header" without parsing a single path,
 * and the answer survives the target being resized.
 */
export declare function regionOf(ink: Box, target: Box): Region;
/** The properties that make a drawing an annotation of `targetId`. */
export declare function annotationProperties(targetId: string, region: Region): Record<string, string>;
/** The item this one annotates, or null when it is just a drawing. */
export declare function annotationTarget(item: Item): string | null;
export declare function isAnnotation(item: Item): boolean;
/** The stored region, or null when it is missing or malformed. */
export declare function annotationRegion(item: Item): Region | null;
/** Everything annotating this item — what travels with it, and what an agent
 * should clear once it has done what the ink asked. */
export declare function annotationsOf(canvas: CanvasContents, itemId: string): Item[];
/**
 * Which item a piece of ink is about: the one it overlaps most, needing a real
 * share of the ink to count. A scribble that merely clips a neighbour's corner
 * is a drawing near it, not a note about it.
 */
export declare function annotationTargetFor(ink: Box, candidates: readonly Item[], minimumShare?: number): Item | null;
