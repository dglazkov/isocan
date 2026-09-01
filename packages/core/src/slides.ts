import type { CanvasContents, Item } from "./model.ts";

/**
 * **The slide deck** (#87): mark items as slides, and full screen flips
 * through just those.
 *
 * A property, not an operation. `item.update` already carries properties, so
 * this adds **zero new op types** — the same answer `contextmark` and
 * `mapParent` reached, and for the same reason: a fact about an item belongs
 * on the item, where it replicates, undoes and is visible to everybody by
 * construction.
 *
 * Not a reaction, though a reaction was the obvious stand-in: a reaction
 * belongs to the actor who left it, so nobody else could take a slide out of
 * the deck without impersonating them. Whether an item is a slide is a fact
 * about the ITEM, decided by whoever last decided it — the shape a property
 * already has.
 *
 * There is no deck URL to build. Full screen is already an address
 * (`itemPath`), so "share the deck" is handing somebody the first slide's
 * full-screen link — the route the item menu's "Copy link" and `isocan open`
 * both hand out today.
 */
export const SLIDE_PROP = "slide";

/** The mark a slide wears where one is drawn — the item's title bar, the
 * menu entry, the CLI listing. One constant so the surfaces cannot pick
 * different film equipment. */
export const SLIDE_EMOJI = "🎬";

/** Is this item in the deck? Any value counts — the property's presence is
 * the mark, so a later version can put an ordering or a note in the value
 * without un-marking every deck made before it. */
export function isSlide(item: Item): boolean {
  return Boolean(item.properties?.[SLIDE_PROP]);
}

/**
 * The patch that marks or unmarks — one place, so the CLI and the app cannot
 * spell the property two ways. Clearing uses `removeProperties`, because
 * `properties` MERGES: an unmark that quietly left the mark on would put the
 * item back on the projector next talk.
 */
export function slidePatch(
  on: boolean,
): { properties: Record<string, string> } | { removeProperties: string[] } {
  return on ? { properties: { [SLIDE_PROP]: "yes" } } : { removeProperties: [SLIDE_PROP] };
}

/**
 * **What a slide gesture on a SELECTION means, and which items it moves.**
 *
 * A single item toggles, which is obvious. Ten items where six are already
 * slides do not, and the wrong answer here loses work: reading "some are on"
 * as "turn everything off" throws away marks somebody deliberately made.
 *
 * So a mixed selection turns them all ON, and only a selection that is
 * ALREADY all slides turns off. That is the answer a tri-state checkbox
 * gives, and — more to the point — the one `isocan slides add <items...>`
 * has given since the day it shipped: mark the unmarked, skip the rest, say
 * how many. The app was the surface that could not do it at all, its menu
 * entry `disabled` for any selection over one, which made a rule the CLI
 * enforced into a habit the app did not know.
 *
 * `changing` is only the items that actually move, so the gesture writes
 * nothing for the six that were already right — fewer ops, and a notice that
 * can say what really happened.
 */
export function slideIntent(items: readonly Item[]): { on: boolean; changing: Item[] } {
  const on = !(items.length > 0 && items.every(isSlide));
  return { on, changing: items.filter((item) => isSlide(item) !== on) };
}

/**
 * **Reading order: rows top to bottom, each row left to right.**
 *
 * The canvas has no z-order and no slide numbers, but it has geometry, and a
 * deck laid out on a canvas is laid out the way a page is read. An item joins
 * the current row while it starts above the row's running bottom edge —
 * neighbours at slightly different heights stay one row — and ties break by
 * id, because a deck that reorders itself when nothing changed is a deck
 * nobody trusts (the `canvassort` rule).
 */
export function readingOrder(items: readonly Item[]): Item[] {
  const byTop = [...items].sort(
    (a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id),
  );
  const rows: Item[][] = [];
  let bottom = -Infinity;
  for (const item of byTop) {
    if (rows.length === 0 || item.y >= bottom) {
      rows.push([item]);
      bottom = item.y + item.height;
    } else {
      rows[rows.length - 1]!.push(item);
      bottom = Math.max(bottom, item.y + item.height);
    }
  }
  return rows.flatMap((row) =>
    row.sort((a, b) => a.x - b.x || a.y - b.y || a.id.localeCompare(b.id)),
  );
}

/** The marked slides, in reading order. */
export function slides(canvas: CanvasContents): Item[] {
  return readingOrder(Object.values(canvas.items).filter(isSlide));
}

/**
 * What full screen actually flips through: the marked slides, or — with none
 * marked — every item. The fallback is the feature working before anyone has
 * set it up: a canvas of screens is already a deck, and marking is how you
 * narrow it, not how you switch it on.
 */
export function deck(canvas: CanvasContents): Item[] {
  const marked = slides(canvas);
  return marked.length > 0 ? marked : readingOrder(Object.values(canvas.items));
}

/**
 * The slide a flip lands on, or null at the deck's edge — stay put rather
 * than wrap, the same answer the spatial walk gives at the canvas's edge.
 *
 * Standing OUTSIDE the deck (an unmarked item opened full screen while slides
 * exist), a flip steps INTO it: forward to the first slide, back to the last.
 */
export function deckStep(canvas: CanvasContents, currentId: string, delta: 1 | -1): Item | null {
  const order = deck(canvas);
  const at = order.findIndex((item) => item.id === currentId);
  if (at === -1) return order[delta === 1 ? 0 : order.length - 1] ?? null;
  return order[at + delta] ?? null;
}
