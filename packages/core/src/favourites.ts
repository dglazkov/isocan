/**
 * Starred items: the handful on a canvas worth getting back to quickly.
 *
 * Kept as an item property rather than in one browser's storage, which makes
 * it part of the canvas: the star is there tomorrow, on the other machine, and
 * an agent can read which screens the person actually cares about right now —
 * cheap, honest context that nothing else on the canvas carries.
 *
 * The trade is that a star is shared. On a canvas built by a few people and
 * their agents that reads as "this matters here" rather than "I like this",
 * which is the more useful of the two.
 */

import type { CanvasContents, Item } from "./model.ts";
import type { MetaPatch } from "./ops.ts";

export const STAR_PROP = "star";

export function isStarred(item: Item): boolean {
  return item.properties[STAR_PROP] === "1";
}

/** The patch that turns a star on or off — `item.update`, nothing new. */
export function starPatch(on: boolean): MetaPatch {
  return on ? { properties: { [STAR_PROP]: "1" } } : { removeProperties: [STAR_PROP] };
}

/** Everything starred, most recently touched first: a shortlist reads best in
 * the order things last happened. */
export function starredItems(canvas: CanvasContents): Item[] {
  return Object.values(canvas.items)
    .filter(isStarred)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
}
