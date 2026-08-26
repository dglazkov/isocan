/**
 * When a press becomes a drag.
 *
 * Everything draggable on this canvas makes the same bargain: a press that
 * stays put is a CLICK on the thing (open it, select it), and one that travels
 * past a few pixels is a DRAG of it. The threshold is what keeps the two from
 * stealing each other — without it, opening a comment by clicking its pin
 * would nudge the pin a pixel, and dragging an item would also select-and-open
 * whatever was under the pointer.
 *
 * Four screen pixels, and screen rather than world so the gesture feels the
 * same at every zoom: the hand does not know what the canvas scale is.
 *
 * Here rather than at each site because it was at each site — ItemView had it,
 * and the pin layer written later would have picked its own number. One
 * bargain, one number, one place to change it.
 */
export const DRAG_SLOP = 4;

/** Has the pointer travelled far enough for this press to be a drag?
 *  Radial, so the threshold is the same in every direction — a diagonal
 *  nudge is not allowed to be twice as tolerant as a straight one. */
export function pastSlop(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) >= DRAG_SLOP;
}
