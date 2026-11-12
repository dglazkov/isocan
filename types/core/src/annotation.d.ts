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
import type { CanvasContents, Item } from "./model.js";
/** The item this ink is about. */
export declare const ANNOTATES_PROP = "annotates";
export interface Box {
    x: number;
    y: number;
    width: number;
    height: number;
}
/** A rectangle in fractions of the target: 0,0 is its top-left, 1,1 bottom-right. */
interface Region {
    x: number;
    y: number;
    width: number;
    height: number;
}
/**
 * Where `ink` sits on `target`, in fractions rather than pixels — so an agent
 * can say "the right-hand third of the header" without parsing a single path,
 * and the answer survives the target being resized.
 */
export declare function regionOf(ink: Box, target: Box): Region;
/** The properties that make a drawing an annotation of `targetId`. */
export declare function annotationProperties(targetId: string, region: Region): Record<string, string>;
/** The item this one annotates, or null when it is just a drawing. */
export declare function annotationTarget(item: Item): string | null;
export declare function isAnnotation(item: Item): boolean;
/** The stored region, or null when it is missing or malformed. */
export declare function annotationRegion(item: Item): Region | null;
/** Everything annotating this item — what travels with it, and what an agent
 * should clear once it has done what the ink asked. */
export declare function annotationsOf(canvas: CanvasContents, itemId: string): Item[];
/**
 * Which item a piece of ink is about: the one it overlaps most, needing a real
 * share of the ink to count. A scribble that merely clips a neighbour's corner
 * is a drawing near it, not a note about it.
 */
export declare function annotationTargetFor(ink: Box, candidates: readonly Item[], minimumShare?: number): Item | null;
export {};
