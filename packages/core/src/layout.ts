/**
 * Tidying a canvas: align a set of items to an edge, or space them evenly.
 *
 * The web app does this with the pointer — guides that catch an edge, measure
 * bars that say two gaps match. An agent has no pointer, so it needs the same
 * intent as a verb. The geometry lives here so both arrive at the same
 * coordinates: "aligned" must not mean two things.
 *
 * Every function returns the moves that actually change something, ready to
 * become ONE `items.move` — a tidy is one gesture, and so one undo.
 */

export interface LayoutBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Move {
  itemId: string;
  x: number;
  y: number;
}

export type AlignEdge = "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom";
export type Axis = "h" | "v";

export const ALIGN_EDGES: readonly AlignEdge[] = [
  "left",
  "hcenter",
  "right",
  "top",
  "vcenter",
  "bottom",
];

/** Only the moves that move something, with integer coordinates. */
function settle(boxes: LayoutBox[], placed: Map<string, { x: number; y: number }>): Move[] {
  const moves: Move[] = [];
  for (const box of boxes) {
    const target = placed.get(box.id);
    if (!target) continue;
    const x = Math.round(target.x);
    const y = Math.round(target.y);
    if (x !== box.x || y !== box.y) moves.push({ itemId: box.id, x, y });
  }
  return moves;
}

/**
 * Align to the group's own extreme: "left" means the leftmost item's edge, not
 * some outside origin. Aligning what is already aligned is a no-op, which is
 * what lets an agent run this without checking first.
 */
export function alignMoves(boxes: LayoutBox[], edge: AlignEdge): Move[] {
  if (boxes.length < 2) return [];
  const placed = new Map<string, { x: number; y: number }>();
  const minX = Math.min(...boxes.map((b) => b.x));
  const maxX = Math.max(...boxes.map((b) => b.x + b.width));
  const minY = Math.min(...boxes.map((b) => b.y));
  const maxY = Math.max(...boxes.map((b) => b.y + b.height));

  for (const box of boxes) {
    switch (edge) {
      case "left":
        placed.set(box.id, { x: minX, y: box.y });
        break;
      case "right":
        placed.set(box.id, { x: maxX - box.width, y: box.y });
        break;
      case "hcenter":
        placed.set(box.id, { x: (minX + maxX) / 2 - box.width / 2, y: box.y });
        break;
      case "top":
        placed.set(box.id, { x: box.x, y: minY });
        break;
      case "bottom":
        placed.set(box.id, { x: box.x, y: maxY - box.height });
        break;
      case "vcenter":
        placed.set(box.id, { x: box.x, y: (minY + maxY) / 2 - box.height / 2 });
        break;
    }
  }
  return settle(boxes, placed);
}

/**
 * Equal GAPS, not equal centers — the same thing the canvas's purple measure
 * bars promise, so a drag and this verb agree about what "evenly spaced"
 * means. The outermost two hold still: they define the run.
 */
export function distributeMoves(boxes: LayoutBox[], axis: Axis): Move[] {
  if (boxes.length < 3) return [];
  const size = (box: LayoutBox) => (axis === "h" ? box.width : box.height);
  const start = (box: LayoutBox) => (axis === "h" ? box.x : box.y);
  const ordered = [...boxes].sort((a, b) => start(a) - start(b));
  const first = ordered[0]!;
  const last = ordered[ordered.length - 1]!;
  const span = start(last) + size(last) - start(first);
  const occupied = ordered.reduce((total, box) => total + size(box), 0);
  const gap = (span - occupied) / (ordered.length - 1);

  const placed = new Map<string, { x: number; y: number }>();
  let cursor = start(first);
  for (const box of ordered) {
    placed.set(box.id, axis === "h" ? { x: cursor, y: box.y } : { x: box.x, y: cursor });
    cursor += size(box) + gap;
  }
  return settle(boxes, placed);
}
