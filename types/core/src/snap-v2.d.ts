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
import type { Rect } from "./resize-geometry.js";
/** Default auto-layout gap offered as a spacing snap candidate in world units. */
export declare const SNAP_DEFAULT_GAP = 24;
/** Vertical label-row height counted in default vertical spacing gaps (ADR 0257 §2.8). */
export declare const LABEL_ROW_PX = 28;
/** Convert the 6-screen-pixel snap pull to world units, clamped to `[2, 24]`. */
export declare function snapThresholdWorld(zoom: number): number;
/** Filter out targets smaller than 8 screen pixels so specks at low zoom do not catch edges. */
export declare function filterVisibleSnapTargets<T extends Rect>(targets: readonly T[], zoom: number): T[];
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
/**
 * Enumerate all spacing snap candidates for `moving` along `axis`:
 * equal-distribution gap between flanking neighbours, existing gaps between
 * consecutive neighbours in the same cross-axis band, and the default gap
 * (24 horizontal, `24 + LABEL_ROW_PX` vertical).
 */
export declare function spacingCandidates(moving: Rect, others: readonly Rect[], axis: "x" | "y", opts?: SpacingSnapOptions): SpacingCandidate[];
/** Pick the best spacing snap within `threshold` along `axis`, or null if none is in reach. */
export declare function spacingSnapV2(moving: Rect, others: readonly Rect[], threshold: number, axis: "x" | "y", opts?: SpacingSnapOptions): SpacingSnapResult | null;
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
export declare function sizeSnap(moving: Rect, siblings: readonly SizeSnapTarget[], threshold: number): SizeSnapResult;
export {};
