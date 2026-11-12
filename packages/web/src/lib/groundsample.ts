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

/**
 * **A picture's colour, looked at once** (smart contrast phase 3, design §4).
 *
 * A canvas standing on somebody's photograph takes its ink from the colour
 * the photograph actually is under the scrim, not from an assumption. That is
 * worked out once per picture, when it has decoded — drawn into 16×16, handed
 * to core's `sampledGround` — and kept here by the picture's sha256 for the
 * life of the tab. Never stored, never sent: every browser that draws the
 * picture can look at it. Until it has, the tone is core's worst case. The
 * looking itself is `lib/groundlook.ts`, loaded with the picture's chunk.
 */
export const useGroundSamples = create<{ byHash: Record<string, string> }>(() => ({ byHash: {} }));
