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

import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { centerOn, threadWorldPos } from "./viewport.ts";
import { openMainPanel } from "../components/MainThreadPanel.tsx";

/** A notification and an inbox address arrive at the same conversation. */
export function openConversation(canvasId: string, threadId: string): void {
  const state = useCanvasStore.getState();
  if (state.canvasId !== canvasId) return;
  const target = state.canvas?.threads[threadId];
  if (target?.main) openMainPanel(canvasId, true);
  else if (target && state.canvas) {
    const world = threadWorldPos(state.canvas, target);
    const ui = useUiStore.getState();
    ui.setViewport(centerOn(ui.viewport, world.x, world.y, window.innerWidth, window.innerHeight));
    ui.setOpenThread(target.id);
  }
}
