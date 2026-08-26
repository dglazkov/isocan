import type { CanvasContents, CommentThread, Item } from "@isocan/core";

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
 * The transform that holds a piece of item chrome at a constant SCREEN size.
 *
 * Chrome lives inside `.world`, which carries `scale(viewport.scale)`, so a
 * label written at 11px is 11 WORLD pixels — 11 on screen at 100% zoom and
 * under four at 30%. A name, a hint, a chip: none of them are content, and
 * none of them should shrink with the thing they describe.
 *
 * There are two ways to say this and item chrome uses both: a box that must
 * stay in world coordinates (an outline, a resize handle) divides its lengths
 * by `var(--scale)` in CSS, and everything else counter-scales with this.
 * Pair it with `transform-origin` on the class, so the chrome grows away from
 * the corner it is anchored to rather than around its own middle.
 *
 * It is a function in this file, and not `{ transform: … }` written inline at
 * each site, because it was written inline at each site and the reaction row
 * was the site that got missed — see `worldchrome.test.ts`, which now asks
 * every chrome element which of the two it uses.
 */
export function counterScale(scale: number): { transform: string } {
  return { transform: `scale(${1 / scale})` };
}

/**
 * The row under an item: counter-scaled AND given the item's width in screen
 * pixels, so ordinary flex layout works inside it.
 *
 * This is the piece that took three attempts. Chrome under an item wants three
 * things at once — marks pinned LEFT, the hint CENTRED, the size and the
 * full-screen button pinned RIGHT — and a centre and a right edge only exist
 * if the row knows how wide the item is.
 *
 * Pinning the row to both of the item's edges gives it that width in WORLD
 * units, and then counter-scaling it multiplies that width by 1/scale: at 20%
 * zoom the box is five times the item's width, so `flex-end` lands far off the
 * right of the item and `center` is only right by luck of the symmetry. That
 * is not a fixable alignment, it is the wrong box.
 *
 * So the row is pinned at the LEFT only, scaled from that corner, and told its
 * width directly — `width * scale`, which inside an element scaled by
 * `1 / scale` is exactly the item's width as drawn. Everything inside is then
 * measured in screen pixels, and `flex: 1` on the middle slot does what it
 * looks like it does: centre the hint in whatever room the marks left it, and
 * give the room back as they are removed.
 */
export function underRow(width: number, scale: number): { transform: string; width: number } {
  return { ...counterScale(scale), width: width * scale };
}

/** Is the item big enough on screen to wear a label and a badge? */
export function hasRoomForChrome(width: number, height: number, scale: number): boolean {
  return width * scale > MIN_CHROME_WIDTH && height * scale > MIN_CHROME_HEIGHT;
}

/**
 * Screen pixels the under-item row needs before "Full screen" is spelled out
 * beside its icon, WITH NOTHING WORN — marks are added per chip below.
 *
 * **Measured on the rendered row (this is the number's third life, and the
 * first two both went wrong by skipping this step).** With the label: the
 * react button is 22, the labeled full-screen button 91 (11px icon + 5px gap
 * + text + padding), the size chip 86, and two 6px slot gaps — 211 for the
 * line, plus 10 of slack. The first 210 was measured for a label-ONLY button
 * (77px), deleted, then resurrected unchanged against a button that had
 * grown 14px — so at the old threshold the row overflowed the item in the
 * 210–212 band. `ICON_ROOM`'s comment, thirty lines down, already says why:
 * a budget copied forward from the thing it used to describe is a budget
 * that is wrong.
 */
export const FULL_LABEL_ROOM = 221;

/**
 * Screen pixels each worn mark adds to what the row must hold — a chip is
 * 42.3 measured plus the marks row's 4px gap, rounded up so a double-digit
 * count does not tip a row the budget said fits.
 *
 * This exists because the first threshold budgeted only the ITEM's width
 * while the row's contents vary with marks: two chips on a 215px item ran
 * the size chip 84 measured pixels past the item's right edge, with the
 * label proudly spelled out. The room test has to charge for what the row
 * is actually carrying. (The first value here was 43, from a chip measured
 * at a different zoom — re-measured at rendered size the day it shipped.)
 */
export const MARK_ROOM = 47;

/** Does the row under the item have room to spell the button label out,
 * given how many marks the item is wearing? */
export function underRowSpellsItOut(width: number, scale: number, marks: number): boolean {
  return width * scale >= FULL_LABEL_ROOM + marks * MARK_ROOM;
}


/**
 * Screen pixels the row keeps at its FAR END, past the name.
 *
 * It was the star's, and the star is gone — reactions replaced it, and they
 * live under the item rather than in this row. The reservation stays because
 * the row's far end is still occupied when an agent is working there: the
 * work chip sits at that end with `flex: none`, and a name allowed to run the
 * full width would be squeezed into it the moment somebody started working.
 *
 * Kept at the star's 26 deliberately rather than retuned to the chip's real
 * width: this is the number every scale guard was measured against, and a
 * layout change is not what removing a button should smuggle in.
 */
export const ROW_END_ROOM = 26;
/**
 * Screen pixels the kind icon keeps at the near end — the mark itself plus the
 * row's gap after it. **Measured on the rendered row (13 + 6), not guessed**,
 * and re-measured when the mark changed: it was a text glyph at 16, and an
 * icon drawn to be legible is a different width. A budget copied forward from
 * the thing it used to describe is a budget that is wrong.
 *
 * It is budgeted for the same reason the row's far end is, and the reason is
 * in `titleRow` below: anything sharing the row that is NOT subtracted gets
 * drawn through once the item is small enough on screen. That already
 * happened once, to the star that used to sit at that far end.
 */
export const ICON_ROOM = 19;
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
 * around, so the name starts where the item starts and the row ends where it
 * ends — the way the name of a thing normally sits over the thing. An inset
 * here buys nothing and reads as the label drifting inward from its own item.
 */
export const CHROME_INSET = 0;

/** What the title row shows at this size, and how much of it the name gets. */
export interface TitleRow {
  icon: boolean;
  name: boolean;
  /** Screen pixels the name may claim. Meaningless when `name` is false. */
  nameRoom: number;
}

/**
 * What fits on the title row, in the order things yield.
 *
 * **NO FLOOR ON THE ROOM ITSELF**, which is the older half of this function.
 * It used to be `Math.max(MIN_NAME_ROOM, width * scale - ROW_END_ROOM)`. At 13% a
 * 480-unit item is 62 screen px and the far end wants 26, so the floor handed
 * the name 48 and it was drawn straight through the star that lived there. *A minimum that exceeds
 * what exists is not a minimum, it is an overlap with a reason.* Below the
 * width where a name says anything the name is DROPPED rather than squeezed:
 * "H…" is a smudge.
 *
 * **The icon yields to the name, and then outlives it.** Three sizes, and the
 * order is the point:
 *
 * 1. Room for everything — icon, name, and the row's far end.
 * 2. Not enough for all three: the ICON goes first. Of the two, the name is
 *    the more specific answer — "which one is this" beats "what kind is this"
 *    — so the kind mark must never be the reason a name disappeared. This is
 *    also what keeps the name's threshold exactly where it was before the
 *    glyph existed, rather than 3 points of zoom worse.
 * 3. Not enough for a name either: the name goes, and the icon comes BACK.
 *    A shape still reads at a size where text does not. This band used to
 *    show a bare star and nothing else, which said the least of any state
 *    the row has ever had: that an item exists, which you could already see.
 */
export function titleRow(width: number, scale: number): TitleRow {
  const available = width * scale - ROW_END_ROOM - CHROME_INSET * 2;
  const withIcon = available - ICON_ROOM;
  if (withIcon >= MIN_NAME_ROOM) return { icon: true, name: true, nameRoom: withIcon };
  if (available >= MIN_NAME_ROOM) return { icon: false, name: true, nameRoom: available };
  return { icon: available >= ICON_ROOM, name: false, nameRoom: available };
}

/** Screen pixels available to an item's name — see `titleRow`. */
export function nameRoom(width: number, scale: number): number {
  return titleRow(width, scale).nameRoom;
}

/** Is there enough room to say the name at all? */
export function nameFits(width: number, scale: number): boolean {
  return titleRow(width, scale).name;
}

/** Every pin's world position — anchored pins ride their item, and the main
 * thread has no pin at all. */
function pinPositions(canvas: CanvasContents): Array<{ x: number; y: number }> {
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
export function badgeCorner(item: Item, canvas: CanvasContents | null, scale: number): BadgeCorner {
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
