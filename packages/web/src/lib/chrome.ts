import type { CanvasState, CommentThread, Item } from "@isocan/core";

/**
 * Where an item's own chrome goes, and whether there is room for it at all.
 *
 * Item chrome (the name above it, the version count) lives INSIDE the scaled
 * world, while comment pins are drawn in screen space on a layer above it. So
 * as the canvas zooms out the chrome shrinks while the pins stay pointer-sized,
 * and a pin dropped near a corner does not merely crowd the badge — it covers
 * something it also paints on top of.
 *
 * Two rules follow, and both live here so they can be reasoned about without a
 * browser: chrome holds its size (the caller counter-scales), and the badge
 * yields its corner, because a pin marks a place a person chose and the badge
 * is ours to move.
 *
 * The badge lives at the BOTTOM-right, and the same place on every item — a
 * count you have to hunt for is worse than one you have to learn once. Bottom
 * rather than top for two reasons: the top edge already carries the item's
 * name, and the version plies cascade down and to the right, so the count sits
 * where the stack it counts is visibly going.
 */

/** How close a pin has to be, in SCREEN pixels, to claim a corner. */
export const PIN_REACH = 46;

/** Below this an item is a speck: the plies still say there is a stack, the
 * pins still say someone spoke, and a label would be bigger than the thing. */
const MIN_CHROME_WIDTH = 56;
const MIN_CHROME_HEIGHT = 40;

export type BadgeCorner = "se" | "ne";

/** Is the item big enough on screen to wear a label and a badge? */
export function hasRoomForChrome(width: number, height: number, scale: number): boolean {
  return width * scale > MIN_CHROME_WIDTH && height * scale > MIN_CHROME_HEIGHT;
}

/** Every pin's world position — anchored pins ride their item, and the main
 * thread has no pin at all. */
function pinPositions(canvas: CanvasState): Array<{ x: number; y: number }> {
  return Object.values(canvas.threads)
    .filter((thread: CommentThread) => !thread.main)
    .map((thread) => {
      const anchor = thread.anchorItemId ? canvas.items[thread.anchorItemId] : undefined;
      return anchor ? { x: anchor.x + thread.x, y: anchor.y + thread.y } : { x: thread.x, y: thread.y };
    });
}

/**
 * The badge's corner: bottom-right on every item, and top-right only when a pin
 * has taken the bottom one — which is rare, because people drop comments on the
 * thing they are talking about rather than under it.
 *
 * The comparison happens in world units, so the pin's screen-space footprint is
 * converted by the zoom: the same pin claims more world the further out you are.
 */
export function badgeCorner(item: Item, canvas: CanvasState | null, scale: number): BadgeCorner {
  if (!canvas) return "se";
  const reach = PIN_REACH / scale;
  const right = item.x + item.width;
  const bottom = item.y + item.height;
  for (const pin of pinPositions(canvas)) {
    if (Math.abs(pin.x - right) < reach && Math.abs(pin.y - bottom) < reach) return "ne";
  }
  return "se";
}
