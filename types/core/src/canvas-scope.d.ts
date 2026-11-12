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
/** Explicit parents, nearest first; historical areas retain their geometric scope. */
export declare function canvasScopes(canvas: CanvasContents, item: Item): Item[];
/** A group's descendants belong even when moved; overlapping outsiders never do. */
export declare function inCanvasScope(canvas: CanvasContents, scope: Item, item: Item): boolean;
