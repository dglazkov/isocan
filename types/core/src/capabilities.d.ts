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
import type { Item, ItemVersion } from "./model.js";
/** Capability flags determining which focus and inline modes a canvas node supports. */
export interface NodeCapabilities {
    /** Can open in View Focus (/p/:canvasId/i/:itemId) — presentation + rich metadata/inspection. */
    view: boolean;
    /** Can open in Edit Focus (/p/:canvasId/w/:itemId) — has a rich Edit Studio and/or editable file source. */
    edit: boolean;
    /**
     * Can be Entered inline on the canvas (`enteredItemId`) — ONLY true for nodes
     * with live interactive or scrollable card interiors (HTML screens/prototypes,
     * live docs, browser frames, videos, placed canvases, long-form Markdown).
     * False for static images, SVGs, design systems, drawings, text nodes, and groups.
     */
    enter: boolean;
    /**
     * Node is a file itself (HTML, Markdown, DESIGN.md, SVG, JSON/code) — unlocks
     * Workbench file tools (CodeMirror source pane, Save-to-disk backing, file
     * tree, lint) inside Edit Focus.
     */
    file: boolean;
}
/**
 * Compute `{ view, edit, enter, file }` for an item and version (defaulting to
 * the item's current version).
 *
 * Built-in rules run first, then any loaded module capability override
 * (`moduleCapabilitiesFor`) refines the result; unloading a module falls back
 * cleanly to the built-in capabilities of the underlying file.
 */
export declare function nodeCapabilitiesFor(item: Item, version?: ItemVersion): NodeCapabilities;
