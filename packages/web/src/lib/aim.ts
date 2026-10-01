import { groupAim, groupDropTarget, reachHeld } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { frameGap, groupsEnabled } from "./canvasgroups.ts";
import { screenToWorld } from "./viewport.ts";

/**
 * **Hover says what a press would take** (groups-by-hand phase 2).
 *
 * The dashed outline is `aim.itemId`, computed here from what is under the
 * pointer by core's `groupAim` — the function the press reads too — and
 * never by CSS `:hover`, which outlined a group's member at the canvas level
 * while a click took the group.
 *
 * Loaded lazily, on the first pointer move over the canvas (`CanvasViewport`):
 * the outline may come a frame late, and the press never waits on it — the
 * press reads `scopedHit` and `frameGap`, which are eager.
 */


let last: { x: number; y: number; target: EventTarget | null } | null = null;

function aim(x: number, y: number, target: EventTarget | null, reach: boolean): void {
  const ui = useUiStore.getState();
  const canvas = useCanvasStore.getState().canvas;
  if (!canvas || ui.activeTool === "pen") { ui.setAim(null); return; }
  const groups = groupsEnabled();
  // A frame's open space is the group only where a press there takes it —
  // with the Select tool. The Text tool and a comment go through to the canvas.
  const select = groups && ui.activeTool === "select" && !ui.commentMode;
  const gap = frameGap(target);
  const id = (target as HTMLElement | null)?.closest?.("[data-item-id]")?.getAttribute("data-item-id");
  let hit: Parameters<typeof groupAim>[1] = gap ? (select ? { gapIn: gap } : null) : id ? { itemId: id } : null;
  if (!hit && !id && select) {
    // Open space that is not pressable (the scope you are in) still names the
    // frame, so ⌘ there can say which members a selection box would reach.
    const frame = groupDropTarget(canvas, screenToWorld(ui.viewport, x, y), []);
    if (frame) hit = { gapIn: frame.id };
  }
  const next = hit ? groupAim(canvas, hit, groups ? ui.activeGroupId : null, groups && reach) : null;
  // Every move asks; only a change re-renders, and then only the items it names.
  if (next?.itemId !== ui.aim?.itemId || next?.inside !== ui.aim?.inside || next?.among !== ui.aim?.among) ui.setAim(next);
}

/** The pointer moved over the canvas. A held button is a gesture in progress:
 * the aim stays what the press took. */
export function aimPointer(e: { clientX: number; clientY: number; target: EventTarget | null; buttons: number; pointerType: string; metaKey: boolean; ctrlKey: boolean }): void {
  if (e.pointerType === "touch" || e.buttons !== 0) return;
  last = { x: e.clientX, y: e.clientY, target: e.target };
  aim(e.clientX, e.clientY, e.target, reachHeld(e));
}

/** ⌘ went down or up under a still pointer: aim again from where it is. */
export function aimKeys(e: { key: string; metaKey: boolean; ctrlKey: boolean }): void {
  if (last && (e.key === "Meta" || e.key === "Control")) aim(last.x, last.y, last.target, reachHeld(e));
}

/** The pointer left the canvas. */
export function aimNowhere(): void {
  last = null;
  if (useUiStore.getState().aim) useUiStore.getState().setAim(null);
}
