import { groupAncestors, groupStackAction, stackToggle, type Actor, type Item } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { changeCanvasGroup, groupTask } from "./canvasgroups.ts";

/**
 * **Stack or spread a group** (groups-by-hand phase 4) — the title band's
 * button and the context menu both come here, and both send core's
 * `groupStackAction`, the act the CLI's `canvas group stack` sends too.
 *
 * Loaded on the first press, never in the first paint. Stacking also steps
 * out of the group if you are standing inside it, and takes the group as the
 * selection: what is inside a stack is drawn in the pile, not on the floor,
 * so a scope or a selection inside it would be somewhere you cannot see.
 */
export function stackGroup(canvasId: string, actor: Actor, group: Item, stacked: boolean): void {
  const ui = useUiStore.getState();
  const canvas = useCanvasStore.getState().canvas;
  if (stacked && canvas?.items[group.id]) {
    const scope = ui.activeGroupId;
    if (scope && canvas.items[scope] && (scope === group.id || groupAncestors(canvas, scope).some((up) => up.id === group.id))) ui.setActiveGroup(group.containerId ?? null);
    useUiStore.getState().setSelection([group.id]);
  }
  groupTask(() => changeCanvasGroup(canvasId, actor, groupStackAction(group, stacked)));
}

/**
 * **⇧S** (and the palette's *Stack or spread the group*): core's
 * `stackToggle` picks the groups and the direction, and each goes through
 * `stackGroup` above — the same act the menu and `canvas group stack` send.
 * Several groups take the selection together afterwards.
 */
export function toggleStack(canvasId: string, actor: Actor): boolean {
  const canvas = useCanvasStore.getState().canvas;
  const ui = useUiStore.getState();
  const plan = canvas ? stackToggle(canvas, ui.selectedItemIds, ui.activeGroupId) : null;
  if (!plan) return false;
  for (const group of plan.groups) stackGroup(canvasId, actor, group, plan.stacked);
  if (plan.stacked && plan.groups.length > 1) useUiStore.getState().setSelection(plan.groups.map((group) => group.id));
  return true;
}
