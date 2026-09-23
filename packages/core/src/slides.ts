import type { CanvasContents, Item } from "./model.ts";
import { contextClosure } from "./canvas-group-context.ts";

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

/** The marked slides, in reading order. A speaker note is never a slide,
 *  whatever it wears: it is what you say about one. */
export function slides(canvas: CanvasContents): Item[] {
  return readingOrder(Object.values(canvas.items).filter((item) => isSlide(item) && !isNote(item) && item.properties?.kind !== "group"));
}

/**
 * What full screen actually flips through: the marked slides, or — with none
 * marked — every item. The fallback is the feature working before anyone has
 * set it up: a canvas of screens is already a deck, and marking is how you
 * narrow it, not how you switch it on. Speaker notes are left out of the
 * fallback too: a deck that projected its own notes would be the one thing a
 * presenter cannot forgive.
 */
export function deck(canvas: CanvasContents, groupId?: string): Item[] {
  // A scoped deck follows ownership, never the rectangle's accidental overlaps.
  const scoped = groupId ? { ...canvas, items: Object.fromEntries(contextClosure(canvas, [groupId]).flatMap(({ itemId }) => canvas.items[itemId] ? [[itemId, canvas.items[itemId]!]] : [])) } : canvas;
  const marked = slides(scoped);
  return marked.length > 0 ? marked : readingOrder(Object.values(scoped.items).filter((item) => !isNote(item) && item.properties?.kind !== "group"));
}

// ---------- speaker notes ----------

/**
 * **What you say about a slide, kept beside it.**
 *
 * A speaker note is a TEXT ITEM on the canvas that points at its slide —
 * `noteFor=<slideId>` on an ordinary text node — and that is the whole
 * design, for the reasons the mind map's edges are a property and its nodes
 * are items: the note versions, edits in the stage and in `$EDITOR`, is a
 * real `notes.md`, can be dragged, and is visible on the canvas next to the
 * slide it speaks for, where the person arranging the deck can read both at
 * once. No new op; no new kind — a note is words. Full screen shows it to
 * the presenter on a key, the deck view prints it under the slide, and every
 * export carries it.
 *
 * One note per slide: the first by id wins, so two people racing to add one
 * see the same one, and `slides note` re-words that one rather than making
 * a second.
 */
export const NOTE_FOR_PROP = "noteFor";

export function isNote(item: Item): boolean {
  return Boolean(item.properties?.[NOTE_FOR_PROP]);
}

/** The slide a note speaks for, or null when it is not a note. */
export function noteTarget(item: Item): string | null {
  return item.properties?.[NOTE_FOR_PROP] ?? null;
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
