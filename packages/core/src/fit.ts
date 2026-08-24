import type { CanvasContents } from "./model.ts";
import { nearestFreeSpot } from "./placement.ts";

/** An item and the size its content actually wants. */
export interface FitTarget {
  itemId: string;
  width: number;
  height: number;
}

export interface FitResult {
  resizes: { itemId: string; width: number; height: number }[];
  moves: { itemId: string; x: number; y: number }[];
}

/**
 * Grow items to fit their content, and keep them off each other.
 *
 * Items are capped when they arrive — an image at 480 wide, an HTML screen at
 * 420x320 whatever it was designed at — so a screen lands on the canvas
 * showing a corner of itself. Growing one is easy; growing six is not, because
 * every one of them expands into where its neighbours are.
 *
 * So the two halves are one operation. Sizes are applied first, then each item
 * is settled in turn, and the pass is deterministic and pure so the CLI and
 * the web app cannot lay the same canvas out differently.
 *
 * ORDER IS THE DESIGN. Items settle in reading order of where they already
 * are, and the first one keeps its position exactly. That way a row stays a
 * row and a column stays a column: growth pushes outward from the top-left of
 * the group rather than scattering it, and the arrangement somebody made by
 * hand survives.
 */
export function fitMoves(canvas: CanvasContents, targets: FitTarget[]): FitResult {
  const growing = targets
    .map((t) => ({ t, item: canvas.items[t.itemId] }))
    .filter((p): p is { t: FitTarget; item: NonNullable<typeof p.item> } => Boolean(p.item))
    // Reading order of where they are NOW, so the result reads like the input.
    .sort((a, b) => a.item.y - b.item.y || a.item.x - b.item.x);

  const ids = new Set(growing.map((g) => g.t.itemId));
  // Everything not being fitted holds its ground and must be avoided.
  const settled = Object.values(canvas.items)
    .filter((i) => !ids.has(i.id))
    .map((i) => ({ id: i.id, x: i.x, y: i.y, width: i.width, height: i.height }));

  const resizes: FitResult["resizes"] = [];
  const moves: FitResult["moves"] = [];

  for (const { t, item } of growing) {
    if (item.width !== t.width || item.height !== t.height) {
      resizes.push({ itemId: t.itemId, width: t.width, height: t.height });
    }
    const want = { x: item.x, y: item.y, width: t.width, height: t.height };
    // Everything is settled the same way, including the first. Being first IS
    // the anchoring: it picks before its siblings exist, so on a clear canvas
    // it keeps its exact position and the group grows outward from it. An
    // earlier version skipped the check for the first item, which let it grow
    // straight over a bystander that was not being fitted at all.
    const at = nearestFreeSpot(want, settled);
    if (at.x !== item.x || at.y !== item.y) moves.push({ itemId: t.itemId, x: at.x, y: at.y });
    settled.push({ id: t.itemId, ...at, width: t.width, height: t.height });
  }

  return { resizes, moves };
}
