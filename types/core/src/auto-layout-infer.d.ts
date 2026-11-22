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
import type { NamedRect } from "./make-room.js";
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
    positions: Map<string, {
        x: number;
        y: number;
    }>;
}
/**
 * Deterministically infer the layout (`horizontal`, `vertical`, `grid`, or
 * `freeform`) and clean target positions for a group of positioned items.
 */
export declare function inferGroupLayout(items: readonly NamedRect[], opts?: InferGroupLayoutOptions): InferredGroupLayout;
export {};
