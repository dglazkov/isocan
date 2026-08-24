import type { CanvasContents, Item } from "./model.ts";

/**
 * Where an item came from.
 *
 * A canvas fills up with things made FROM other things — three variations of a
 * screen, a spec written from a sketch, a page split out of a page — and that
 * relationship is the difference between a canvas and a pile. Recording it
 * costs one property, so it costs nothing: `parent=<itemId>` on the child,
 * carried by `item.add`, undone by undo, read by anyone.
 *
 * Deliberately not an op and not a field on Item: a convention in `properties`
 * is how this codebase adds a relationship without teaching every client,
 * every version of the reducer, and every stored inverse about it (see
 * annotation.ts, which does the same for ink).
 */

export const PARENT_PROP = "parent";

/** The item this one was made from, if it says so. */
export function parentOf(item: Item): string | null {
  const parent = item.properties[PARENT_PROP];
  return parent && parent.length > 0 ? parent : null;
}

/** Properties that say "this came from that" — spread into `item.add`. */
export function lineageProperties(parentId: string): Record<string, string> {
  return { [PARENT_PROP]: parentId };
}

/** What was made from this item, oldest first — the order they were made in
 * is the order they should be read in. */
export function childrenOf(canvas: CanvasContents, itemId: string): Item[] {
  return Object.values(canvas.items)
    .filter((item) => parentOf(item) === itemId)
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
}

/**
 * Items nothing was made from — the tops of the trees, in the order they sit
 * on the canvas. A parent that has been deleted leaves its children as roots
 * rather than orphans pointing at nothing: the canvas shows what exists.
 */
export function rootItems(canvas: CanvasContents): Item[] {
  const items = Object.values(canvas.items);
  return items
    .filter((item) => {
      const parent = parentOf(item);
      return parent === null || canvas.items[parent] === undefined;
    })
    .sort((a, b) => a.x - b.x || a.y - b.y);
}

/** The whole line of descent under an item, depth first, parents before
 * children. Cycles are impossible to create honestly but trivial to write by
 * hand, so they are cut rather than trusted. */
export function descendantsOf(canvas: CanvasContents, itemId: string, seen = new Set<string>()): Item[] {
  if (seen.has(itemId)) return [];
  seen.add(itemId);
  const out: Item[] = [];
  for (const child of childrenOf(canvas, itemId)) {
    out.push(child, ...descendantsOf(canvas, child.id, seen));
  }
  return out;
}
