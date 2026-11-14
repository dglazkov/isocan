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

import { groupAncestors } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { enterCanvasGroup } from "../lib/canvasgroups.ts";

/** Scope navigation is available to readers, independently of the edit dialog. */
export function CanvasGroupScope() {
  const activeId = useUiStore((s) => s.activeGroupId);
  const canvas = useCanvasStore((s) => s.canvas);
  if (!activeId || !canvas?.items[activeId]) return null;
  const group = canvas.items[activeId]!;
  const path = [...groupAncestors(canvas, group.id)].reverse();
  return <nav className="canvas-group-scope floats" aria-label="Group scope" data-testid="group-scope">
    <button onClick={() => useUiStore.getState().setActiveGroup(null)}>Canvas</button>
    {[...path, group].map((item) => <button key={item.id} aria-current={item.id === activeId ? "location" : undefined} onClick={() => enterCanvasGroup(item.id)}>{item.title}</button>)}
    <button aria-label="Group details" onClick={() => useUiStore.getState().setGroupDialog({ kind: "inspect", groupId: group.id, itemIds: [] })}>Details</button>
  </nav>;
}

