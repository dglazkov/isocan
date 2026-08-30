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
 *
 * "IN THE DIRECTION" MEANS CLEAR OF THE EDGE YOU LEFT, not merely further
 * along than the edge you arrived at. The first version compared far edges —
 * for Up, `node.bottom < current.bottom` — so a neighbour in the SAME ROW
 * counted as above whenever it was a pixel shorter. That was not
 * hypothetical: two screens side by side, 434px and 433px tall, and Up walked
 * sideways to the shorter one, because a candidate overlapping you
 * vertically scores no distance at all and pays only its sideways gap.
 *
 * Anything overlapping the box you are standing in is BESIDE you, whatever
 * its far edge does, so it is not somewhere you can go by leaving in that
 * direction. With the test on the near edge, `projected` is never negative
 * either, and the `Math.max(0, …)` that used to hide the problem is gone.
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
 * **Is `node` that way from `current`?** — the one place that decides.
 *
 * Pulled out of `findNextItem` when the neighbour pad needed to say "and two
 * more to the right", which cannot be answered without asking this question of
 * every item. Answering it a second time in the pad would have been a second
 * opinion about which way a thing lies: the arrow could then appear with the
 * key doing nothing, or count items the key would never reach. One function,
 * both callers.
 */
export function isToward(current: Rect, node: Rect, direction: Direction): boolean {
  switch (direction) {
    case "ArrowRight":
      return node.x >= current.x + current.width;
    case "ArrowLeft":
      return node.x + node.width <= current.x;
    case "ArrowDown":
      return node.y >= current.y + current.height;
    case "ArrowUp":
      return node.y + node.height <= current.y;
  }
}

/** How far along, and how far off to the side — the two distances the score
 *  weighs against each other. Only meaningful once `isToward` is true. */
function separation(
  current: Rect,
  node: Rect,
  direction: Direction,
): { projected: number; orthogonal: number } {
  switch (direction) {
    case "ArrowRight":
      return {
        projected: node.x - (current.x + current.width),
        orthogonal: orthogonalDistance(current.y, current.height, node.y, node.height),
      };
    case "ArrowLeft":
      return {
        projected: current.x - (node.x + node.width),
        orthogonal: orthogonalDistance(current.y, current.height, node.y, node.height),
      };
    case "ArrowDown":
      return {
        projected: node.y - (current.y + current.height),
        orthogonal: orthogonalDistance(current.x, current.width, node.x, node.width),
      };
    case "ArrowUp":
      return {
        projected: current.y - (node.y + node.height),
        orthogonal: orthogonalDistance(current.x, current.width, node.x, node.width),
      };
  }
}

/** How many items lie that way — what lets the pad say there is more than the
 *  one the key would land on. Counted with `isToward`, so it can never
 *  disagree with where the arrow actually goes. */
export function countToward(
  current: Rect,
  candidates: readonly Rect[],
  direction: Direction,
): number {
  return candidates.filter((n) => n.id !== current.id && isToward(current, n, direction)).length;
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
    if (!isToward(current, node, direction)) continue;
    const { projected, orthogonal } = separation(current, node, direction);
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
