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
 * **Resize modifiers geometry** (Open Stitch phase 1B, ADR 0257 §2.5 & ADR 0289 §3).
 *
 * Only the four corners resize (edges move the card). Every drag frame is
 * recomputed purely from the `start` box and total pointer travel `{ dx, dy }`
 * rather than incremental deltas, so pressing or releasing Shift (proportional)
 * or Option/Alt (from centre) mid-drag never accumulates drift.
 */

/** Axis-aligned rectangle in canvas world coordinates. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** One of the four corner resize handles; straight edges move rather than resize. */
export type CornerHandle = "nw" | "ne" | "sw" | "se";

/** Modifier keys and kind-level aspect locks active on the current resize frame. */
export interface ResizeModifiers {
  /** Shift: preserve the start box's aspect ratio. */
  proportional?: boolean;
  /** Option/Alt: grow or shrink symmetrically around the start box's centre. */
  fromCenter?: boolean;
  /** Kind-level aspect lock (e.g. ready image/video); makes Shift a no-op. */
  lockAspect?: boolean;
}

/** Optional minimum and maximum width/height clamps in world units. */
export interface ResizeBounds {
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Recompute a resized rectangle strictly from `start` + total pointer travel
 * `delta` under the active `modifiers` and `bounds`.
 *
 * Stateless by design: toggling `proportional` or `fromCenter` mid-drag and
 * toggling back yields the exact same box as never pressing the key.
 */
export function computeResizeBox(
  start: Rect,
  handle: CornerHandle,
  delta: { dx: number; dy: number },
  modifiers: ResizeModifiers = {},
  bounds: ResizeBounds = {},
): Rect {
  const sx = handle === "ne" || handle === "se" ? 1 : -1;
  const sy = handle === "sw" || handle === "se" ? 1 : -1;
  const fromCenter = Boolean(modifiers.fromCenter);
  const keepAspect = Boolean(modifiers.proportional || modifiers.lockAspect);

  const minW = bounds.minW ?? 16;
  const minH = bounds.minH ?? 16;
  const maxW = bounds.maxW ?? Infinity;
  const maxH = bounds.maxH ?? Infinity;

  const mult = fromCenter ? 2 : 1;
  const rawW = start.width + sx * delta.dx * mult;
  const rawH = start.height + sy * delta.dy * mult;

  let width: number;
  let height: number;

  if (keepAspect && start.width > 0 && start.height > 0) {
    const aspect = start.width / start.height;
    const relW = Math.abs(rawW - start.width) / start.width;
    const relH = Math.abs(rawH - start.height) / start.height;

    let proposedW = relW >= relH ? rawW : rawH * aspect;
    const effMinW = Math.max(minW, minH * aspect);
    const effMaxW = Math.min(maxW, maxH * aspect);

    if (effMinW <= effMaxW) {
      proposedW = clamp(proposedW, effMinW, effMaxW);
      width = proposedW;
      height = proposedW / aspect;
    } else {
      width = clamp(rawW, minW, maxW);
      height = clamp(rawH, minH, maxH);
    }
  } else {
    width = clamp(rawW, minW, maxW);
    height = clamp(rawH, minH, maxH);
  }

  let x: number;
  let y: number;

  if (fromCenter) {
    const cx = start.x + start.width / 2;
    const cy = start.y + start.height / 2;
    x = cx - width / 2;
    y = cy - height / 2;
  } else {
    // Opposite corner remains anchored at the exact start coordinate.
    x = sx === 1 ? start.x : start.x + start.width - width;
    y = sy === 1 ? start.y : start.y + start.height - height;
  }

  return { x, y, width, height };
}
