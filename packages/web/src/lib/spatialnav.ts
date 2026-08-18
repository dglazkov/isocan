/**
 * Spatial navigation: ⌘/Ctrl + arrow walks the selection from item to item in
 * the direction you point, the way a remote control walks a TV grid.
 *
 * The scoring is edge-to-edge with an orthogonal penalty (the shape the W3C
 * spatial-navigation spec settled on), not center-to-center distance: on a
 * canvas where a tall note sits beside a row of small screens, center distance
 * jumps to whatever happens to be nearest in a straight line and the row falls
 * apart. Weighting sideways drift ~2.5× keeps a walk inside its own lane, and
 * items that overlap on the other axis — the ones a person would call "in the
 * same row" — pay no penalty at all.
 */

export interface Rect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Direction = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";

/** How much sideways drift costs, relative to distance along the way you went. */
const ORTHOGONAL_WEIGHT = 2.5;

/** Gap between two intervals on the axis you did NOT travel; 0 if they overlap
 * (aligned neighbours are the point of the whole exercise). */
function orthogonalDistance(aStart: number, aSize: number, bStart: number, bSize: number): number {
  const aEnd = aStart + aSize;
  const bEnd = bStart + bSize;
  if (bEnd >= aStart && bStart <= aEnd) return 0;
  return bStart > aEnd ? bStart - aEnd : aStart - bEnd;
}

/**
 * The item the selection should move to, or null when there is nothing that
 * way. `current` may be the bounding box of a multi-item selection.
 */
export function findNextItem(
  current: Rect,
  candidates: readonly Rect[],
  direction: Direction,
): Rect | null {
  let best: Rect | null = null;
  let bestScore = Infinity;

  for (const node of candidates) {
    if (node.id === current.id) continue;

    let inDirection = false;
    let projected = 0;
    let orthogonal = 0;

    switch (direction) {
      case "ArrowRight":
        inDirection = node.x > current.x;
        projected = Math.max(0, node.x - (current.x + current.width));
        orthogonal = orthogonalDistance(current.y, current.height, node.y, node.height);
        break;
      case "ArrowLeft":
        inDirection = node.x + node.width < current.x + current.width;
        projected = Math.max(0, current.x - (node.x + node.width));
        orthogonal = orthogonalDistance(current.y, current.height, node.y, node.height);
        break;
      case "ArrowDown":
        inDirection = node.y > current.y;
        projected = Math.max(0, node.y - (current.y + current.height));
        orthogonal = orthogonalDistance(current.x, current.width, node.x, node.width);
        break;
      case "ArrowUp":
        inDirection = node.y + node.height < current.y + current.height;
        projected = Math.max(0, current.y - (node.y + node.height));
        orthogonal = orthogonalDistance(current.x, current.width, node.x, node.width);
        break;
    }
    if (!inDirection) continue;

    const score = projected + orthogonal * ORTHOGONAL_WEIGHT;
    if (score < bestScore) {
      bestScore = score;
      best = node;
    }
  }
  return best;
}

/** The item nearest a world point, by center distance — where a walk starts
 * when nothing is selected yet. */
export function nearestToPoint(candidates: readonly Rect[], x: number, y: number): Rect | null {
  let best: Rect | null = null;
  let bestDistance = Infinity;
  for (const node of candidates) {
    const distance = Math.hypot(node.x + node.width / 2 - x, node.y + node.height / 2 - y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = node;
    }
  }
  return best;
}
