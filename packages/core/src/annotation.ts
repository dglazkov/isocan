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

import { isDrawingItem } from "./drawing.ts";
import type { CanvasContents, Item } from "./model.ts";

/** The item this ink is about. */
export const ANNOTATES_PROP = "annotates";
/** Where it lands on that item, as fractions: "x,y,w,h". */
export const REGION_PROP = "region";

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
export function regionOf(ink: Box, target: Box): Region {
  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  const width = Math.max(target.width, 1);
  const height = Math.max(target.height, 1);
  const x = clamp((ink.x - target.x) / width);
  const y = clamp((ink.y - target.y) / height);
  return {
    x: Number(x.toFixed(3)),
    y: Number(y.toFixed(3)),
    width: Number((clamp((ink.x + ink.width - target.x) / width) - x).toFixed(3)),
    height: Number((clamp((ink.y + ink.height - target.y) / height) - y).toFixed(3)),
  };
}

/** The properties that make a drawing an annotation of `targetId`. */
export function annotationProperties(targetId: string, region: Region): Record<string, string> {
  return {
    [ANNOTATES_PROP]: targetId,
    [REGION_PROP]: `${region.x},${region.y},${region.width},${region.height}`,
  };
}

/** The item this one annotates, or null when it is just a drawing. */
export function annotationTarget(item: Item): string | null {
  const target = item.properties[ANNOTATES_PROP];
  return isDrawingItem(item) && target ? target : null;
}

export function isAnnotation(item: Item): boolean {
  return annotationTarget(item) !== null;
}

/** The stored region, or null when it is missing or malformed. */
export function annotationRegion(item: Item): Region | null {
  const raw = item.properties[REGION_PROP];
  if (!raw) return null;
  const parts = raw.split(",").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  return { x: parts[0]!, y: parts[1]!, width: parts[2]!, height: parts[3]! };
}

/** Everything annotating this item — what travels with it, and what an agent
 * should clear once it has done what the ink asked. */
export function annotationsOf(canvas: CanvasContents, itemId: string): Item[] {
  return Object.values(canvas.items).filter((item) => annotationTarget(item) === itemId);
}

/**
 * Which item a piece of ink is about: the one it overlaps most, needing a real
 * share of the ink to count. A scribble that merely clips a neighbour's corner
 * is a drawing near it, not a note about it.
 */
export function annotationTargetFor(
  ink: Box,
  candidates: readonly Item[],
  minimumShare = 0.6,
): Item | null {
  const inkArea = Math.max(ink.width * ink.height, 1);
  let best: { item: Item; share: number } | null = null;
  for (const item of candidates) {
    if (isDrawingItem(item)) continue; // ink about ink is not a thing
    const overlapW = Math.min(ink.x + ink.width, item.x + item.width) - Math.max(ink.x, item.x);
    const overlapH = Math.min(ink.y + ink.height, item.y + item.height) - Math.max(ink.y, item.y);
    if (overlapW <= 0 || overlapH <= 0) continue;
    const share = (overlapW * overlapH) / inkArea;
    if (share >= minimumShare && (!best || share > best.share)) best = { item, share };
  }
  return best?.item ?? null;
}
