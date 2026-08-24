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

/**
 * Is a comment pin sitting on the item's top-right corner — where the star at
 * the end of the name row lives? Then the star moves to the other end, for the
 * same reason the badge moves: a pin is where somebody pointed, and the chrome
 * is ours.
 */
export function pinTakesTopRight(item: Item, canvas: CanvasState | null, scale: number): boolean {
  if (!canvas) return false;
  const reach = PIN_REACH / scale;
  const right = item.x + item.width;
  const top = item.y;
  return pinPositions(canvas).some(
    (pin) => Math.abs(pin.x - right) < reach && Math.abs(pin.y - top) < reach,
  );
}

/** Is the item big enough on screen to wear a label and a badge? */
export function hasRoomForChrome(width: number, height: number, scale: number): boolean {
  return width * scale > MIN_CHROME_WIDTH && height * scale > MIN_CHROME_HEIGHT;
}

/** Screen pixels the star keeps at the far end of the name row. */
export const STAR_ROOM = 26;
/**
 * Screen pixels the kind glyph keeps at the near end — the mark itself plus
 * the row's gap after it. Measured on the rendered row, not guessed.
 *
 * It is budgeted for the same reason the star is, and the reason is written in
 * `nameRoom` below: anything sharing the row that is NOT subtracted here gets
 * drawn through once the item is small enough on screen. That already happened
 * once with the star.
 */
export const GLYPH_ROOM = 16;
/** Under this many screen pixels a name says nothing, so it is not shown. */
export const MIN_NAME_ROOM = 48;
/**
 * What the title row is inset from each of the item's vertical edges, in
 * SCREEN pixels. Must equal `.item-titlebar`'s horizontal padding in
 * styles.css, and `chrome.test.ts` checks that it does — the two are one
 * number with two homes, and the day they disagree the name is measured
 * against a width it was not given.
 *
 * It does not change with selection. The row sits ABOVE the corner handles
 * rather than stepping around them, so the name gets the same width either
 * way and never re-ellipsizes on a click.
 *
 * And it is ZERO. Being above the handles means there is nothing to step
 * around, so the name starts where the item starts and the star ends where it
 * ends — the way the name of a thing normally sits over the thing. An inset
 * here buys nothing and reads as the label drifting inward from its own item.
 */
export const CHROME_INSET = 0;

/**
 * Screen pixels available to an item's name: what the item is worth on
 * screen, less the star at the other end and the row's own inset.
 *
 * **NO FLOOR, and that is the whole point of this function.** It used to be
 * `Math.max(MIN_NAME_ROOM, width * scale - STAR_ROOM)`. At 13% a 480-unit
 * item is 62 screen px and the star wants 26, so the floor handed the name 48
 * and it was drawn straight through the star. *A minimum that exceeds what
 * exists is not a minimum, it is an overlap with a reason.*
 *
 * Can go to zero, and below it: a caller that is handed a negative number is
 * being told there is no room at all, which is true, and `nameFits` is how it
 * asks.
 */
export function nameRoom(width: number, scale: number): number {
  return width * scale - STAR_ROOM - GLYPH_ROOM - CHROME_INSET * 2;
}

/**
 * Is there enough room to say the name at all? Below this the name is DROPPED
 * rather than squeezed — a star still means something at three pixels and
 * "H…" does not.
 */
export function nameFits(width: number, scale: number): boolean {
  return nameRoom(width, scale) >= MIN_NAME_ROOM;
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

/**
 * What the strip UNDER an item says, when anything does.
 *
 * There is one slot there and two things that want it, and they can share
 * because they are different kinds of message with different triggers: the
 * size is a fact about the thing you are manipulating right now, and the hint
 * is an evergreen tip shown while you point at something you could open.
 *
 * When both apply the SIZE wins. If you are dragging a corner the live number
 * is the entire point, and "double-click to interact" is a sentence you have
 * already read. Stacking both would also fill the space under an item, which
 * is where comment pins land.
 *
 * Entering an item silences both: inside, your clicks belong to the page.
 */
export type UnderSlot = "size" | "hint" | null;

export function underSlotFor(state: {
  entered: boolean;
  resizing: boolean;
  soleSelection: boolean;
  interactive: boolean;
}): UnderSlot {
  if (state.entered) return null;
  if (state.resizing || state.soleSelection) return "size";
  return state.interactive ? "hint" : null;
}
