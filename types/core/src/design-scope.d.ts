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
import { type DesignScopeOptions } from "./designsystem.js";
import { type LinkedCanvas } from "./memory.js";
/** The item property that says what fidelity a screen was drawn at — `DesignFidelity`'s own words. */
export declare const FIDELITY_PROP = "fidelity";
/**
 * **A wireframe is not an undesigned screen.** It is a sketch of structure,
 * drawn in grey on purpose, and a design system has nothing to govern in it —
 * so the design-system gate does not count it. Before this, six wireframes on
 * a canvas made the seventh real screen's `isocan add` a refusal (wireframes
 * phase 0's open, closed in phase 1). Read from the property rather than the
 * file, because the gate sees an item's metadata and never its bytes; the
 * wireframes module stamps it on every screen it draws.
 */
export declare function isWireframeScreen(item: Item): boolean;
/** Actual screen membership determines coverage; a new lane never inherits another lane's missing-system count. */
export declare function designScopeStanding(canvas: CanvasContents, screenItems: readonly Item[], project?: {
    properties?: Record<string, string>;
}, opts?: DesignScopeOptions & {
    linked?: LinkedCanvas[];
}): {
    standing: "fine" | "owed" | "overdue";
    screenCount: number;
    uncoveredIds: string[];
    scopeId: string | null;
    selection: import("./memory.js").GoverningDesignSelection;
};
