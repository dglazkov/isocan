import type { CanvasContents, CommentThread } from "@isocan/core";

/** The viewport transform: screen = world * scale + t. One transform node. */
export interface Viewport {
  tx: number;
  ty: number;
  scale: number;
}

/* The zoom floor and ceiling. Not exported: `zoomAt` below is the only
   thing that may clamp a scale, and a caller reaching for these is a caller
   about to build a second clamp with its own opinion. */
const MIN_SCALE = 0.05;
const MAX_SCALE = 8;

/** World → screen. The canvas stores world coordinates; everything that
 *  draws or hit-tests needs them here. */
export function worldToScreen(vp: Viewport, wx: number, wy: number): { x: number; y: number } {
  return { x: wx * vp.scale + vp.tx, y: wy * vp.scale + vp.ty };
}

/** Screen → world, the inverse. A pointer event arrives in screen space and
 *  everything it lands on is stored in world space. */
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

/** Move the viewport by a screen-space delta. Scale is untouched — panning
 *  is the one canvas gesture that does not change how big anything is. */
export function pan(vp: Viewport, dx: number, dy: number): Viewport {
  return { ...vp, tx: vp.tx + dx, ty: vp.ty + dy };
}

/** Put a world point in the middle of the window, keeping the zoom. */
export function centerOn(
  vp: Viewport,
  wx: number,
  wy: number,
  viewWidth: number,
  viewHeight: number,
): Viewport {
  return { ...vp, tx: viewWidth / 2 - wx * vp.scale, ty: viewHeight / 2 - wy * vp.scale };
}

/** Where a thread's pin sits in the world: anchored threads store an offset
 * from their item's origin, so the pin travels with the item. */
export function threadWorldPos(
  canvas: CanvasContents,
  thread: CommentThread,
): { x: number; y: number } {
  const item = thread.anchorItemId ? canvas.items[thread.anchorItemId] : undefined;
  return item ? { x: item.x + thread.x, y: item.y + thread.y } : { x: thread.x, y: thread.y };
}

/** A world-space rectangle by its edges, which is what fitting wants —
 *  `x/y/width/height` would make every caller do the same two additions. */
export interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** "Full canvas" = bounding box of all live items. Null when empty. */
export function itemsBounds(canvas: CanvasContents): Box | null {
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
/**
 * Fit a box into a RECT of the window rather than the whole of it — the part
 * the canvas actually has once the docked chrome is out of the way. The offset
 * is the whole point: fitting into the right width and then drawing from x=0
 * lands the left edge of everything underneath the panel.
 */
export function fitInto(
  box: Box,
  stage: { x: number; y: number; width: number; height: number },
  padding = 64,
): Viewport {
  const at = fitBounds(box, stage.width, stage.height, padding);
  return { ...at, tx: at.tx + stage.x, ty: at.ty + stage.y };
}

/** The viewport that puts `box` on screen with a margin — the arithmetic
 *  behind every "fit", "reveal" and "zoom to selection". */
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

/**
 * How far the camera must slide to bring an item's screen rectangle into
 * view on the stage — and no further.
 *
 * The contract is MINIMAL MOTION, in tiers:
 *
 * 1. An item entirely inside the stage does not move the world AT ALL — not
 *    even to give itself nicer air. Spatial navigation walks item to item,
 *    and a camera that adjusts on every step makes the canvas feel like the
 *    thing moving. (The first version slid anything inside the margin band,
 *    and its successor was worse: on a narrow stage it re-centred a fully
 *    visible item on every jump. Both violated the sentence this comment
 *    leads with.)
 * 2. An item off an edge slides in until it has `margin` of air — or as much
 *    as the stage can give, when the stage is too narrow for the full ask.
 * 3. Only an item wider or taller than the stage itself is centred.
 *
 * `margin` has no default on purpose: it briefly defaulted to a copy of the
 * caller's own constant, and a number spelled twice is a number that drifts.
 */
export function revealDelta(
  itemScreen: { left: number; top: number; right: number; bottom: number },
  stage: { x: number; y: number; width: number; height: number },
  margin: number,
): { dx: number; dy: number } {
  const itemWidth = itemScreen.right - itemScreen.left;
  const itemHeight = itemScreen.bottom - itemScreen.top;

  // The air each axis can actually afford, capped at what was asked for.
  const marginX = Math.max(0, Math.min(margin, (stage.width - itemWidth) / 2));
  const marginY = Math.max(0, Math.min(margin, (stage.height - itemHeight) / 2));

  let dx = 0;
  let dy = 0;

  if (itemWidth > stage.width) {
    dx = stage.x + stage.width / 2 - (itemScreen.left + itemScreen.right) / 2;
  } else if (itemScreen.left >= stage.x && itemScreen.right <= stage.x + stage.width) {
    // visible: tier 1 — stay.
  } else if (itemScreen.left < stage.x + marginX) {
    dx = stage.x + marginX - itemScreen.left;
  } else {
    dx = stage.x + stage.width - marginX - itemScreen.right;
  }

  if (itemHeight > stage.height) {
    dy = stage.y + stage.height / 2 - (itemScreen.top + itemScreen.bottom) / 2;
  } else if (itemScreen.top >= stage.y && itemScreen.bottom <= stage.y + stage.height) {
    // visible: stay.
  } else if (itemScreen.top < stage.y + marginY) {
    dy = stage.y + marginY - itemScreen.top;
  } else {
    dy = stage.y + stage.height - marginY - itemScreen.bottom;
  }

  return { dx, dy };
}
