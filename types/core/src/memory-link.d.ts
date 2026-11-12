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
import type { Item } from "./model.js";
export declare const MEMORY_PROP = "memory";
export declare const MEMORY_INHERIT = "inherit";
/** Phase 2's value — the person's own canvas, read only by their actors. */
export declare const MEMORY_PERSONAL = "personal";
export type MemoryLink = "inherit" | "personal";
/** What a canvas card says about the memory behind it, or nothing. */
export declare function memoryOf(item: Item): MemoryLink | null;
/** The patch that sets or clears the link — one spelling for both surfaces,
 *  cleared with `removeProperties` for the reason `markPatch` records. */
export declare function memoryPatch(memory: MemoryLink | null): {
    properties: Record<string, string>;
} | {
    removeProperties: string[];
};
