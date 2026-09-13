import type { Actor, Operation } from "@isocan/core";
import { useCanvasStore, sendEchoedResult } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";

/** Capture the intended parent before uploads or module work can outlive the current scope. */
export function creationDestination(containerId = useUiStore.getState().activeGroupId): Pick<Extract<Operation, { type: "item.add" }>, "containerId" | "groupPlacement"> {
  return useCanvasStore.getState().project?.groupMode === "groups" ? { containerId, groupPlacement: "auto" } : {};
}

/** Delayed creation may finish elsewhere; only its original canvas may reveal the new items. */
export function selectCreatedItems(canvasId: string, itemIds: string[]): boolean {
  if (useCanvasStore.getState().canvasId !== canvasId) return false;
  useUiStore.getState().setSelection(itemIds);
  return true;
}

/** A retained composer must not submit a second item while its first creation is queued. */
export class QueuedItemError extends Error {
  constructor() { super("This item is queued and will appear when the home accepts it. You can close this composer."); }
}

/** Creation callers must not select a refused or still-queued item as a completed upload. */
export async function sendCreatedItem(canvasId: string, actor: Actor, op: Extract<Operation, { type: "item.add" }>, group?: string): Promise<void> {
  const result = await sendEchoedResult(canvasId, actor, op, group);
  if (result.status === "refused") throw new Error(result.message || "This item could not be added.");
  if (result.status === "queued") throw new QueuedItemError();
}
