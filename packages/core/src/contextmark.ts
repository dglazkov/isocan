import type { CanvasContents, Item } from "./model.ts";

/**
 * **Pinning something into context, and keeping something out of it.**
 *
 * Stage 2 of `docs/projects/context/design.md`: *"the obvious verbs on that
 * list — pin an item into context, exclude one."*
 *
 * A property, not an operation. `item.update` already carries properties, so
 * this adds **zero new op types** — the same answer `mapParent` reached for
 * edges, and for the same reason: a fact about an item belongs on the item,
 * where it replicates, undoes and is visible to everybody by construction.
 *
 * **Stage 1's stand-in stays.** Reactions were "the closest thing the canvas
 * has to *these matter*", and they still are — somebody putting 👍 on a screen
 * is real evidence. What they were not is *deliberate*: a reaction is a
 * response to a thing, and a pin is a decision about what an agent should
 * read. Both are now listed, separately, because collapsing them would lose
 * exactly the distinction the verb was asked for.
 */
export const CONTEXT_PROP = "context";

type ContextMark = "pinned" | "excluded";

/** What somebody decided about this item, or nothing. */
export function contextMark(item: Item): ContextMark | null {
  const raw = item.properties?.[CONTEXT_PROP];
  return raw === "pinned" || raw === "excluded" ? raw : null;
}

export function pinnedItems(canvas: CanvasContents): Item[] {
  return Object.values(canvas.items).filter((item) => contextMark(item) === "pinned");
}

/**
 * **Excluded means "an agent should skip this", not "this is deleted".**
 *
 * The item stays on the canvas, keeps its versions and its comments, and is
 * exactly as visible as it was. The only thing that changes is what a reader
 * assembling context is told — which is why this is a mark and not the trash,
 * and why nothing here removes anything.
 */
export function excludedItems(canvas: CanvasContents): Item[] {
  return Object.values(canvas.items).filter((item) => contextMark(item) === "excluded");
}

/**
 * The patch that sets or clears a mark — one place, so the CLI and the app
 * cannot spell the property two ways.
 *
 * **Clearing uses `removeProperties`, which the vocabulary already has.** The
 * first version wrote `{ properties: { context: null } }`, inventing a null
 * convention for a thing `item.update` could already express — and the
 * typechecker refused it, correctly. `properties` MERGES, so omitting the key
 * does not remove it: an unpin that quietly left the pin on would be the worst
 * of the three outcomes.
 */
export function markPatch(
  mark: ContextMark | null,
): { properties: Record<string, string> } | { removeProperties: string[] } {
  return mark === null
    ? { removeProperties: [CONTEXT_PROP] }
    : { properties: { [CONTEXT_PROP]: mark } };
}

/** What a mark is called where somebody reads it. */
export function markLabel(mark: ContextMark): string {
  return mark === "pinned" ? "pinned into context" : "kept out of context";
}
