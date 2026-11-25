/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Alignment snapping while dragging: the guides that appear when the thing in
 * your hand lines up with something already on the canvas.
 *
 * Pure geometry, deliberately — it is the part worth testing, and it keeps the
 * pointer code in ItemView about the pointer. Everything here is WORLD units;
 * the caller converts the threshold from screen pixels so the magnet feels the
 * same at every zoom.
 */

import { filterVisibleSnapTargets, snapThresholdWorld, spacingSnapV2 } from "@isocan/core/snap-v2";

export { snapThresholdWorld };

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

/** Optional zoom and spacing tuning for Snap v2. */
interface SnapBoxOptions {
  /** Current viewport zoom; when set, targets < 8 screen px are ignored. */
  zoom?: number;
  /** Override vertical label-row allowance for default spacing candidates. */
  labelRowPx?: number;
}

/**
 * Where the moving box wants to land. `moving` is the dragged box (or the
 * bounding box of a multi-item drag) at its current, unsnapped position;
 * `others` is everything it can align to. A threshold of zero snaps nothing.
 */
export function snapBox(moving: Box, others: Box[], threshold: number, opts?: SnapBoxOptions): Snap {
  if (threshold <= 0 || others.length === 0) return { dx: 0, dy: 0, guides: [], spacing: [] };
  const visible = opts?.zoom !== undefined ? filterVisibleSnapTargets(others, opts.zoom) : others;
  if (visible.length === 0) return { dx: 0, dy: 0, guides: [], spacing: [] };
  const x = axisSnap(edgesX(moving), visible.flatMap(edgesX), threshold);
  const y = axisSnap(edgesY(moving), visible.flatMap(edgesY), threshold);
  // Equal/neighbour/default spacing only speaks for an axis that alignment did not claim.
  const spaceOpts = opts?.labelRowPx !== undefined ? { labelRowPx: opts.labelRowPx } : undefined;
  const spaceX = x === null ? spacingSnapV2(moving, visible, threshold, "x", spaceOpts) : null;
  const spaceY = y === null ? spacingSnapV2(moving, visible, threshold, "y", spaceOpts) : null;
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
