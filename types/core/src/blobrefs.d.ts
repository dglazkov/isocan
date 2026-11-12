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
import type { CanvasState } from "./model.js";
/**
 * Every blob hash named by a canvas's properties, or by an item's.
 *
 * Takes the whole `CanvasState` rather than `CanvasContents`, and that is the
 * point: a canvas's own properties live on the RECORD (`state.project`), not
 * on its contents, which is where a background tile would sit. A signature
 * that took only the contents could not see the thing this file exists for.
 */
export declare function blobsInProperties(state: CanvasState): Set<string>;
