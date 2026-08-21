/**
 * When ink stops being wet.
 *
 * Normally a drawing ends by itself: strokes settle into an item a moment
 * after you lift the pen, and strokes drawn inside that window join the same
 * drawing, because the gap between two strokes of one scribble is a fraction
 * of a second and the gap between two thoughts is longer.
 *
 * That guess is wrong for a drawing you make in passes — sketch a box here,
 * stop to look, pan across, add an arrow over there. Holding P says so out
 * loud: while the key is down the ink never settles, so everything drawn
 * during the hold is ONE drawing however long you take between strokes. Let
 * go and it settles, all of it, as a single SVG.
 *
 * The hold doubles as a momentary tool the way Z already does — tap to latch
 * the Pen, hold to borrow it — so both keys ask the same question of a keyup
 * and get the answer from here.
 */

/** How long the ink stays local after the pen lifts, when nobody is holding. */
export const INK_SETTLE_MS = 1500;

/** Past this, a tool key was HELD; under it, it was tapped. */
export const HOLD_MS = 250;

/**
 * How long to wait before settling the ink, or null when it must not settle
 * at all yet — the hold is the user telling us the drawing is not finished,
 * and no timer gets to disagree.
 */
export function settleDelay(session: { holdingPen: boolean }): number | null {
  return session.holdingPen ? null : INK_SETTLE_MS;
}

/**
 * Tap or hold? `downAt` is 0 when no press is open — a keyup we never saw the
 * keydown for (focus moved mid-press) is a tap, which changes a tool at worst.
 */
export function wasHeld(downAt: number, now: number): boolean {
  return downAt > 0 && now - downAt >= HOLD_MS;
}
