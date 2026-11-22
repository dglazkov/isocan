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
import type { Operation } from "./ops.js";
/** Options overriding position, size, or title when building a welcome item spec. */
export interface WelcomeItemOptions {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    title?: string;
}
/** Pure specification for seeding a welcome markdown document onto a fresh canvas. */
interface WelcomeItemSpec {
    readonly kind: "document";
    readonly title: string;
    readonly filename: string;
    readonly mimeType: string;
    readonly body: string;
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly properties: Readonly<Record<string, string>>;
}
/** Build the pure specification for a new canvas's welcome markdown card. */
export declare function welcomeItemSpec(opts?: WelcomeItemOptions): WelcomeItemSpec;
/** Uploaded blob receipt needed to materialize a `WelcomeItemSpec` as an `item.add` op. */
interface UploadedWelcomeBlob {
    readonly blobHash: string;
    readonly size: number;
}
/** Turn a `WelcomeItemSpec` and its uploaded blob into a standard `item.add` op (zero new ops). */
export declare function buildWelcomeItemAddOp(spec: WelcomeItemSpec, blob: UploadedWelcomeBlob, ids?: {
    itemId?: string;
    versionId?: string;
}): Extract<Operation, {
    type: "item.add";
}>;
export {};
