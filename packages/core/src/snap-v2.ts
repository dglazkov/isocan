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
 * **Snap v2** (Open Stitch phase 1B, ADR 0257 §2.7–2.8).
 *
 * Pure zoom-responsive snapping geometry shared between core tests and the web
 * drag/resize layer:
 *
 * - Magnet pull is 6 *screen* pixels at any zoom, clamped to `[2, 24]` world px.
 * - Targets smaller than 8 screen pixels on screen are ignored so distant specks
 *   at low zoom never catch edges.
 * - Spacing candidates include the auto-layout default gap (24px, plus the 28px
 *   label row on the vertical axis), every existing gap between neighbours in
 *   the same band, and equal distribution between flanking neighbours.
 * - Sibling size-match snaps width and height to matching siblings while resizing.
 */

import type { Rect } from "./resize-geometry.ts";

/** Target snap distance in screen pixels at any zoom level. */
const SNAP_SCREEN_PX = 6;

/** Lower clamp for snap pull in world units (when zoomed far in). */
const SNAP_MIN_WORLD = 2;

/** Upper clamp for snap pull in world units (when zoomed far out). */
const SNAP_MAX_WORLD = 24;

/** Minimum rendered size (in screen pixels) a target must have to participate in snapping. */
const SNAP_MIN_TARGET_SCREEN_PX = 8;

/** Default auto-layout gap offered as a spacing snap candidate in world units. */
export const SNAP_DEFAULT_GAP = 24;

/** Vertical label-row height counted in default vertical spacing gaps (ADR 0257 §2.8). */
export const LABEL_ROW_PX = 28;

/** Convert the 6-screen-pixel snap pull to world units, clamped to `[2, 24]`. */
export function snapThresholdWorld(zoom: number): number {
  if (!Number.isFinite(zoom) || zoom <= 0) return SNAP_MAX_WORLD;
  return Math.min(SNAP_MAX_WORLD, Math.max(SNAP_MIN_WORLD, SNAP_SCREEN_PX / zoom));
}

/** Filter out targets smaller than 8 screen pixels so specks at low zoom do not catch edges. */
export function filterVisibleSnapTargets<T extends Rect>(targets: readonly T[], zoom: number): T[] {
  if (!Number.isFinite(zoom) || zoom <= 0) return [];
  return targets.filter(
    (t) => Math.max(t.width, t.height) * zoom >= SNAP_MIN_TARGET_SCREEN_PX,
  );
}

/** One candidate spacing snap along a single axis. */
interface SpacingCandidate {
  /** World-space delta to apply along `axis`. */
  delta: number;
  /** The matched gap distance in world units. */
  gap: number;
  /** Where this gap came from: flanking equal split, existing neighbour gap, or default gap. */
  kind: "equal" | "neighbour" | "default";
  /** Interval pairs `[start, end]` along `axis` to draw as spacing measure bars. */
  gaps: Array<[number, number]>;
  /** Cross-axis midpoint where the spacing measure bars should be drawn. */
  at: number;
}

/** Options controlling default spacing and vertical label-row allowance. */
interface SpacingSnapOptions {
  /** Base auto-layout gap (default 24). */
  defaultGap?: number;
  /** Extra vertical allowance for the card label row (default 28). */
  labelRowPx?: number;
}

/** Result of snapping a box's spacing along one axis. */
interface SpacingSnapResult {
  delta: number;
  gap: number;
  kind: "equal" | "neighbour" | "default";
  guide: {
    axis: "x" | "y";
    gaps: Array<[number, number]>;
    at: number;
  };
}

interface AxisAccess {
  pos: (r: Rect) => number;
  size: (r: Rect) => number;
  crossPos: (r: Rect) => number;
  crossSize: (r: Rect) => number;
}

const AXIS: Record<"x" | "y", AxisAccess> = {
  x: { pos: (r) => r.x, size: (r) => r.width, crossPos: (r) => r.y, crossSize: (r) => r.height },
  y: { pos: (r) => r.y, size: (r) => r.height, crossPos: (r) => r.x, crossSize: (r) => r.width },
};

/**
 * Enumerate all spacing snap candidates for `moving` along `axis`:
 * equal-distribution gap between flanking neighbours, existing gaps between
 * consecutive neighbours in the same cross-axis band, and the default gap
 * (24 horizontal, `24 + LABEL_ROW_PX` vertical).
 */
export function spacingCandidates(
  moving: Rect,
  others: readonly Rect[],
  axis: "x" | "y",
  opts: SpacingSnapOptions = {},
): SpacingCandidate[] {
  const a = AXIS[axis];
  const start = a.pos(moving);
  const size = a.size(moving);
  const end = start + size;
  const bandStart = a.crossPos(moving);
  const bandEnd = bandStart + a.crossSize(moving);
  const at = bandStart + a.crossSize(moving) / 2;

  const beside = others
    .filter((other) => {
      const oStart = a.crossPos(other);
      return oStart < bandEnd && oStart + a.crossSize(other) > bandStart;
    })
    .sort((u, v) => a.pos(u) - a.pos(v));

  if (beside.length === 0) return [];

  let before: Rect | null = null;
  let after: Rect | null = null;
  for (const other of beside) {
    const oStart = a.pos(other);
    const oEnd = oStart + a.size(other);
    if (oEnd <= start && (before === null || oEnd > a.pos(before) + a.size(before))) {
      before = other;
    }
    if (oStart >= end && (after === null || oStart < a.pos(after))) {
      after = other;
    }
  }

  const out: SpacingCandidate[] = [];

  // 1. Equal distribution between flanking neighbours.
  if (before && after) {
    const left = a.pos(before) + a.size(before);
    const right = a.pos(after);
    const delta = (left + right - start - end) / 2;
    const gap = start + delta - left;
    if (gap > 0) {
      out.push({
        delta,
        gap,
        kind: "equal",
        gaps: [
          [left, start + delta],
          [end + delta, right],
        ],
        at,
      });
    }
  }

  // 2. Existing neighbour-to-neighbour gaps in the same band.
  const seenNeighbourGaps = new Set<number>();
  for (let i = 0; i + 1 < beside.length; i++) {
    const u = beside[i]!;
    const v = beside[i + 1]!;
    const uEnd = a.pos(u) + a.size(u);
    const vStart = a.pos(v);
    const gap = Math.round((vStart - uEnd) * 1000) / 1000;
    if (gap <= 0 || seenNeighbourGaps.has(gap)) continue;
    seenNeighbourGaps.add(gap);

    if (before) {
      const bEnd = a.pos(before) + a.size(before);
      const delta = bEnd + gap - start;
      out.push({
        delta,
        gap,
        kind: "neighbour",
        gaps: [
          [uEnd, vStart],
          [bEnd, start + delta],
        ],
        at,
      });
    }
    if (after) {
      const aStart = a.pos(after);
      const delta = aStart - gap - end;
      out.push({
        delta,
        gap,
        kind: "neighbour",
        gaps: [
          [uEnd, vStart],
          [end + delta, aStart],
        ],
        at,
      });
    }
  }

  // 3. Default gap (counts the 28px label row on vertical gaps).
  const baseGap = opts.defaultGap ?? SNAP_DEFAULT_GAP;
  const labelRow = axis === "y" ? (opts.labelRowPx ?? LABEL_ROW_PX) : 0;
  const defaultGap = baseGap + labelRow;
  if (defaultGap > 0) {
    if (before) {
      const bEnd = a.pos(before) + a.size(before);
      const delta = bEnd + defaultGap - start;
      out.push({
        delta,
        gap: defaultGap,
        kind: "default",
        gaps: [[bEnd, start + delta]],
        at,
      });
    }
    if (after) {
      const aStart = a.pos(after);
      const delta = aStart - defaultGap - end;
      out.push({
        delta,
        gap: defaultGap,
        kind: "default",
        gaps: [[end + delta, aStart]],
        at,
      });
    }
  }

  return out;
}

const KIND_PRIORITY: Record<SpacingCandidate["kind"], number> = {
  equal: 0,
  neighbour: 1,
  default: 2,
};

/** Pick the best spacing snap within `threshold` along `axis`, or null if none is in reach. */
export function spacingSnapV2(
  moving: Rect,
  others: readonly Rect[],
  threshold: number,
  axis: "x" | "y",
  opts: SpacingSnapOptions = {},
): SpacingSnapResult | null {
  if (threshold <= 0 || others.length === 0) return null;
  const candidates = spacingCandidates(moving, others, axis, opts).filter(
    (c) => Math.abs(c.delta) <= threshold,
  );
  if (candidates.length === 0) return null;

  candidates.sort(
    (a, b) =>
      KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind] ||
      Math.abs(a.delta) - Math.abs(b.delta),
  );
  const best = candidates[0]!;
  return {
    delta: best.delta,
    gap: best.gap,
    kind: best.kind,
    guide: {
      axis,
      gaps: best.gaps,
      at: best.at,
    },
  };
}

/** Optional sibling box with an optional id for size-match reporting. */
interface SizeSnapTarget extends Rect {
  id?: string;
}

/** Result of matching a resizing box's width and/or height against sibling boxes. */
interface SizeSnapResult {
  /** Width correction to add to the resizing box. */
  dw: number;
  /** Height correction to add to the resizing box. */
  dh: number;
  /** Exact matched width when snapped, or undefined. */
  matchedWidth?: number;
  /** Exact matched height when snapped, or undefined. */
  matchedHeight?: number;
  /** IDs of siblings whose width matches the snapped width (when IDs are present). */
  matchedWidthIds: string[];
  /** IDs of siblings whose height matches the snapped height (when IDs are present). */
  matchedHeightIds: string[];
}

/**
 * Match a resizing item's width and height against sibling boxes within
 * `threshold` world units, so siblings in a row, stack, or group snap cleanly
 * to the same dimensions.
 */
export function sizeSnap(
  moving: Rect,
  siblings: readonly SizeSnapTarget[],
  threshold: number,
): SizeSnapResult {
  if (threshold <= 0 || siblings.length === 0) {
    return { dw: 0, dh: 0, matchedWidthIds: [], matchedHeightIds: [] };
  }

  let bestDw: number | null = null;
  let bestDh: number | null = null;

  for (const sibling of siblings) {
    const dw = sibling.width - moving.width;
    if (Math.abs(dw) <= threshold && (bestDw === null || Math.abs(dw) < Math.abs(bestDw))) {
      bestDw = dw;
    }
    const dh = sibling.height - moving.height;
    if (Math.abs(dh) <= threshold && (bestDh === null || Math.abs(dh) < Math.abs(bestDh))) {
      bestDh = dh;
    }
  }

  const matchedWidth = bestDw !== null ? moving.width + bestDw : undefined;
  const matchedHeight = bestDh !== null ? moving.height + bestDh : undefined;
  const matchedWidthIds =
    matchedWidth !== undefined
      ? siblings.filter((s) => s.id !== undefined && Math.abs(s.width - matchedWidth) < 0.5).map((s) => s.id!)
      : [];
  const matchedHeightIds =
    matchedHeight !== undefined
      ? siblings.filter((s) => s.id !== undefined && Math.abs(s.height - matchedHeight) < 0.5).map((s) => s.id!)
      : [];

  return {
    dw: bestDw ?? 0,
    dh: bestDh ?? 0,
    ...(matchedWidth !== undefined ? { matchedWidth } : {}),
    ...(matchedHeight !== undefined ? { matchedHeight } : {}),
    matchedWidthIds,
    matchedHeightIds,
  };
}
