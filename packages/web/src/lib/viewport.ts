import type { CanvasState } from "@isocan/core";

/** The viewport transform: screen = world * scale + t. One transform node. */
export interface Viewport {
  tx: number;
  ty: number;
  scale: number;
}

export const MIN_SCALE = 0.05;
export const MAX_SCALE = 8;

export function worldToScreen(vp: Viewport, wx: number, wy: number): { x: number; y: number } {
  return { x: wx * vp.scale + vp.tx, y: wy * vp.scale + vp.ty };
}

export function screenToWorld(vp: Viewport, sx: number, sy: number): { x: number; y: number } {
  return { x: (sx - vp.tx) / vp.scale, y: (sy - vp.ty) / vp.scale };
}

/** Zoom about a screen-space point (cursor) so that point stays fixed. */
export function zoomAt(vp: Viewport, cx: number, cy: number, factor: number): Viewport {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, vp.scale * factor));
  const ratio = scale / vp.scale;
  return {
    scale,
    tx: cx - (cx - vp.tx) * ratio,
    ty: cy - (cy - vp.ty) * ratio,
  };
}

export function pan(vp: Viewport, dx: number, dy: number): Viewport {
  return { ...vp, tx: vp.tx + dx, ty: vp.ty + dy };
}

export interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** "Full canvas" = bounding box of all live items. Null when empty. */
export function itemsBounds(canvas: CanvasState): Box | null {
  const items = Object.values(canvas.items);
  if (items.length === 0) return null;
  const box: Box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const item of items) {
    box.minX = Math.min(box.minX, item.x);
    box.minY = Math.min(box.minY, item.y);
    box.maxX = Math.max(box.maxX, item.x + item.width);
    box.maxY = Math.max(box.maxY, item.y + item.height);
  }
  return box;
}

/** Fit a world box into a viewport of the given pixel size, with padding. */
export function fitBounds(
  box: Box,
  viewWidth: number,
  viewHeight: number,
  padding = 64,
): Viewport {
  const w = Math.max(box.maxX - box.minX, 1);
  const h = Math.max(box.maxY - box.minY, 1);
  const scale = Math.min(
    MAX_SCALE,
    Math.max(MIN_SCALE, Math.min((viewWidth - padding * 2) / w, (viewHeight - padding * 2) / h, 1.5)),
  );
  return {
    scale,
    tx: (viewWidth - w * scale) / 2 - box.minX * scale,
    ty: (viewHeight - h * scale) / 2 - box.minY * scale,
  };
}
