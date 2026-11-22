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
 * **Group and item `titleSource` compare-and-set** (Open Stitch phase 1B, ADR 0265).
 *
 * Background auto-naming and agent suggestions must never clobber a name a
 * person explicitly typed:
 *
 * - `"auto"` never overwrites `"user"` or `"agent"`.
 * - `"agent"` never overwrites `"user"`.
 * - `"user"` always wins.
 *
 * Stored on the item as `properties.titleSource` (`"user" | "agent" | "auto"`)
 * so both the browser rename box and `isocan set --title ... --source ...`
 * enforce the exact same precedence rule with zero new ops.
 */
/** Provenance tier of an item or group's current title. */
export type TitleSource = "user" | "agent" | "auto";
/** Item property key recording who authored the current title. */
export declare const TITLE_SOURCE_PROP = "titleSource";
/** All valid `titleSource` values in descending precedence order. */
export declare const TITLE_SOURCES: readonly TitleSource[];
/** Runtime guard checking whether an arbitrary string is a valid `TitleSource`. */
export declare function isTitleSource(value: string): value is TitleSource;
/** Read and validate `properties.titleSource` from an item's property map. */
export declare function readTitleSource(properties: Readonly<Record<string, string>> | undefined): TitleSource | undefined;
/**
 * Compare-and-set precedence rule for title updates:
 * - `"user"` always wins.
 * - `"agent"` overwrites missing, `"auto"`, or `"agent"`, never `"user"`.
 * - `"auto"` overwrites only missing or `"auto"`, never `"agent"` or `"user"`.
 */
export declare function canOverwriteTitle(currentSource: TitleSource | undefined, incoming: TitleSource): boolean;
/** Outcome of evaluating a title update against the current `titleSource`. */
interface TitleSourceCasResult {
    /** True when `incomingSource` is permitted to overwrite `currentSource`. */
    applied: boolean;
    /** Resulting title after applying (or rejecting) the update. */
    title: string;
    /** Resulting `titleSource` property value after the check. */
    source: TitleSource | undefined;
}
/**
 * Evaluate a proposed rename under the `titleSource` CAS rule, returning the
 * winning title and source without mutating any state.
 */
export declare function resolveTitleUpdate(currentTitle: string, currentSource: TitleSource | undefined, incomingTitle: string, incomingSource: TitleSource): TitleSourceCasResult;
export {};
