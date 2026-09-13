import type { Actor, CanvasState, GroupAction, GroupAnchor, GroupPlacementPolicy } from "@isocan/core";
import { captureGroupExpectations, groupPreviewBoxes, groupResizeBox, groupResizeMinimum, groupSelectionRoots, newOpId } from "@isocan/core";
import { sendEchoedResult, setNotice, useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { canEditNow } from "./capability.ts";

type Transform = Extract<GroupAction, { kind: "transform" }>;
let interruptible: { id: string; finish: () => void } | null = null;

/** One keyboard burst owns its timer; starting a pointer gesture completes it exactly once. */
export function createGroupNudger(canvasId: string, actor: Actor, delay: number) {
  let gesture: ReturnType<typeof beginGroupGesture> = null;
  let selection = "";
  let delta = { x: 0, y: 0 };
  let timer: ReturnType<typeof setTimeout> | null = null;
  function flush(): Promise<boolean> {
    if (timer !== null) { clearTimeout(timer); timer = null; }
    const pending = gesture;
    gesture = null;
    return pending ? pending.commit(canvasId, actor) : Promise.resolve(false);
  }
  return {
    flush,
    nudge(ids: string[], dx: number, dy: number) {
      const key = [...ids].sort().join("\0");
      if (gesture?.active() && key !== selection) void flush();
      if (!gesture?.active()) { gesture = beginGroupGesture(ids, () => { void flush(); }); delta = { x: 0, y: 0 }; }
      selection = key;
      delta.x += dx; delta.y += dy;
      gesture?.move(delta.x, delta.y);
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => { void flush(); }, delay);
    },
  };
}

/** Pointer and keyboard gestures share one captured start, preview and authoritative completion. */
export function beginGroupGesture(itemIds: string[], onInterrupt?: () => void) {
  // A click starting another gesture completes a pending keyboard burst;
  // otherwise replacing its preview token would silently discard that move.
  const previous = interruptible;
  interruptible = null;
  previous?.finish();
  const { project, canvas } = useCanvasStore.getState();
  if (!project || !canvas || project.groupMode !== "groups" || !canEditNow()) return null;
  const start: CanvasState = { project, canvas };
  const roots = groupSelectionRoots(canvas, itemIds);
  if (!roots.length) return null;
  const expected = captureGroupExpectations(start, roots);
  const destinationExpected = new Map<string, typeof expected>();
  const resizeMinimums = new Map<string, ReturnType<typeof groupResizeMinimum>>();
  const id = newOpId();
  if (onInterrupt) interruptible = { id, finish: onInterrupt };
  let action: Transform | null = null;
  const active = () => useUiStore.getState().groupPreview?.id === id;
  const clear = () => {
    if (interruptible?.id === id) interruptible = null;
    if (!active()) return;
    const ui = useUiStore.getState();
    ui.setGroupPreview(null);
    ui.setGroupDropTarget(null);
    ui.setGuides([]);
  };
  useUiStore.getState().setGroupPreview({ id, boxes: new Map() });
  function preview(next: Transform): void {
    if (!active()) return;
    try {
      const boxes = groupPreviewBoxes(start, next);
      action = next;
      useUiStore.getState().setGroupPreview({ id, boxes });
    } catch (error) {
      clear();
      setNotice(error instanceof Error ? error.message : "That group transform is not possible.");
    }
  }
  return {
    start, roots, active,
    move(dx: number, dy: number, containerId?: string, groupPlacement: GroupPlacementPolicy = "preserve"): void {
      if (containerId && !destinationExpected.has(containerId)) destinationExpected.set(containerId, captureGroupExpectations(start, [...roots, containerId]));
      preview({ kind: "transform", itemIds: roots, by: { x: dx, y: dy }, expected: containerId ? destinationExpected.get(containerId)! : expected, ...(containerId ? { containerId, groupPlacement } : {}) });
    },
    resize(itemId: string, width: number, height: number, anchor: GroupAnchor, aspect = false): void {
      const item = canvas!.items[itemId];
      if (!item) return;
      if (aspect) {
        if (!resizeMinimums.has(itemId)) resizeMinimums.set(itemId, groupResizeMinimum(canvas!, itemId));
        const minimum = resizeMinimums.get(itemId)!;
        const widthScale = width / item.width; const heightScale = height / item.height;
        const requested = Math.abs(widthScale - 1) >= Math.abs(heightScale - 1) ? widthScale : heightScale;
        const scale = Math.max(requested, minimum.width / item.width, minimum.height / item.height);
        width = item.width * scale; height = item.height * scale;
      }
      preview({ kind: "transform", itemId, box: groupResizeBox(item, { width: Math.max(1, width), height: Math.max(1, height) }, anchor), anchor, expected });
    },
    cancel: clear,
    async commit(canvasId: string, actor: Actor): Promise<boolean> {
      if (!active() || !action) { clear(); return false; }
      try {
        const result = await sendEchoedResult(canvasId, actor, { type: "group.change", action });
        if (result.status !== "accepted" && active() && useCanvasStore.getState().canvasId === canvasId) setNotice(result.message || "This group change is queued until the home is reachable.");
        else if (active() && useCanvasStore.getState().canvasId === canvasId && action.containerId) {
          const ui = useUiStore.getState();
          ui.setActiveGroup(action.containerId);
          ui.setSelection(roots);
        }
        return result.status === "accepted";
      } catch (error) {
        if (active() && useCanvasStore.getState().canvasId === canvasId) setNotice(error instanceof Error ? error.message : "That group change could not be saved.");
        return false;
      } finally { clear(); }
    },
  };
}
