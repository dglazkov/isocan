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

import { create } from "zustand";
import type { ReactNode } from "react";

/**
 * **What a far-away text node draws instead of its opening words, and a
 * group or an area inside its frame, by item id** (Semantic Zoom). Empty
 * unless the experiment is on: the lazy `SemanticZoom` chunk is the only
 * writer, and it hands over the finished mark or card, so the first paint
 * carries this line and ItemView's one read of it, not the summary's markup.
 * `px` is a group's or an area's members' median type size (world units),
 * which `zoomDecisions` turns into `Z_GIST`. An item with no entry draws what
 * it always did.
 */
export const useGistStore = create<Record<string, { node: ReactNode; px?: number }>>(() => ({}));
