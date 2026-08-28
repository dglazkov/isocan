import type { Item } from "@isocan/core";
import { nearestFreeSpot } from "@isocan/core";
import { screenToWorld, type Viewport } from "./viewport.ts";

/**
 * **Somewhere clear, and somewhere you can see.**
 *
 * New items are already kept off each other: `resolvePlacement` runs every
 * `item.add` through `nearestFreeSpot`, so nothing lands on top of anything.
 * What that rule cannot know is where you are LOOKING. It searches outward in
 * rings of the item's own size, and for a projected site — 800x600 — two or
 * three rings is well past the edge of the screen. The item is placed
 * correctly and you never see it arrive, which reads as nothing happening.
 *
 * So this picks the spot first, from the one thing the daemon does not have:
 * the viewport. It walks the visible area for a place the box fits, nearest
 * the middle first, and hands over real coordinates. The daemon still applies
 * its own rule to them — a spot that is genuinely free comes back unchanged,
 * so agreeing with it costs nothing and disagreeing is impossible.
 *
 * When nothing on screen is big enough, it returns the centre and lets the
 * daemon do what it always did. A cramped view is not a reason to refuse.
 */

/**
 * The screen rectangle an item may land in, in CSS pixels.
 *
 * Taken as an argument rather than read from `window` here, because the
 * chrome that must be avoided is not a constant: the tool rail is always
 * there, but the left dock is a panel somebody opened, and its width is a
 * thing they can drag. The caller can see all of that; this cannot, and
 * guessing at it with fixed insets is how an item ends up behind the Chat.
 */
export interface ScreenBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export function spotInView(
  viewport: Viewport,
  items: readonly Item[],
  width: number,
  height: number,
  within: ScreenBox,
): { x: number; y: number } {
  const topLeft = screenToWorld(viewport, within.left, within.top);
  const bottomRight = screenToWorld(viewport, within.right, within.bottom);
  const centre = {
    x: Math.round((topLeft.x + bottomRight.x) / 2 - width / 2),
    y: Math.round((topLeft.y + bottomRight.y) / 2 - height / 2),
  };

  const occupied = items.map((i) => ({
    id: i.id,
    x: i.x,
    y: i.y,
    width: i.width,
    height: i.height,
  }));
  // `nearestFreeSpot` returning the box it was given IS "this spot is clear" —
  // asking it rather than re-implementing `overlaps` here means there is one
  // definition of clear, and it is the daemon's.
  const isClear = (x: number, y: number) => {
    const at = nearestFreeSpot({ x, y, width, height }, occupied);
    return at.x === x && at.y === y;
  };
  if (isClear(centre.x, centre.y)) return centre;

  // A coarse sweep of the visible area, nearest the middle first. Coarse on
  // purpose: this is looking for a gap somebody would call empty, not for the
  // tightest fit, and a fine grid over a big canvas is a lot of work to land
  // an item two pixels left of where a person would have put it.
  const step = Math.max(40, Math.round(Math.min(width, height) / 3));
  const candidates: { x: number; y: number; d: number }[] = [];
  for (let x = Math.round(topLeft.x); x + width <= bottomRight.x; x += step) {
    for (let y = Math.round(topLeft.y); y + height <= bottomRight.y; y += step) {
      const dx = x - centre.x;
      const dy = y - centre.y;
      candidates.push({ x, y, d: dx * dx + dy * dy });
    }
  }
  candidates.sort((a, b) => a.d - b.d);
  for (const spot of candidates) {
    if (isClear(spot.x, spot.y)) return { x: spot.x, y: spot.y };
  }
  return centre;
}
