import type { Item } from "@isocan/core";
import type { Viewport } from "./viewport.ts";
import { worldToScreen } from "./viewport.ts";
import type { ScreenBox } from "./spot.ts";

/**
 * **When a line between a message and the thing it made is honest.**
 *
 * A tether is a strong claim: it says "that one, there". It is worth drawing
 * only when a person can follow it with their eye and arrive at something —
 * so it is drawn under three conditions and skipped otherwise, and the chip
 * carries the meaning on its own when it is skipped.
 *
 * - **The item is on screen.** A line to something two screens away points
 *   off the edge and is answered by nothing. Worse, it points at a place
 *   where something ELSE is, which is a line that lies.
 * - **Within ±120px vertically.** A near-horizontal line reads as a
 *   connection; a steep one reads as a diagonal scribble across the canvas
 *   and crosses whatever is between.
 * - **Under 400px of run.** Past that the eye stops tracking it and starts
 *   asking what it is, which is the opposite of what a tether is for.
 *
 * The costs of being wrong are asymmetric: a missing tether costs a nicety,
 * and a tether to the wrong thing costs the reader's trust in every other
 * one. So each rule is a reason to NOT draw.
 */
export const TETHER_MAX_RISE = 120;
export const TETHER_MAX_RUN = 400;

export interface Tether {
  itemId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Screen space, never world space. A tether joins a chip in a panel to a
 * thing on the canvas, and those two live in different coordinate systems —
 * drawing it inside `.world` would scale the line with the zoom and leave one
 * end anchored to a panel that does not scale at all.
 */
export function tetherFor(
  from: { x: number; y: number },
  item: Item,
  viewport: Viewport,
  within: ScreenBox,
): Tether | null {
  // The item's left edge, vertically centred: the near side, so the line ends
  // where the thing begins rather than plunging into the middle of it.
  const topLeft = worldToScreen(viewport, item.x, item.y);
  const bottomRight = worldToScreen(viewport, item.x + item.width, item.y + item.height);
  const to = { x: topLeft.x, y: (topLeft.y + bottomRight.y) / 2 };

  const onScreen =
    bottomRight.x > within.left &&
    topLeft.x < within.right &&
    bottomRight.y > within.top &&
    topLeft.y < within.bottom;
  if (!onScreen) return null;

  /**
   * **The run that counts is the run you can SEE.**
   *
   * The chip sits inside the rail, so the first few hundred pixels of every
   * tether are hidden behind the panel it starts in. Measuring from the chip
   * therefore measures mostly invisible line — and worse, it makes the rule
   * depend on the rail's width: at 320px the band where a tether is allowed
   * is 200px deep, and dragging the rail out to 448 shrinks it to 76 and then
   * to nothing. A person widening a panel would have silently switched the
   * feature off and had no way to know why.
   *
   * So the limit applies from wherever the line emerges into view. What the
   * eye actually tracks is the visible segment, which is the thing the number
   * was chosen to describe.
   */
  const run = to.x - Math.max(from.x, within.left);
  // Forward, not backward: a tether that doubles back across the panel it
  // started in is not readable as a pointer at anything.
  if (to.x <= from.x || run <= 0 || run > TETHER_MAX_RUN) return null;
  if (Math.abs(to.y - from.y) > TETHER_MAX_RISE) return null;

  return { itemId: item.id, x1: from.x, y1: from.y, x2: to.x, y2: to.y };
}
