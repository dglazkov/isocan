import type { CanvasContents } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { type Box, type Viewport, centerOn, fitInto, itemsBounds, revealDelta, zoomAt } from "./viewport.ts";
import { stageRect } from "./stage.ts";

/**
 * The navigation verbs, in one place so the zoom controls, the keyboard
 * shortcuts, and the hold-Z gesture all mean exactly the same thing. Each
 * reads the live stores and hands the camera back to the user via setViewport.
 */

const cx = () => stageRect().x + stageRect().width / 2;
const cy = () => stageRect().y + stageRect().height / 2;

/** Glide length. 500ms default gives a smooth sense of motion across nodes. */
export const GLIDE_MS = 500;

let gliding = 0;

/**
 * Smooth ease transition (cubic ease-in-out).
 * Starts smoothly, cruises steadily, and decelerates gently to a stop.
 */
export function smoothEase(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Move the camera to a viewport over a smooth ease transition, so a jump
 * across the canvas reads as travel rather than teleportation — you keep your
 * bearings because you saw which way you went. A second glide cancels the
 * first, and anyone who has asked for less motion gets there immediately.
 */
export function glideTo(target: Viewport, durationMs = GLIDE_MS): void {
  cancelAnimationFrame(gliding);
  const ui = useUiStore.getState();
  const from = ui.viewport;
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    ui.setViewport(target);
    return;
  }
  const started = performance.now();
  const step = (now: number) => {
    const progress = Math.min(1, (now - started) / durationMs);
    const eased = smoothEase(progress);
    useUiStore.getState().setViewport({
      tx: from.tx + (target.tx - from.tx) * eased,
      ty: from.ty + (target.ty - from.ty) * eased,
      scale: from.scale + (target.scale - from.scale) * eased,
    });
    if (progress < 1) gliding = requestAnimationFrame(step);
  };
  gliding = requestAnimationFrame(step);
}

/** Bring a world point to the middle of the VISIBLE canvas, gliding there. */
export function glideToPoint(wx: number, wy: number): void {
  const { viewport } = useUiStore.getState();
  const stage = stageRect();
  const at = centerOn(viewport, wx, wy, stage.width, stage.height);
  glideTo({ ...at, tx: at.tx + stage.x, ty: at.ty + stage.y });
}

/**
 * Fit a world box, gliding there — the edge radar's cluster jump, and a click
 * in the files panel. It aims at the visible canvas, so the thing you asked
 * for does not land underneath the list you asked from.
 */
export function glideToBox(box: Box): void {
  glideTo(fitOnStage(box));
}

/** Fit a box into the part of the window the canvas actually has. */
function fitOnStage(box: Box): Viewport {
  return fitInto(box, stageRect());
}

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
  useUiStore.getState().setViewport(fitOnStage(box));
}

/** Fit an arbitrary world box — the Zoom tool's drag-a-region gesture. */
export function zoomToBox(box: Box): void {
  fitBox(box);
}

function boundsOfItems(canvas: CanvasContents | null, ids: string[]): Box | null {
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

/** Breathing room to leave around an item the camera reveals (clears tool rail). */
const REVEAL_MARGIN = 76;

/**
 * Bring an item into view WITHOUT moving the camera more than it has to: an
 * item already on screen does not move the world at all, one just off the edge
 * slides in, and one that cannot fit at this zoom is centered in the visible
 * canvas stage. Spatial navigation walks item to item with a smooth glide so
 * you get the feel of travelling between nodes.
 */
export function revealItem(itemId: string, durationMs = GLIDE_MS): void {
  const item = useCanvasStore.getState().canvas?.items[itemId];
  if (!item) return;
  const ui = useUiStore.getState();
  const { viewport } = ui;
  const stage = stageRect();
  const left = item.x * viewport.scale + viewport.tx;
  const top = item.y * viewport.scale + viewport.ty;
  const right = left + item.width * viewport.scale;
  const bottom = top + item.height * viewport.scale;

  const { dx, dy } = revealDelta({ left, top, right, bottom }, stage, REVEAL_MARGIN);
  if (dx !== 0 || dy !== 0) {
    glideTo({ ...viewport, tx: viewport.tx + dx, ty: viewport.ty + dy }, durationMs);
  }
}

/** Fit one item — the hold-Z gesture: hold Z, click a node, land on it. */
export function zoomToItem(itemId: string): void {
  const it = useCanvasStore.getState().canvas?.items[itemId];
  if (it) fitBox({ minX: it.x, minY: it.y, maxX: it.x + it.width, maxY: it.y + it.height });
}
