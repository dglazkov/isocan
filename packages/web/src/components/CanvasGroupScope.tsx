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

