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
/**
 * Recompute a resized rectangle strictly from `start` + total pointer travel
 * `delta` under the active `modifiers` and `bounds`.
 *
 * Stateless by design: toggling `proportional` or `fromCenter` mid-drag and
 * toggling back yields the exact same box as never pressing the key.
 */
export declare function computeResizeBox(start: Rect, handle: CornerHandle, delta: {
    dx: number;
    dy: number;
}, modifiers?: ResizeModifiers, bounds?: ResizeBounds): Rect;
