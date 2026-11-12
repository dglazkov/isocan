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
import type { TextAnchorResolution } from "@isocan/core";

/** Derived coordinates in the item's own layout, never shared or persisted. */
type TextAnchorView = { resolution: TextAnchorResolution; versionId: string; x?: number; y?: number };
interface AnchorViews { views: Record<string, TextAnchorView>; put: (id: string, view: TextAnchorView | null) => void }
/** The rendered document measures pins; the canvas and thread panel read them. */
export const useTextAnchorStore = create<AnchorViews>((set) => ({ views: {}, put: (id, view) => set(state => {
  if (JSON.stringify(state.views[id] ?? null) === JSON.stringify(view)) return state;
  const views = { ...state.views }; if (view) views[id] = view; else delete views[id];
  return { views };
}) }));
