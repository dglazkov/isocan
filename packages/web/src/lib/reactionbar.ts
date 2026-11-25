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

import { useUiStore } from "../stores/uiStore.ts";

const KEY = (canvasId: string) => `isocan.reactions.${canvasId}`;

/** Toggle the per-canvas reaction bar and persist the choice in localStorage. */
export function openReactionBar(canvasId: string, open: boolean): void {
  try {
    if (open) localStorage.setItem(KEY(canvasId), "1");
    else localStorage.removeItem(KEY(canvasId));
  } catch {
    // Storage denied: the choice holds for this session and no longer.
  }
  useUiStore.getState().setMarksOpen(open);
}

/** Restore the persisted reaction bar open/closed state for `canvasId`. */
export function restoreReactionBar(canvasId: string): void {
  try {
    useUiStore.getState().setMarksOpen(localStorage.getItem(KEY(canvasId)) === "1");
  } catch {
    useUiStore.getState().setMarksOpen(false);
  }
}
