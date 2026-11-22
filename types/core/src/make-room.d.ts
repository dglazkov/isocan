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
 * **Make-room push engine** (Open Stitch phase 1B, ADR 0288).
 *
 * Moves colliding neighbours clear of a moved or grown rectangle with minimal
 * motion, cascading via BFS so pushed items never land on top of further
 * neighbours. Pinned/protected IDs never move (movable items slide around them
 * instead). A 512px spatial grid index keeps neighbour lookups O(1) locally so
 * 500-item canvases resolve in sub-millisecond time.
 */
import type { Rect } from "./resize-geometry.js";
/** Rectangle paired with its item ID. */
export interface NamedRect extends Rect {
    id: string;
}
/** Options controlling push clearance, immovable items, and cascade safety cap. */
export interface MakeRoomOptions {
    /** Minimum clearance gap kept between boxes after pushing (default 24). */
    gap?: number;
    /** Item IDs that must never be moved (pinned, locked, or actively edited). */
    protectedIds?: ReadonlySet<string>;
    /** Safety cap on BFS push iterations to guarantee termination. */
    maxIterations?: number;
}
/**
 * Compute minimal-motion displacements for neighbours colliding with `moved`.
 *
 * Returns a map of `itemId -> { x, y }` containing only items that actually
 * moved. Items in `movedIds` and `opts.protectedIds` never appear in the result.
 */
export declare function computeMakeRoom(moved: Rect, movedIds: ReadonlySet<string>, all: readonly NamedRect[], opts?: MakeRoomOptions): Map<string, {
    x: number;
    y: number;
}>;
