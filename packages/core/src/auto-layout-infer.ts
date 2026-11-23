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
 * **Auto-layout inference** (Open Stitch phase 1B, ADR 0263 / 0276).
 *
 * Given an arbitrary set of positioned items, infers whether they are best
 * expressed as a `horizontal` row, a `vertical` column, a `grid` (with an exact
 * column count), or left `freeform`, and computes clean packed coordinates.
 *
 * Deterministic scoring combines five signals:
 * 1. Normalized displacement from original positions.
 * 2. Bounding-box whitespace / overlap efficiency.
 * 3. Aspect-ratio fidelity against the original arrangement.
 * 4. Reading-order consistency (Kendall tau inversion rate).
 * 5. Size variance and cross-axis structural alignment.
 */

import type { NamedRect } from "./make-room.ts";

/** Layout mode inferred from the geometry of a group's items. */
type InferredLayoutKind = "vertical" | "horizontal" | "grid" | "freeform";

/** Options for auto-layout inference. */
interface InferGroupLayoutOptions {
  /** Spacing gap between adjacent items in the inferred layout (default 24). */
  gap?: number;
}

/** Deterministic result of inferring a group's layout from item rectangles. */
export interface InferredGroupLayout {
  /** Chosen layout structure. */
  layout: InferredLayoutKind;
  /** Column count when `layout === "grid"`. */
  columns?: number;
  /** Gap used between adjacent items in world units. */
  gap: number;
  /** Proposed top-left `(x, y)` coordinate for every input item ID. */
  positions: Map<string, { x: number; y: number }>;
}

/** Default auto-layout gap between grouped items in world units. */
const AUTO_LAYOUT_DEFAULT_GAP = 24;

function centerX(r: NamedRect): number {
  return r.x + r.width / 2;
}

function centerY(r: NamedRect): number {
  return r.y + r.height / 2;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Order items in natural top-to-bottom, left-to-right reading order using row clustering. */
function readingOrder(items: readonly NamedRect[]): NamedRect[] {
  const rowTolerance = Math.max(16, median(items.map((i) => i.height)) * 0.55);
  const byY = [...items].sort((a, b) => centerY(a) - centerY(b) || centerX(a) - centerX(b) || a.id.localeCompare(b.id));
  const rows: NamedRect[][] = [];
  for (const item of byY) {
    const cy = centerY(item);
    const lastRow = rows[rows.length - 1];
    if (lastRow) {
      const rowCy = lastRow.reduce((sum, r) => sum + centerY(r), 0) / lastRow.length;
      if (Math.abs(cy - rowCy) <= rowTolerance) {
        lastRow.push(item);
        continue;
      }
    }
    rows.push([item]);
  }
  const ordered: NamedRect[] = [];
  for (const row of rows) {
    row.sort((a, b) => centerX(a) - centerX(b) || centerY(a) - centerY(b) || a.id.localeCompare(b.id));
    ordered.push(...row);
  }
  return ordered;
}

/** Fraction of pairs whose relative order flipped between `reference` and `candidate` (0..1). */
function kendallInversionRate(referenceIds: readonly string[], candidateIds: readonly string[]): number {
  const n = referenceIds.length;
  if (n < 2) return 0;
  const rank = new Map<string, number>();
  for (let i = 0; i < n; i++) rank.set(referenceIds[i]!, i);
  let inversions = 0;
  const totalPairs = (n * (n - 1)) / 2;
  for (let i = 0; i < n; i++) {
    const ri = rank.get(candidateIds[i]!)!;
    for (let j = i + 1; j < n; j++) {
      if (ri > rank.get(candidateIds[j]!)!) inversions++;
    }
  }
  return inversions / totalPairs;
}

function bboxOf(items: readonly NamedRect[], positions?: Map<string, { x: number; y: number }>): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const item of items) {
    const pos = positions?.get(item.id) ?? item;
    if (pos.x < minX) minX = pos.x;
    if (pos.y < minY) minY = pos.y;
    if (pos.x + item.width > maxX) maxX = pos.x + item.width;
    if (pos.y + item.height > maxY) maxY = pos.y + item.height;
  }
  return { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
}

/** Coefficient of variation for a positive numeric series (0 = identical sizes). */
function coeffOfVariation(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean <= 0) return 0;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

interface Candidate {
  layout: "vertical" | "horizontal" | "grid";
  columns?: number;
  positions: Map<string, { x: number; y: number }>;
  order: string[];
  score: number;
  normalizedDisplacement: number;
}

function buildHorizontal(items: readonly NamedRect[], originX: number, originY: number, gap: number): {
  positions: Map<string, { x: number; y: number }>;
  order: string[];
} {
  const ordered = [...items].sort((a, b) => centerX(a) - centerX(b) || centerY(a) - centerY(b) || a.id.localeCompare(b.id));
  const positions = new Map<string, { x: number; y: number }>();
  let cursor = originX;
  for (const item of ordered) {
    positions.set(item.id, { x: Math.round(cursor), y: Math.round(originY) });
    cursor += item.width + gap;
  }
  return { positions, order: ordered.map((i) => i.id) };
}

function buildVertical(items: readonly NamedRect[], originX: number, originY: number, gap: number): {
  positions: Map<string, { x: number; y: number }>;
  order: string[];
} {
  const ordered = [...items].sort((a, b) => centerY(a) - centerY(b) || centerX(a) - centerX(b) || a.id.localeCompare(b.id));
  const positions = new Map<string, { x: number; y: number }>();
  let cursor = originY;
  for (const item of ordered) {
    positions.set(item.id, { x: Math.round(originX), y: Math.round(cursor) });
    cursor += item.height + gap;
  }
  return { positions, order: ordered.map((i) => i.id) };
}

function buildGrid(
  ordered: readonly NamedRect[],
  cols: number,
  originX: number,
  originY: number,
  gap: number,
): {
  positions: Map<string, { x: number; y: number }>;
  order: string[];
} {
  const rows = Math.ceil(ordered.length / cols);
  const colWidths = new Array<number>(cols).fill(0);
  const rowHeights = new Array<number>(rows).fill(0);

  for (let idx = 0; idx < ordered.length; idx++) {
    const item = ordered[idx]!;
    const r = Math.floor(idx / cols);
    const c = idx % cols;
    if (item.width > colWidths[c]!) colWidths[c] = item.width;
    if (item.height > rowHeights[r]!) rowHeights[r] = item.height;
  }

  const colX = new Array<number>(cols).fill(originX);
  for (let c = 1; c < cols; c++) colX[c] = colX[c - 1]! + colWidths[c - 1]! + gap;
  const rowY = new Array<number>(rows).fill(originY);
  for (let r = 1; r < rows; r++) rowY[r] = rowY[r - 1]! + rowHeights[r - 1]! + gap;

  const positions = new Map<string, { x: number; y: number }>();
  for (let idx = 0; idx < ordered.length; idx++) {
    const item = ordered[idx]!;
    const r = Math.floor(idx / cols);
    const c = idx % cols;
    positions.set(item.id, { x: Math.round(colX[c]!), y: Math.round(rowY[r]!) });
  }
  return { positions, order: ordered.map((i) => i.id) };
}

/** Fraction of item pairs that overlap along the named axis (measures alignment into one band). */
function axisOverlapRatio(items: readonly NamedRect[], axis: "x" | "y"): number {
  const n = items.length;
  if (n < 2) return 0;
  let overlapping = 0;
  const total = (n * (n - 1)) / 2;
  for (let i = 0; i < n; i++) {
    const a = items[i]!;
    const a0 = axis === "x" ? a.x : a.y;
    const a1 = a0 + (axis === "x" ? a.width : a.height);
    for (let j = i + 1; j < n; j++) {
      const b = items[j]!;
      const b0 = axis === "x" ? b.x : b.y;
      const b1 = b0 + (axis === "x" ? b.width : b.height);
      if (a0 < b1 && b0 < a1) overlapping++;
    }
  }
  return overlapping / total;
}

/**
 * Deterministically infer the layout (`horizontal`, `vertical`, `grid`, or
 * `freeform`) and clean target positions for a group of positioned items.
 */
export function inferGroupLayout(
  items: readonly NamedRect[],
  opts: InferGroupLayoutOptions = {},
): InferredGroupLayout {
  const gap = opts.gap ?? AUTO_LAYOUT_DEFAULT_GAP;
  if (items.length === 0) {
    return { layout: "freeform", gap, positions: new Map() };
  }
  if (items.length === 1) {
    const only = items[0]!;
    return {
      layout: "freeform",
      gap,
      positions: new Map([[only.id, { x: only.x, y: only.y }]]),
    };
  }

  const origBox = bboxOf(items);
  const origAspect = origBox.width / origBox.height;
  const sumArea = items.reduce((s, i) => s + Math.max(1, i.width * i.height), 0);
  const avgDiag =
    items.reduce((s, i) => s + Math.hypot(i.width, i.height), 0) / items.length || 1;
  const readOrdered = readingOrder(items);
  const readOrderIds = readOrdered.map((i) => i.id);

  // Structural alignment ratios: a horizontal row has high Y overlap and low X overlap.
  const yOverlap = axisOverlapRatio(items, "y");
  const xOverlap = axisOverlapRatio(items, "x");
  const sizeVar = (coeffOfVariation(items.map((i) => i.width)) + coeffOfVariation(items.map((i) => i.height))) / 2;

  const scoreCandidate = (
    layout: "vertical" | "horizontal" | "grid",
    positions: Map<string, { x: number; y: number }>,
    order: string[],
    columns?: number,
  ): Candidate => {
    // 1. Normalized Euclidean displacement.
    let totalDist = 0;
    for (const item of items) {
      const target = positions.get(item.id)!;
      totalDist += Math.hypot(target.x - item.x, target.y - item.y);
    }
    const normalizedDisplacement = totalDist / (items.length * avgDiag);

    // 2. Whitespace ratio in candidate bounding box.
    const candBox = bboxOf(items, positions);
    const whitespace = Math.max(0, 1 - sumArea / (candBox.width * candBox.height));

    // 3. Aspect fidelity (log ratio distance).
    const candAspect = candBox.width / candBox.height;
    const aspectPenalty = Math.abs(Math.log(candAspect / origAspect));

    // 4. Reading-order consistency (Kendall tau inversion rate).
    const inversionPenalty = kendallInversionRate(readOrderIds, order);

    // 5. Size variance & structural alignment fit.
    let structuralPenalty = 0;
    if (layout === "horizontal") {
      structuralPenalty = (1 - yOverlap) * 0.7 + xOverlap * 0.5;
    } else if (layout === "vertical") {
      structuralPenalty = (1 - xOverlap) * 0.7 + yOverlap * 0.5;
    } else {
      const rows = Math.ceil(items.length / (columns ?? 2));
      const emptySlots = rows * (columns ?? 2) - items.length;
      const sparsity = emptySlots / (rows * (columns ?? 2));
      const oneDimensional = Math.max(
        yOverlap > 0.75 && xOverlap < 0.15 ? 0.8 : 0,
        xOverlap > 0.75 && yOverlap < 0.15 ? 0.8 : 0,
      );
      structuralPenalty = sparsity * 0.45 + sizeVar * 0.25 + oneDimensional;
    }

    const score =
      normalizedDisplacement * 1.4 +
      aspectPenalty * 0.55 +
      whitespace * 0.35 +
      inversionPenalty * 0.65 +
      structuralPenalty;

    return {
      layout,
      ...(columns !== undefined ? { columns } : {}),
      positions,
      order,
      score,
      normalizedDisplacement,
    };
  };

  const candidates: Candidate[] = [];
  const horiz = buildHorizontal(items, origBox.x, origBox.y, gap);
  candidates.push(scoreCandidate("horizontal", horiz.positions, horiz.order));

  const vert = buildVertical(items, origBox.x, origBox.y, gap);
  candidates.push(scoreCandidate("vertical", vert.positions, vert.order));

  if (items.length >= 3) {
    const maxCols = Math.min(items.length - 1, Math.max(2, Math.ceil(Math.sqrt(items.length)) + 2));
    for (let cols = 2; cols <= maxCols; cols++) {
      const grid = buildGrid(readOrdered, cols, origBox.x, origBox.y, gap);
      candidates.push(scoreCandidate("grid", grid.positions, grid.order, cols));
    }
  }

  candidates.sort(
    (a, b) =>
      a.score - b.score ||
      a.normalizedDisplacement - b.normalizedDisplacement ||
      a.layout.localeCompare(b.layout) ||
      (a.columns ?? 0) - (b.columns ?? 0),
  );

  const best = candidates[0]!;

  // Freeform fallback: when items are widely scattered with no strong 1D/grid
  // structure (huge displacement + sparse original bounding box), preserve
  // their deliberate spatial arrangement instead of crushing them together.
  const origDensity = sumArea / (origBox.width * origBox.height);
  const weaklyStructured = yOverlap < 0.25 && xOverlap < 0.25;
  if (best.normalizedDisplacement > 1.35 && weaklyStructured && origDensity < 0.22) {
    return {
      layout: "freeform",
      gap,
      positions: new Map(items.map((item) => [item.id, { x: item.x, y: item.y }])),
    };
  }

  return {
    layout: best.layout,
    ...(best.columns !== undefined ? { columns: best.columns } : {}),
    gap,
    positions: best.positions,
  };
}
