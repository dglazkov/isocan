import type { Actor, Operation } from "@isocan/core";
import { useCanvasStore, sendEchoedResult } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";

/** Parent and request mode belong to the initial gesture, before uploads or module work. */
export function creationDestination(containerId = useUiStore.getState().activeGroupId): Pick<Extract<Operation, { type: "item.add" }>, "containerId" | "groupPlacement"> & { originGroupMode: "legacy" | "groups" } {
  const originGroupMode = useCanvasStore.getState().project?.groupMode ?? "legacy";
  return { originGroupMode, ...(originGroupMode === "groups" ? { containerId, groupPlacement: "auto" as const } : {}) };
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
export async function sendCreatedItem(canvasId: string, actor: Actor, creation: Extract<Operation, { type: "item.add" }> & { originGroupMode?: "legacy" | "groups" }, group?: string): Promise<void> {
  // Transport provenance is carried alongside placement while bytes are
  // prepared, but it is never part of the operation vocabulary or its log.
  const { originGroupMode, ...op } = creation;
  const result = await sendEchoedResult(canvasId, actor, op, group, originGroupMode);
  if (result.status === "refused") throw new Error(result.message || "This item could not be added.");
  if (result.status === "queued") throw new QueuedItemError();
}
