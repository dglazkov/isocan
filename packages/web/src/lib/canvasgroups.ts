import type { Actor, GroupAction, Item, Operation } from "@isocan/core";
import { annotationTarget, groupAncestors, groupChildren, groupRemoveAction, groupScopedRoot, groupWrapAction, GROUP_DEFAULT_SIZE, isGroupItem, newItemId, newVersionId } from "@isocan/core";
import { sendEchoedResult, setNotice, useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { uploadBlob } from "./api.ts";
import { canEditNow } from "./capability.ts";
import { zoomToItem } from "./zoomactions.ts";
import { selectCreatedItems } from "./groupplacement.ts";

/** New membership writes stay opt-in until the migration release. */
export function groupsEnabled(): boolean { return useCanvasStore.getState().project?.groupMode === "groups"; }
/** All editing entry points share the same capability/mode refusal. */
function requireGroupEditing(): void {
  if (!canEditNow()) throw new Error("This canvas is read-only.");
  if (!groupsEnabled()) throw new Error("Groups are not enabled on this canvas yet.");
}
/** Local menus may start an asynchronous act without dropping its refusal. */
export function groupTask(work: () => void | Promise<unknown>): void {
  try { Promise.resolve(work()).catch((error: Error) => setNotice(error.message)); }
  catch (error) { setNotice((error as Error).message); }
}
/** Submit public intent through the existing queue and authoritative operation writer. */
export async function changeCanvasGroup(canvasId: string, actor: Actor, action: Exclude<GroupAction, { kind: "apply" }>): Promise<void> {
  if (useCanvasStore.getState().canvasId === canvasId) requireGroupEditing();
  const result = await sendEchoedResult(canvasId, actor, { type: "group.change", action });
  if (result.status === "refused") throw new Error(result.message ?? "The group change was refused.");
  if (result.status === "queued") throw new PendingGroupWriteError();
}
/** Header and content edits use one existing item intent and the writer's bounded header repair. */
export async function changeGroupItem(canvasId: string, actor: Actor, op: Extract<Operation, { type: "item.update" | "item.addVersion" }>): Promise<void> {
  if (useCanvasStore.getState().canvasId === canvasId) requireGroupEditing();
  const result = await sendEchoedResult(canvasId, actor, op);
  if (result.status === "refused") throw new Error(result.message || "The group edit was refused.");
  if (result.status === "queued") throw new PendingGroupWriteError();
}
/** Upload first, then save Markdown and its reserved band as one accepted operation. */
export async function saveGroupBrief(canvasId: string, actor: Actor, itemId: string, body: string, briefHeight: number): Promise<void> {
  requireGroupEditing();
  const upload = await uploadBlob(canvasId, new Blob([body || "\n"], { type: "text/markdown" }), "group.md");
  await changeGroupItem(canvasId, actor, { type: "item.addVersion", itemId, briefHeight: body.trim() ? briefHeight : 0, version: { id: newVersionId(), blobHash: upload.blobHash, size: upload.size, mimeType: "text/markdown", filename: "group.md" } });
}
/** Open a reviewable creation form; every launch surface calls this same entry. */
export function openGroupCreation(itemIds: string[] = [], at?: { x: number; y: number }): void {
  groupTask(() => { requireGroupEditing(); useUiStore.getState().setGroupDialog({ kind: "create", itemIds, ...(at ? { at } : {}) }); });
}
/** Creating the brief blob does not split the structural act into separate writes. */
export async function createCanvasGroup(canvasId: string, actor: Actor, title: string, brief: string, itemIds: string[], at: { x: number; y: number }): Promise<string> {
  requireGroupEditing();
  const canvas = useCanvasStore.getState().canvas;
  if (!canvas) throw new Error("The canvas is not loaded.");
  const containerId = useUiStore.getState().activeGroupId;
  const id = newItemId();
  const up = await uploadBlob(canvasId, new Blob([brief || "\n"], { type: "text/markdown" }), "group.md");
  const creation = { id, title: title.trim() || "Untitled group", description: brief, version: { id: newVersionId(), blobHash: up.blobHash, size: up.size, mimeType: "text/markdown", filename: "group.md" }, box: { ...at, ...GROUP_DEFAULT_SIZE }, layout: { briefHeight: brief.trim() ? 120 : 0 } };
  const action = itemIds.length ? groupWrapAction(canvas, creation, itemIds) : { kind: "create" as const, group: creation, containerId };
  await changeCanvasGroup(canvasId, actor, action);
  // Wrapping grows the frame above existing cards. Reveal its accepted
  // header/brief by moving only the camera, never the saved arrangement.
  if (selectCreatedItems(canvasId, [id])) zoomToItem(id);
  return id;
}
/** Remove promotes each selected root one level through the shared atomic intent. */
export function removeFromCanvasGroup(canvasId: string, actor: Actor, itemIds: string[], toRoot = false): Promise<void> {
  const canvas = useCanvasStore.getState().canvas;
  if (!canvas) return Promise.reject(new Error("The canvas is not loaded."));
  return changeCanvasGroup(canvasId, actor, groupRemoveAction(canvas, itemIds, toRoot));
}
/** Attachment is deliberately cleared before an independent membership edit. */
export async function detachGroupInk(canvasId: string, actor: Actor, item: Item): Promise<void> {
  requireGroupEditing();
  if (!annotationTarget(item)) throw new Error("This ink has no annotated item.");
  const result = await sendEchoedResult(canvasId, actor, { type: "item.update", itemId: item.id, patch: { removeProperties: ["annotates", "region"] } });
  if (result.status === "refused") throw new Error(result.message);
  if (result.status === "queued") throw new PendingGroupWriteError();
}
/** Resolve pointer hits before selection, including a deliberate click outside the scope. */
export function scopedHit(itemId: string): string {
  const canvas = useCanvasStore.getState().canvas;
  const ui = useUiStore.getState();
  if (!canvas || !groupsEnabled()) return itemId;
  const hit = groupScopedRoot(canvas, itemId, ui.activeGroupId);
  if (hit) return hit;
  ui.setActiveGroup(null);
  return groupScopedRoot(canvas, itemId, null) ?? itemId;
}
/** Enter selects children only on demand; the scope itself is not a mass selection. */
export function enterCanvasGroup(id: string): void {
  const item = useCanvasStore.getState().canvas?.items[id];
  if (item && isGroupItem(item)) useUiStore.getState().setActiveGroup(id);
}
/** Escape leaves one membership level and selects the frame just left. */
export function leaveCanvasGroup(): void {
  const ui = useUiStore.getState();
  const item = ui.activeGroupId ? useCanvasStore.getState().canvas?.items[ui.activeGroupId] : null;
  ui.setActiveGroup(item?.containerId ?? null);
  if (item) ui.select(item.id);
}
/** Direct contents are an explicit editing selection, distinct from recursive context. */
export function selectGroupContents(id: string): void {
  const canvas = useCanvasStore.getState().canvas;
  if (!canvas) return;
  enterCanvasGroup(id);
  useUiStore.getState().setSelection(groupChildren(canvas, id).map((item) => item.id));
}
/** Selecting a parent exposes it in its own parent scope. */
export function selectParentGroup(id: string): void {
  const canvas = useCanvasStore.getState().canvas;
  const parent = canvas ? groupAncestors(canvas, id)[0] : undefined;
  if (!parent) return;
  useUiStore.getState().setActiveGroup(parent.containerId ?? null);
  useUiStore.getState().select(parent.id);
}

/** A queued form stays reviewable and must not submit the same creation twice. */
export class PendingGroupWriteError extends Error {
  constructor() { super("This group change is queued. It will sync when the home is reachable; you can close this form."); }
}

/** Mouse background selection and touch taps leave scope by the same visible boundary. */
export function leaveGroupAtPoint(world: { x: number; y: number }): void {
  const ui = useUiStore.getState();
  const active = ui.activeGroupId ? useCanvasStore.getState().canvas?.items[ui.activeGroupId] : null;
  if (active && (world.x < active.x || world.y < active.y || world.x > active.x + active.width || world.y > active.y + active.height)) ui.setActiveGroup(null);
}
