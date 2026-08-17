import type { CanvasState } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { type Box, fitBounds, itemsBounds, zoomAt } from "./viewport.ts";

/**
 * The navigation verbs, in one place so the zoom controls, the keyboard
 * shortcuts, and the hold-Z gesture all mean exactly the same thing. Each
 * reads the live stores and hands the camera back to the user via setViewport.
 */

const cx = () => window.innerWidth / 2;
const cy = () => window.innerHeight / 2;

/** Zoom about the screen center by a multiplicative factor (buttons, wheel). */
export function zoomBy(factor: number): void {
  const ui = useUiStore.getState();
  ui.setViewport(zoomAt(ui.viewport, cx(), cy(), factor));
}

/** Snap to 100% (scale 1) keeping the current center fixed. */
export function zoomTo100(): void {
  const ui = useUiStore.getState();
  ui.setViewport(zoomAt(ui.viewport, cx(), cy(), 1 / ui.viewport.scale));
}

function fitBox(box: Box | null): void {
  if (!box) return;
  useUiStore.getState().setViewport(fitBounds(box, window.innerWidth, window.innerHeight));
}

function boundsOfItems(canvas: CanvasState | null, ids: string[]): Box | null {
  if (!canvas || ids.length === 0) return null;
  const box: Box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  let found = false;
  for (const id of ids) {
    const it = canvas.items[id];
    if (!it) continue;
    found = true;
    box.minX = Math.min(box.minX, it.x);
    box.minY = Math.min(box.minY, it.y);
    box.maxX = Math.max(box.maxX, it.x + it.width);
    box.maxY = Math.max(box.maxY, it.y + it.height);
  }
  return found ? box : null;
}

/** Fit every item on the canvas (0 / ⇧1). */
export function zoomToFit(): void {
  fitBox(itemsBounds(useCanvasStore.getState().canvas!));
}

/** Fit the current selection (⇧2). No-op with nothing selected. */
export function zoomToSelection(): void {
  const ids = useUiStore.getState().selectedItemIds;
  fitBox(boundsOfItems(useCanvasStore.getState().canvas, ids));
}

/** Fit one item — the hold-Z gesture: hold Z, click a node, land on it. */
export function zoomToItem(itemId: string): void {
  const it = useCanvasStore.getState().canvas?.items[itemId];
  if (it) fitBox({ minX: it.x, minY: it.y, maxX: it.x + it.width, maxY: it.y + it.height });
}
