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

import type { Actor, PrototypeClick } from "@isocan/core";
import { clickOp, coalescedClick } from "@isocan/core";
import { sendEchoed, useCanvasStore } from "../stores/canvasStore.ts";

/**
 * Deliver a click a prototype frame posted. Coalesced here against the
 * optimistic canvas so a double-click never leaves the tab; the home refuses
 * a repeat and an agent's click again (`/api/ops`), for clients that skip this.
 */
export function sendPrototypeClick(canvasId: string, actor: Actor, click: PrototypeClick): void {
  const { canvas } = useCanvasStore.getState();
  if (!canvas || coalescedClick(canvas, click, actor.id, Date.now())) return;
  void sendEchoed(canvasId, actor, clickOp(canvas, click, actor.id));
}
