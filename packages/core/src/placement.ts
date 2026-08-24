import type { CanvasState, Item } from "./model.ts";
import type { Placement } from "./ops.ts";
import { OpValidationError } from "./errors.ts";

/** Gap between a new item and its anchor, and the step the search moves in. */
export const PLACEMENT_GAP = 40;

/**
 * How close two items may sit before they count as on top of each other.
 * Not zero: items a pixel apart are technically not overlapping and read as a
 * mistake anyway.
 */
export const PLACEMENT_CLEARANCE = 12;

/** How far the search will look before giving up and going round the side. */
const MAX_RINGS = 14;

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const overlaps = (a: Box, b: Box, pad: number): boolean =>
  a.x < b.x + b.width + pad &&
  b.x < a.x + a.width + pad &&
  a.y < b.y + b.height + pad &&
  b.y < a.y + a.height + pad;

/**
 * Where a new item can sit without landing on anything.
 *
 * Deliberately a REQUEST, not an instruction: the spot asked for is honoured
 * exactly whenever it is free, and only a collision moves it. So `--at 0,0`
 * onto empty canvas still lands at 0,0, and dropping six files no longer
 * builds a pile.
 *
 * The search walks outward on a lattice of the item's own size plus the gap,
 * so displaced items line up with each other instead of scattering, and takes
 * the nearest free cell — with ties broken in reading order, right before
 * down before left before up, because a canvas is read like a page.
 *
 * Deterministic given canvas state, which is what lets it run inside the
 * reducer. It is also what makes a batch work: each `item.add` is applied in
 * turn, so the second file's search already sees the first one land.
 */
function findFreeSpot(canvas: CanvasState, want: Box, occupied: Item[]): { x: number; y: number } {
  const clear = (box: Box) => !occupied.some((item) => overlaps(box, item, PLACEMENT_CLEARANCE));
  if (clear(want)) return { x: want.x, y: want.y };

  const stepX = want.width + PLACEMENT_GAP;
  const stepY = want.height + PLACEMENT_GAP;
  // Reading order, so a tie goes to the right of the thing it collided with.
  const order = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
  ] as const;

  for (let ring = 1; ring <= MAX_RINGS; ring++) {
    const cells: { dx: number; dy: number }[] = [];
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dy = -ring; dy <= ring; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) === ring) cells.push({ dx, dy });
      }
    }
    cells.sort((a, b) => {
      const da = a.dx * a.dx + a.dy * a.dy;
      const db = b.dx * b.dx + b.dy * b.dy;
      if (da !== db) return da - db;
      const rank = (c: { dx: number; dy: number }) =>
        order.findIndex(([ox, oy]) => Math.sign(c.dx) === ox && Math.sign(c.dy) === oy);
      return rank(a) - rank(b);
    });
    for (const { dx, dy } of cells) {
      const box = { ...want, x: want.x + dx * stepX, y: want.y + dy * stepY };
      if (clear(box)) return { x: box.x, y: box.y };
    }
  }

  // A canvas dense enough to defeat the search still gets a real answer:
  // past the right edge of everything, level with where it was asked for.
  const right = Math.max(...occupied.map((i) => i.x + i.width));
  return { x: right + PLACEMENT_GAP, y: want.y };
}

/**
 * Resolve a placement to concrete world coordinates. Anchored placement puts
 * the new item neatly to the LEFT of the anchor, top-aligned; either form is
 * then nudged clear of anything already there.
 *
 * `exact` is the escape hatch for a position that MEANS something — ink lands
 * where the pen drew it, and an annotation sits over what it annotates, so
 * neither may be tidied away from the thing that gives it its meaning.
 */
export function resolvePlacement(
  canvas: CanvasState,
  placement: Placement,
  width: number,
  height = 0,
  exact = false,
): { x: number; y: number } {
  let want: { x: number; y: number };
  if ("anchorItemId" in placement) {
    const anchor = canvas.items[placement.anchorItemId];
    if (!anchor) {
      throw new OpValidationError(
        "unknown-anchor",
        `anchor item not found: ${placement.anchorItemId}`,
      );
    }
    want = { x: anchor.x - PLACEMENT_GAP - width, y: anchor.y };
  } else {
    want = { x: placement.x, y: placement.y };
  }

  const occupied = Object.values(canvas.items);
  if (exact || height <= 0 || width <= 0 || occupied.length === 0) return want;
  return findFreeSpot(canvas, { ...want, width, height }, occupied);
}
