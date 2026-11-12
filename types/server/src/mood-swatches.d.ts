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
import type { TextModel } from "./text.js";
type Sharp = typeof import("sharp").default;
type ImportSharp = () => Promise<{
    default: Sharp;
}>;
/**
 * Extract up to six dominant colour swatches for an image blob using `sharp`
 * when installed, falling back to a picture-capable text model (`estimated: true`)
 * or refusing with `503 image-swatches-unavailable`.
 */
export declare function extractMoodSwatches(input: {
    bytes: Buffer;
    mimeType: string;
    loadSharpOption?: ImportSharp | undefined;
    textModel: TextModel;
    badgeId: string;
    notTheOwners: () => Promise<{
        owner: string | null;
    } | null>;
}): Promise<{
    status: number;
    body: unknown;
}>;
export {};
