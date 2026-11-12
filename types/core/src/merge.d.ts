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
import { type InkBounds } from "./drawing.js";
/**
 * Several drawings into one.
 *
 * Holding P sweeps a whole sketch made in passes into a single SVG. An agent
 * asked to do the same thing to marks that are already on the canvas had no
 * way to — so this is that, and it is exact rather than approximate for one
 * reason: ink is stored in WORLD coordinates. A drawing's viewBox IS its world
 * box, so merging is concatenating the paths and taking the union of the
 * boxes. No transform, no resampling, no redrawing — the strokes that come out
 * are byte-for-byte the strokes that went in.
 *
 * Only drawings isocan wrote can be merged this way. A foreign SVG can nest
 * groups, carry its own transforms, or use units these boxes do not mean, and
 * silently moving somebody's artwork is worse than refusing.
 */
interface MergeablePart {
    /** For the error message when one cannot be merged. */
    id: string;
    svg: string;
}
export declare class UnmergeableError extends Error {
}
/**
 * One SVG holding every part's strokes, in the order given, with a viewBox
 * covering all of them. Returns the blob and the world box, which is also the
 * box the merged item must occupy — the two must agree or the ink lands
 * somewhere other than where it was drawn.
 */
export declare function mergeDrawings(parts: MergeablePart[]): {
    svg: string;
    bounds: InkBounds;
};
export {};
