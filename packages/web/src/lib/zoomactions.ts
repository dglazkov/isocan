import type { CanvasState } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { type Box, type Viewport, centerOn, fitBounds, itemsBounds, zoomAt } from "./viewport.ts";

/**
 * The navigation verbs, in one place so the zoom controls, the keyboard
 * shortcuts, and the hold-Z gesture all mean exactly the same thing. Each
 * reads the live stores and hands the camera back to the user via setViewport.
 */

const cx = () => window.innerWidth / 2;
const cy = () => window.innerHeight / 2;

/** Glide length. Long enough to read as travel, short enough not to be a wait. */
const GLIDE_MS = 380;

let gliding = 0;

/**
 * Move the camera to a viewport over a few hundred milliseconds, so a jump
 * across the canvas reads as travel rather than teleportation — you keep your
 * bearings because you saw which way you went. A second glide cancels the
 * first, and anyone who has asked for less motion gets there immediately.
 */
export function glideTo(target: Viewport): void {
  cancelAnimationFrame(gliding);
  const ui = useUiStore.getState();
  const from = ui.viewport;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    ui.setViewport(target);
    return;
  }
  const started = performance.now();
  const step = (now: number) => {
    const progress = Math.min(1, (now - started) / GLIDE_MS);
    // easeOutCubic: leaves quickly, arrives gently.
    const eased = 1 - Math.pow(1 - progress, 3);
    useUiStore.getState().setViewport({
      tx: from.tx + (target.tx - from.tx) * eased,
      ty: from.ty + (target.ty - from.ty) * eased,
      scale: from.scale + (target.scale - from.scale) * eased,
    });
    if (progress < 1) gliding = requestAnimationFrame(step);
  };
  gliding = requestAnimationFrame(step);
}

/** Bring a world point to the middle of the window, gliding there. */
export function glideToPoint(wx: number, wy: number): void {
  const { viewport } = useUiStore.getState();
  glideTo(centerOn(viewport, wx, wy, window.innerWidth, window.innerHeight));
}

/**
 * Fit a world box, gliding there — the edge radar's cluster jump, and a click
 * in the files panel. `reserved` is width a dock is holding: fitting into a
 * wider window than there is pushes the target clear of it, rather than
 * landing the thing you asked for underneath the list you asked from.
 */
export function glideToBox(box: Box, reserved = 0): void {
  glideTo(fitBounds(box, window.innerWidth + reserved, window.innerHeight));
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
  useUiStore.getState().setViewport(fitBounds(box, window.innerWidth, window.innerHeight));
}

/** Fit an arbitrary world box — the Zoom tool's drag-a-region gesture. */
export function zoomToBox(box: Box): void {
  fitBox(box);
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

/** Breathing room to leave around an item the camera reveals. */
const REVEAL_MARGIN = 48;

/**
 * Bring an item into view WITHOUT moving the camera more than it has to: an
 * item already on screen does not move the world at all, one just off the edge
 * slides in, and one that cannot fit at this zoom is centered. Spatial
 * navigation walks item to item, and a camera that recentered on every step
 * would make the canvas feel like it was the thing moving.
 */
export function revealItem(itemId: string): void {
  const item = useCanvasStore.getState().canvas?.items[itemId];
  if (!item) return;
  const ui = useUiStore.getState();
  const { viewport } = ui;
  const width = window.innerWidth;
  const height = window.innerHeight;
  const left = item.x * viewport.scale + viewport.tx;
  const top = item.y * viewport.scale + viewport.ty;
  const right = left + item.width * viewport.scale;
  const bottom = top + item.height * viewport.scale;

  const fitsX = right - left <= width - REVEAL_MARGIN * 2;
  const fitsY = bottom - top <= height - REVEAL_MARGIN * 2;
  let dx = 0;
  let dy = 0;
  if (!fitsX) dx = width / 2 - (left + right) / 2;
  else if (left < REVEAL_MARGIN) dx = REVEAL_MARGIN - left;
  else if (right > width - REVEAL_MARGIN) dx = width - REVEAL_MARGIN - right;
  if (!fitsY) dy = height / 2 - (top + bottom) / 2;
  else if (top < REVEAL_MARGIN) dy = REVEAL_MARGIN - top;
  else if (bottom > height - REVEAL_MARGIN) dy = height - REVEAL_MARGIN - bottom;

  if (dx !== 0 || dy !== 0) ui.setViewport({ ...viewport, tx: viewport.tx + dx, ty: viewport.ty + dy });
}

/** Fit one item — the hold-Z gesture: hold Z, click a node, land on it. */
export function zoomToItem(itemId: string): void {
  const it = useCanvasStore.getState().canvas?.items[itemId];
  if (it) fitBox({ minX: it.x, minY: it.y, maxX: it.x + it.width, maxY: it.y + it.height });
}
