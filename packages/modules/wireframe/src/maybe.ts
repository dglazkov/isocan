import type { CanvasContents, Item } from "@isocan/core";
import { KEEP_PROP } from "./keep.ts";

/**
 * **A maybe, until it is kept** (round 1's cut, `MAYBE_FLOOR`).
 *
 * The composer's `item.add` records round 1's P(yes) on a screen it was
 * unsure the request needs, as the `wireMaybe` property — in the same op
 * that draws the screen, so there is no second write. Keep is the answer to
 * the question the mark asks, so the mark is DERIVED: shown while the screen
 * carries `wireMaybe` and not `wireKeep`, gone the moment it is kept, back
 * when it is unkept. Keep stays one `item.update`, one undo; nothing about
 * the maybe is ever written again. The canvas draws it OUTSIDE the screen
 * (a dashed outline round the item and a tag above its top edge —
 * `maybe-marks.tsx`), so it never covers the screen's content.
 */
/**
 * `wireMaybe` — spelled out here as well as in `record.ts` (which the entry
 * chunk's activation predicate reads): importing it from there would make
 * first paint export it to this lazy half. A test holds the two equal.
 */
export const MAYBE_PROP = "wireMaybe";

/** What the maybe tag says under a pointer: the mark asks one question, and ⇧K answers it. */
export const MAYBE_TOOLTIP = "Not in the prototype yet — ⇧K to use it";

/** Whether the canvas marks this item as a maybe: round 1 was unsure, and nobody has kept it yet. */
export function maybeMarked(item: Pick<Item, "properties">): boolean {
  const p = item.properties ?? {};
  return Boolean(p[MAYBE_PROP]) && !p[KEEP_PROP];
}

/** The items the canvas marks as maybes. */
export function maybeItems(canvas: CanvasContents): Item[] {
  return Object.values(canvas.items).filter(maybeMarked);
}

/** The property an `item.add` carries for a spec round 1 was unsure of: its P(yes), as text. */
export function maybeProperties(spec: { maybe?: true; need?: number }): Record<string, string> {
  return spec.maybe ? { [MAYBE_PROP]: (spec.need ?? 0).toFixed(2) } : {};
}

/** The tag's room, in screen px: the item's own title strip at its left (~6.5 px a character and its icon), the tag, and the version badge at its right corner. */
export function maybeTagNeed(title: string): number {
  return Math.round(title.length * 6.5 + 24 + 64 + 40);
}
