import type { CanvasContents, Item } from "./model.ts";
import { PARENT_PROP } from "./lineage.ts";
import { PLACEMENT_GAP, nearestFreeSpot } from "./placement.ts";

/**
 * **Copying items, and the thing that makes it more than a loop.**
 *
 * One item is easy. A SELECTION is not, because the arrangement is part of
 * what was copied: four screens in a row must paste as four screens in a row,
 * and a caption under a mock must paste under it. Placing each item
 * independently loses that, and it loses it silently — every item lands
 * somewhere legal and the group is gone.
 *
 * So the group is placed as ONE box: find clear ground for the bounding
 * rectangle, then put every item at the offset it already had inside it.
 *
 * That also sidesteps the daemon's placement rule rather than fighting it.
 * `resolvePlacement` nudges a new item off anything it lands on, which would
 * scatter a pasted group one item at a time — but it only nudges on an actual
 * collision, so a group placed on ground that is clear for the WHOLE box has
 * no collisions to nudge. Nothing has to be exempted and no core predicate
 * changes; the arrangement survives because it was never in the way.
 *
 * The one case this does not cover: items that deliberately overlap EACH
 * OTHER. The second one collides with the first wherever the group goes, and
 * is nudged. Annotations — the common overlap — are already exempt from
 * nudging by `positionIsMeaningful`, so the case left over is rare and is
 * better fixed by grouping in the oplog than by weakening the placement rule.
 */

/** The rectangle a set of items occupies. Null when the set is empty. */
export function boundsOf(items: readonly Item[]): {
  x: number;
  y: number;
  width: number;
  height: number;
} | null {
  if (items.length === 0) return null;
  const minX = Math.min(...items.map((i) => i.x));
  const minY = Math.min(...items.map((i) => i.y));
  const maxX = Math.max(...items.map((i) => i.x + i.width));
  const maxY = Math.max(...items.map((i) => i.y + i.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Where to put a copy of these items, and where each one goes.
 *
 * `want` is where the group would ideally land — the pointer, the viewport's
 * middle, or just beside the original. The whole box is moved to clear
 * ground from there, and every item keeps its place inside it.
 */
export function duplicatePlacements(
  canvas: CanvasContents,
  items: readonly Item[],
  want?: { x: number; y: number },
): { item: Item; x: number; y: number }[] {
  const box = boundsOf(items);
  if (!box) return [];
  // Beside the originals by default, which is what a duplicate-in-place
  // means: near enough to be obviously the same thing, clear enough to be
  // obviously a second one.
  const asked = want ?? { x: box.x + PLACEMENT_GAP, y: box.y + PLACEMENT_GAP };
  // The copies must not count as occupants of the ground they are looking
  // for, but the ORIGINALS must — a copy that lands on top of its source is
  // the one placement nobody wants.
  const occupied = Object.values(canvas.items).map((i) => ({
    id: i.id,
    x: i.x,
    y: i.y,
    width: i.width,
    height: i.height,
  }));
  const at = nearestFreeSpot({ ...asked, width: box.width, height: box.height }, occupied);
  return items.map((item) => ({
    item,
    x: at.x + (item.x - box.x),
    y: at.y + (item.y - box.y),
  }));
}

/**
 * The properties a copy carries.
 *
 * A copy is made FROM its original, which is what `lineage` records — so a
 * paste writes the relationship the canvas already has a word for, and
 * `isocan lineage` shows the copy hanging off the thing it was copied from
 * without anybody adding a feature for it.
 *
 * Only within one canvas. Across canvases the id would point at an item this
 * canvas does not have, and a dangling parent is worse than no parent: it is
 * a claim about provenance that resolves to nothing and reads as a bug.
 */
export function copyProperties(
  source: Item,
  options: { sameCanvas: boolean },
): Record<string, string> {
  const carried = { ...source.properties };
  // Never inherited: whose file this is. Two items claiming the same path
  // would each overwrite the other on `save`, and the copy is not that file.
  delete carried.file;
  if (!options.sameCanvas) {
    delete carried[PARENT_PROP];
    return carried;
  }
  return { ...carried, [PARENT_PROP]: source.id };
}
