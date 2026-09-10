/**
 * **Where a card's peek fits, in the window there actually is.**
 *
 * The peek chooses a side — below its card, or above when the bottom edge is
 * near — and the stylesheet caps it at 240px. But 240 is a guess about the
 * window: on a short one an upward peek still ran 94px past the top edge
 * (measured 2026-09-09, 800×300: card 98–213, peek −94–99). So the cap is
 * the SMALLER of the stylesheet's cap and the room on the chosen side, less
 * a breath off the viewport edge.
 *
 * Pure arithmetic, one function, because the component measures and this
 * decides — and a decision that took a real browser to find wrong earns a
 * test that runs without one.
 */

/**
 * The stylesheet's `max-height` on `.card-peek` — the cap when room is plenty.
 *
 * **It has to fit the five rows the peek promises.** `useCardPeek` takes
 * `majors(entries).slice(-5)`, so five seams is the norm on any active
 * canvas, and a seam that names an item draws a 44px thumbnail. Measured in
 * the browser rather than added up on paper: a plain row is 18px and a
 * LINKED row — the one with the thumbnail — is 51px. Five linked rows, four
 * 2px gaps, 8px and 10px of padding and the bottom hairline come to 282.
 *
 * At the original 240 the fifth row was sliced on every canvas whose recent
 * seams named items — and with overlay scrollbars there is no visible track
 * and no fade, so it read as broken rather than as scrollable.
 *
 * 288 rather than 282, because a cap that exactly equals the content is one
 * font metric away from slicing a row again, and there is no cost to slack:
 * the box only ever grows to its content, and `peekPlacement` clamps to the
 * room actually on screen. The cap is a ceiling, not a height.
 */
export const PEEK_CAP = 288;

/** Roughly what a full peek costs: below this, the other side is considered.
 *  Tracks `PEEK_CAP` — the question it asks is "is there room for a whole
 *  one down there", and it can only ask that in the cap's own units.
 *
 *  Not exported: nothing outside this file has ever read it, and an export
 *  nothing imports is a promise to nobody (`unused-exports`). `PEEK_CAP` is
 *  exported because the stylesheet's cap is asserted against it. */
const PEEK_ROOM = 288;

/** The breath left between the peek's far edge and the viewport edge. */
export const PEEK_MARGIN = 8;

export interface PeekPlacement {
  /** Open upward: more room above the card than below, and below is tight. */
  up: boolean;
  /** The real cap for this opening — never more than the stylesheet's. */
  maxHeight: number;
}

export function peekPlacement(
  cardTop: number,
  cardBottom: number,
  viewportHeight: number,
): PeekPlacement {
  const below = viewportHeight - cardBottom;
  const up = below < PEEK_ROOM && cardTop > below;
  const room = (up ? cardTop : below) - PEEK_MARGIN;
  return { up, maxHeight: Math.max(0, Math.min(PEEK_CAP, room)) };
}
