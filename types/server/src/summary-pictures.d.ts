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
import type { TextImage } from "../../core/src/jev.js";
/** Bytes a picture may be read from at all: anything bigger is a title. */
export declare const PICTURE_READ_MAX: number;
type Sharp = typeof import("sharp").default;
/** How `sharp` is reached: the real import, or (in a test) one that fails as it does where the package or its binary is absent. */
type ImportSharp = () => Promise<{
    default: Sharp;
}>;
/**
 * **A picture made ready to send, or null** — the picture whole when its
 * long side is already within `PICTURE_SIDE`; over it, scaled down to it by
 * `sharp` when the home has it, else (a PNG only) decoded and box-averaged
 * down here; anything else, or that cannot be read, or too big to send, null
 * (and it goes by its title). `load` is how `sharp` is imported, for a test
 * to make that import fail.
 */
export declare function pictureToSend(bytes: Buffer, mimeType: string, load?: ImportSharp): Promise<(TextImage & {
    width: number;
    height: number;
}) | null>;
export {};
