/**
 * Alignment snapping while dragging: the guides that appear when the thing in
 * your hand lines up with something already on the canvas.
 *
 * Pure geometry, deliberately — it is the part worth testing, and it keeps the
 * pointer code in ItemView about the pointer. Everything here is WORLD units;
 * the caller converts the threshold from screen pixels so the magnet feels the
 * same at every zoom.
 */

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A line to draw: a world coordinate on one axis. "x" is a vertical line. */
export interface Guide {
  axis: "x" | "y";
  at: number;
}

/**
 * Equal spacing: the dragged box sits between two neighbours with the SAME gap
 * on each side. Drawn as a bar with end caps across each gap — the measure
 * marks that say "these two distances match".
 */
export interface SpacingGuide {
  /** The axis the gaps run along: "x" is a pair of horizontal bars. */
  axis: "x" | "y";
  /** The two equal gaps, each [start, end] along that axis. */
  gaps: Array<[number, number]>;
  /** Where to draw them on the other axis — the dragged box's middle. */
  at: number;
}

export interface Snap {
  /** World-space correction to add to the drag delta. */
  dx: number;
  dy: number;
  /** Every alignment that is exact once the correction is applied — a drag can
   * satisfy several at once (left edges AND centers), and each earns a line. */
  guides: Guide[];
  /** Equal-gap measures, at most one per axis. Alignment wins where both are
   * in reach on the same axis: landing ON a line is the stronger claim. */
  spacing: SpacingGuide[];
}

/** The three interesting coordinates on an axis: the two edges and the middle. */
function edgesX(box: Box): number[] {
  return [box.x, box.x + box.width / 2, box.x + box.width];
}

function edgesY(box: Box): number[] {
  return [box.y, box.y + box.height / 2, box.y + box.height];
}

/** Within half a world unit is "the same line" — items live on integers. */
const EXACT = 0.5;

function axisSnap(moving: number[], others: number[], threshold: number): { delta: number; lines: number[] } | null {
  let delta: number | null = null;
  for (const m of moving) {
    for (const other of others) {
      const candidate = other - m;
      if (Math.abs(candidate) > threshold) continue;
      if (delta === null || Math.abs(candidate) < Math.abs(delta)) delta = candidate;
    }
  }
  if (delta === null) return null;
  const settled = delta;
  const lines = others.filter((other) => moving.some((m) => Math.abs(m + settled - other) < EXACT));
  return { delta: settled, lines: [...new Set(lines)] };
}

/** One axis, read off a box: position, size, and the span on the other axis. */
interface Axis {
  pos: (box: Box) => number;
  size: (box: Box) => number;
  crossStart: (box: Box) => number;
  crossSize: (box: Box) => number;
}

const AXES: Record<"x" | "y", Axis> = {
  x: { pos: (b) => b.x, size: (b) => b.width, crossStart: (b) => b.y, crossSize: (b) => b.height },
  y: { pos: (b) => b.y, size: (b) => b.height, crossStart: (b) => b.x, crossSize: (b) => b.width },
};

/**
 * Centre the moving box between its nearest neighbour on each side, so the two
 * gaps match. Only boxes that share a band with it count — an item on another
 * row is not "beside" anything, whatever its coordinates say.
 */
function spacingSnap(
  moving: Box,
  others: Box[],
  threshold: number,
  which: "x" | "y",
): { delta: number; guide: SpacingGuide } | null {
  const axis = AXES[which];
  const start = axis.pos(moving);
  const end = start + axis.size(moving);
  const bandStart = axis.crossStart(moving);
  const bandEnd = bandStart + axis.crossSize(moving);

  const beside = others.filter((other) => {
    const otherStart = axis.crossStart(other);
    return otherStart < bandEnd && otherStart + axis.crossSize(other) > bandStart;
  });

  let before: Box | null = null;
  let after: Box | null = null;
  for (const other of beside) {
    const otherEnd = axis.pos(other) + axis.size(other);
    if (otherEnd <= start && (before === null || otherEnd > axis.pos(before) + axis.size(before))) {
      before = other;
    }
    if (axis.pos(other) >= end && (after === null || axis.pos(other) < axis.pos(after))) {
      after = other;
    }
  }
  if (!before || !after) return null;

  const left = axis.pos(before) + axis.size(before);
  const right = axis.pos(after);
  // Solve (start + d) - left === right - (end + d).
  const delta = (left + right - start - end) / 2;
  if (Math.abs(delta) > threshold) return null;
  const gap = start + delta - left;
  if (gap <= 0) return null; // touching or overlapping is not spacing

  return {
    delta,
    guide: {
      axis: which,
      gaps: [
        [left, start + delta],
        [end + delta, right],
      ],
      at: axis.crossStart(moving) + axis.crossSize(moving) / 2,
    },
  };
}

/**
 * Where the moving box wants to land. `moving` is the dragged box (or the
 * bounding box of a multi-item drag) at its current, unsnapped position;
 * `others` is everything it can align to. A threshold of zero snaps nothing.
 */
export function snapBox(moving: Box, others: Box[], threshold: number): Snap {
  if (threshold <= 0 || others.length === 0) return { dx: 0, dy: 0, guides: [], spacing: [] };
  const x = axisSnap(edgesX(moving), others.flatMap(edgesX), threshold);
  const y = axisSnap(edgesY(moving), others.flatMap(edgesY), threshold);
  // Equal spacing only speaks for an axis that alignment did not claim.
  const spaceX = x === null ? spacingSnap(moving, others, threshold, "x") : null;
  const spaceY = y === null ? spacingSnap(moving, others, threshold, "y") : null;
  return {
    dx: x?.delta ?? spaceX?.delta ?? 0,
    dy: y?.delta ?? spaceY?.delta ?? 0,
    guides: [
      ...(x?.lines ?? []).map((at): Guide => ({ axis: "x", at })),
      ...(y?.lines ?? []).map((at): Guide => ({ axis: "y", at })),
    ],
    spacing: [spaceX?.guide, spaceY?.guide].filter((guide) => guide !== undefined),
  };
}

/** The box that contains all of them — a multi-item drag snaps as one shape. */
export function unionBox(boxes: Box[]): Box | null {
  if (boxes.length === 0) return null;
  const minX = Math.min(...boxes.map((b) => b.x));
  const minY = Math.min(...boxes.map((b) => b.y));
  const maxX = Math.max(...boxes.map((b) => b.x + b.width));
  const maxY = Math.max(...boxes.map((b) => b.y + b.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
