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
import type { TextAttention } from "./text-attention.js";
import type { Item } from "./model.js";
/** A saved quote with immutable provenance. Resolution against newer text is
 * derived, never written back over the words the commenter actually saw. */
export interface TextAnchor {
    versionId: string;
    blobHash: string;
    textSpace: "markdown-hast-v1";
    flavor: TextAttention["flavor"];
    quote: string;
    prefix: string;
    suffix: string;
    start: number;
    end: number;
}
/** The current document can resolve, lose, or ambiguously repeat a saved quote. */
export type TextAnchorResolution = {
    status: "resolved";
    start: number;
    end: number;
} | {
    status: "missing" | "ambiguous" | "unavailable";
};
/** Build the same quote selector from a browser range or a terminal quote. */
export declare function makeTextAnchor(text: string, identity: Pick<TextAnchor, "versionId" | "blobHash" | "flavor">, range: {
    start: number;
    end: number;
}): TextAnchor;
/** Refuse malformed selectors and anchors to a representation the item never held. */
export declare function validateTextAnchor(value: unknown, item: Item | undefined): TextAnchor | null;
/** Never guess using stale coordinates in a changed version. Unique text can
 * move; repeated text needs matching context, otherwise the item pin survives. */
export declare function resolveTextAnchor(anchor: TextAnchor, text: string, identity: {
    blobHash: string;
    flavor: TextAnchor["flavor"];
}): TextAnchorResolution;
