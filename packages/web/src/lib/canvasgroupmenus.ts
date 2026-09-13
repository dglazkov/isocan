import type { Actor, Item } from "@isocan/core";
import { annotationTarget, groupDescendants, isGroupItem, itemPath } from "@isocan/core";
import type { MenuEntry } from "../components/ContextMenu.tsx";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { changeCanvasGroup, detachGroupInk, enterCanvasGroup, groupsEnabled, groupTask, openGroupCreation, removeFromCanvasGroup, selectGroupContents, selectParentGroup } from "./canvasgroups.ts";

/** The same semantic entries serve item menus and the visible Groups button. */
export function canvasGroupEntries(items: Item[], ctx: { canvasId: string; actor: Actor; navigate: (path: string) => void }): MenuEntry[] {
  const canvas = useCanvasStore.getState().canvas;
  const ids = items.map((item) => item.id);
  const one = items.length === 1 ? items[0] : undefined;
  const group = one && isGroupItem(one) ? one : undefined;
  const enabled = groupsEnabled();
  const members = items.filter((item) => item.containerId);
  const task = (action: Parameters<typeof changeCanvasGroup>[2]) => groupTask(() => changeCanvasGroup(ctx.canvasId, ctx.actor, action));
  return [
    { separator: "Groups" },
    { label: "Group selection", shortcutFor: "Group selection", writes: true, disabled: !enabled || ids.length === 0, value: !enabled ? "Not enabled on this canvas" : ids.length ? `${ids.length} selected` : "Select items first", run: () => openGroupCreation(ids) },
    ...(group ? [
      { label: "Enter group", run: () => enterCanvasGroup(group.id) },
      { label: "Select contents", run: () => selectGroupContents(group.id) },
      { label: "Group details", run: () => useUiStore.getState().setGroupDialog({ kind: "inspect", groupId: group.id, itemIds: [] }) },
      { label: "Open brief", run: () => ctx.navigate(itemPath(ctx.canvasId, group.id)) },
      { label: "Add items…", writes: true, run: () => useUiStore.getState().setGroupDialog({ kind: "add", groupId: group.id, itemIds: [] }) },
      { label: "Fit frame to contents", writes: true, run: () => task({ kind: "frame", itemId: group.id, fit: true }) },
      { label: "Tidy contents", writes: true, run: () => task({ kind: "layout", itemId: group.id, layout: group.groupLayout ?? {}, tidy: true }) },
      { label: "Ungroup", shortcutFor: "Ungroup", writes: true, run: () => task({ kind: "ungroup", itemIds: [group.id] }) },
    ] : []),
    ...(!group && items.some(isGroupItem) ? [{ label: "Ungroup", shortcutFor: "Ungroup", writes: true, run: () => task({ kind: "ungroup", itemIds: items.filter(isGroupItem).map((item) => item.id) }) }] : []),
    { label: items.some((item) => item.containerId) ? "Move to group…" : "Add to group…", writes: true, disabled: !enabled || ids.length === 0, ...(!enabled ? { value: "Not enabled on this canvas" } : {}), run: () => useUiStore.getState().setGroupDialog({ kind: "add", itemIds: ids }) },
    ...(one?.containerId ? [{ label: "Select parent group", run: () => selectParentGroup(one.id) }] : []),
    ...(members.length ? [{ label: members.length === ids.length ? "Remove from group" : `Remove ${members.length} ${members.length === 1 ? "member" : "members"} from group`, writes: true, run: () => groupTask(() => removeFromCanvasGroup(ctx.canvasId, ctx.actor, members.map((item) => item.id))) }] : []),
    ...(one && annotationTarget(one) ? [{ label: "Detach from annotated item", writes: true, run: () => groupTask(() => detachGroupInk(ctx.canvasId, ctx.actor, one)) }] : []),
  ];
}
/** A group deletion names the descendants it takes; Ungroup remains separate. */
export function groupDeleteLabel(items: Item[]): string | null {
  if (items.length !== 1 || !isGroupItem(items[0]!)) return null;
  const canvas = useCanvasStore.getState().canvas;
  return `Delete group and ${canvas ? groupDescendants(canvas, items[0]!.id).length : 0} items`;
}
