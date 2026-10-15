import { isArea, isDrawingItem, isGroupItem, isTextItem, visualFaceOf, type Item } from "@isocan/core";
import { useCallback, useEffect, useRef, useSyncExternalStore, type RefObject } from "react";
import { useUiStore } from "../stores/uiStore.ts";
import { warmHtmlSnapshot } from "./htmlsnapshot.ts";
import type { Viewport } from "./viewport.ts";

/** Minimum camera pan speed (screen px/s) before directional lookahead engages. */
const MIN_LOOKAHEAD_SPEED = 120;
/** How far ahead in time (seconds) the moving viewport projects its corridor. */
const LOOKAHEAD_SECONDS = 0.85;
/** Minimum forward projection (screen px) once moving faster than MIN_LOOKAHEAD_SPEED. */
const MIN_LOOKAHEAD_PX = 900;
/** Maximum forward projection (screen px) during a fast fling (~3 screens ahead). */
const MAX_LOOKAHEAD_PX = 2800;
/** Cross-axis screen-pixel cushion around the swept viewport corridor. */
const LOOKAHEAD_CROSS_PAD = 120;
/** Hard cap on active directional lookahead items at any moment. */
export const MAX_LOOKAHEAD_ITEMS = 8;
/** Hard ceiling on total held lookahead items (active + grace window). */
export const MAX_HELD_LOOKAHEAD = 12;
/** How long a preloaded item stays mounted after leaving the corridor so `useOnScreen` can take over seamlessly when panning settles. */
export const LOOKAHEAD_GRACE_MS = 2_000;

interface LookaheadHit {
  itemId: string;
  /** Entry fraction along the lookahead sweep: 0 = already touching/on screen, (0..1] = arriving ahead. */
  tEnter: number;
  htmlBlob?: {
    blobHash: string;
    width: number;
    height: number;
  };
}

/**
 * Compute the camera's screen-space velocity `(vx, vy)` (px/s) across the world
 * from two consecutive viewports.
 *
 * When the world translates by `(dtx, dty)` on screen, the viewport window
 * moves across the world by `(-dtx, -dty)`. Pure zooms (`from.scale !== to.scale`)
 * return zero velocity so zooming in place does not project a pan corridor.
 */
export function cameraVelocity(
  from: Viewport,
  to: Viewport,
  dtMs: number,
): { vx: number; vy: number } {
  if (Math.abs(to.scale - from.scale) > 1e-6) return { vx: 0, vy: 0 };
  const dtx = to.tx - from.tx;
  const dty = to.ty - from.ty;
  if (dtx === 0 && dty === 0) return { vx: 0, vy: 0 };
  const seconds = Math.max(dtMs, 8) / 1000;
  return {
    vx: dtx === 0 ? 0 : -dtx / seconds,
    vy: dty === 0 ? 0 : -dty / seconds,
  };
}

/**
 * Project the camera's velocity vector forward into a bounded screen-space
 * displacement `(dx, dy)` for the lookahead corridor, or `null` when stationary.
 */
export function lookaheadVector(velocity: { vx: number; vy: number }): { dx: number; dy: number } | null {
  const speed = Math.hypot(velocity.vx, velocity.vy);
  if (speed < MIN_LOOKAHEAD_SPEED) return null;
  const travel = Math.min(MAX_LOOKAHEAD_PX, Math.max(MIN_LOOKAHEAD_PX, speed * LOOKAHEAD_SECONDS));
  return {
    dx: (velocity.vx / speed) * travel,
    dy: (velocity.vy / speed) * travel,
  };
}

/**
 * Only items that stand down into `.item-standby` when offscreen consume
 * directional lookahead slots — text nodes, ink drawings, areas, groups, and
 * native `<img>`/`<video>` surfaces stay mounted already.
 */
export function needsLookahead(item: Item): boolean {
  if (isArea(item) || isGroupItem(item) || isTextItem(item) || isDrawingItem(item)) return false;
  const current = item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions[0];
  if (!current) return false;
  if (current.mimeType.startsWith("image/") || current.mimeType.startsWith("video/")) return false;
  const visual = visualFaceOf(current);
  if (visual.mimeType.startsWith("image/") || visual.mimeType.startsWith("video/")) return false;
  return true;
}

/**
 * Slab intersection between a screen-space item box `[ix, iy, ix + iw, iy + ih]`
 * and the viewport `[0, 0, stageW, stageH]` swept along `(dx, dy)` for `t in [0, 1]`.
 *
 * Returns `tEnter` in `[0, 1]` when the swept corridor intersects the item, or
 * `null` when the item is behind the camera (`tExit < 0`), past the horizon
 * (`tEnter > 1`), or off to the side of the motion path.
 */
function sweptCorridorEntry(
  ix: number,
  iy: number,
  iw: number,
  ih: number,
  stageW: number,
  stageH: number,
  dx: number,
  dy: number,
): number | null {
  const minX = ix - stageW - LOOKAHEAD_CROSS_PAD;
  const maxX = ix + iw + LOOKAHEAD_CROSS_PAD;
  const minY = iy - stageH - LOOKAHEAD_CROSS_PAD;
  const maxY = iy + ih + LOOKAHEAD_CROSS_PAD;

  let tEnter = 0;
  let tExit = 1;

  if (Math.abs(dx) < 1e-6) {
    if (0 < minX || 0 > maxX) return null;
  } else {
    const tx1 = minX / dx;
    const tx2 = maxX / dx;
    tEnter = Math.max(tEnter, Math.min(tx1, tx2));
    tExit = Math.min(tExit, Math.max(tx1, tx2));
  }

  if (Math.abs(dy) < 1e-6) {
    if (0 < minY || 0 > maxY) return null;
  } else {
    const ty1 = minY / dy;
    const ty2 = maxY / dy;
    tEnter = Math.max(tEnter, Math.min(ty1, ty2));
    tExit = Math.min(tExit, Math.max(ty1, ty2));
  }

  if (tEnter > tExit) return null;
  return tEnter;
}

/**
 * Find the items ahead of (or crossing) the moving viewport along `velocity`,
 * ordered by arrival time `tEnter` and capped at `limit`.
 */
export function lookaheadCandidates(
  items: readonly Item[],
  viewport: Viewport,
  stage: { width: number; height: number },
  velocity: { vx: number; vy: number },
  limit = MAX_LOOKAHEAD_ITEMS,
): LookaheadHit[] {
  if (stage.width <= 0 || stage.height <= 0 || limit <= 0) return [];
  const vec = lookaheadVector(velocity);
  if (!vec) return [];

  const scored: Array<{ hit: LookaheadHit; leadScore: number }> = [];
  for (const item of items) {
    if (!needsLookahead(item)) continue;
    const iw = item.width * viewport.scale;
    const ih = item.height * viewport.scale;
    if (iw < 16 || ih < 12) continue;
    const ix = item.x * viewport.scale + viewport.tx;
    const iy = item.y * viewport.scale + viewport.ty;

    const tEnter = sweptCorridorEntry(ix, iy, iw, ih, stage.width, stage.height, vec.dx, vec.dy);
    if (tEnter === null) continue;

    // Among items already touching the viewport (`tEnter === 0`), prefer those
    // closer to the leading edge of motion rather than the trailing edge.
    const cx = ix + iw / 2 - stage.width / 2;
    const cy = iy + ih / 2 - stage.height / 2;
    const leadScore = cx * vec.dx + cy * vec.dy;

    const current = item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions[0]!;
    const visual = visualFaceOf(current);
    const hit: LookaheadHit = {
      itemId: item.id,
      tEnter,
      ...(visual.mimeType === "text/html" && !item.properties.canvas && !current.designRecord
        ? {
            htmlBlob: {
              blobHash: visual.blobHash,
              width: item.width,
              height: item.height,
            },
          }
        : {}),
    };
    scored.push({ hit, leadScore });
  }

  scored.sort((a, b) => {
    if (Math.abs(a.hit.tEnter - b.hit.tEnter) > 1e-6) {
      return a.hit.tEnter - b.hit.tEnter;
    }
    return b.leadScore - a.leadScore;
  });

  return scored.slice(0, limit).map((entry) => entry.hit);
}

// ---------- Per-item external store ----------

const activeIds = new Set<string>();
const leavingTimers = new Map<string, ReturnType<typeof setTimeout>>();
const itemListeners = new Map<string, Set<() => void>>();

function notifyItem(itemId: string): void {
  const listeners = itemListeners.get(itemId);
  if (!listeners) return;
  for (const fn of listeners) fn();
}

function dropItemNow(itemId: string): void {
  const timer = leavingTimers.get(itemId);
  if (timer !== undefined) {
    clearTimeout(timer);
    leavingTimers.delete(itemId);
  }
  if (activeIds.delete(itemId)) {
    notifyItem(itemId);
  }
}

/**
 * Publish the active directional lookahead corridor and kick off eager WebP
 * snapshot warming for incoming HTML blobs while holding recently left items
 * in a brief grace window so `IntersectionObserver` can take over without
 * flickering back to `.item-standby` when panning settles.
 */
export function applyLookahead(canvasId: string, hits: readonly LookaheadHit[]): void {
  const wanted = new Set<string>();
  for (const hit of hits) {
    wanted.add(itemIdFrom(hit));
    const existingTimer = leavingTimers.get(hit.itemId);
    if (existingTimer !== undefined) {
      clearTimeout(existingTimer);
      leavingTimers.delete(hit.itemId);
    }
    if (!activeIds.has(hit.itemId)) {
      activeIds.add(hit.itemId);
      notifyItem(hit.itemId);
    }
    if (hit.htmlBlob) {
      void warmHtmlSnapshot(canvasId, hit.htmlBlob.blobHash, hit.htmlBlob.width, hit.htmlBlob.height);
    }
  }

  for (const id of activeIds) {
    if (wanted.has(id) || leavingTimers.has(id)) continue;
    const timer = setTimeout(() => {
      leavingTimers.delete(id);
      if (activeIds.delete(id)) {
        notifyItem(id);
      }
    }, LOOKAHEAD_GRACE_MS);
    leavingTimers.set(id, timer);
  }

  while (activeIds.size > MAX_HELD_LOOKAHEAD && leavingTimers.size > 0) {
    const oldestLeaving = leavingTimers.keys().next().value;
    if (!oldestLeaving) break;
    dropItemNow(oldestLeaving);
  }
}

function itemIdFrom(hit: LookaheadHit): string {
  return hit.itemId;
}

/**
 * Drop all held lookahead items and cancel pending grace timers when the
 * canvas viewport unmounts or switches canvases so stale item IDs never linger.
 */
export function clearLookahead(): void {
  for (const timer of leavingTimers.values()) clearTimeout(timer);
  leavingTimers.clear();
  const prev = [...activeIds];
  activeIds.clear();
  for (const id of prev) notifyItem(id);
}

function subscribeLookaheadItem(itemId: string, cb: () => void): () => void {
  let set = itemListeners.get(itemId);
  if (!set) {
    set = new Set();
    itemListeners.set(itemId, set);
  }
  set.add(cb);
  return () => {
    const current = itemListeners.get(itemId);
    if (!current) return;
    current.delete(cb);
    if (!current.size) itemListeners.delete(itemId);
  };
}

function isLookaheadActive(itemId: string): boolean {
  return activeIds.has(itemId);
}

/**
 * Subscribe a single `ItemView` to whether it lies inside the moving camera's
 * directional lookahead corridor. Only items entering or leaving the corridor
 * are notified, so panning never re-renders the rest of the canvas.
 */
export function useLookahead(itemId: string): boolean {
  const subscribe = useCallback((cb: () => void) => subscribeLookaheadItem(itemId, cb), [itemId]);
  const getSnapshot = useCallback(() => isLookaheadActive(itemId), [itemId]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Watch camera motion in `CanvasViewport` and pre-warm upcoming offscreen items
 * along the velocity vector before they cross the viewport edge.
 */
export function useViewportLookahead(
  canvasId: string,
  items: readonly Item[],
  stageRef: RefObject<HTMLElement | null>,
): void {
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    let lastAt = performance.now();
    let velocity = { vx: 0, vy: 0 };

    const unsub = useUiStore.subscribe((state, prev) => {
      if (state.viewport === prev.viewport) return;
      const now = performance.now();
      const dt = now - lastAt;
      lastAt = now;

      const instant = cameraVelocity(prev.viewport, state.viewport, dt);
      velocity =
        dt > 180
          ? instant
          : {
              vx: velocity.vx * 0.35 + instant.vx * 0.65,
              vy: velocity.vy * 0.35 + instant.vy * 0.65,
            };

      const el = stageRef.current;
      const width = el?.clientWidth || (typeof window !== "undefined" ? window.innerWidth : 1280);
      const height = el?.clientHeight || (typeof window !== "undefined" ? window.innerHeight : 800);
      const hits = lookaheadCandidates(itemsRef.current, state.viewport, { width, height }, velocity);
      if (hits.length > 0 || activeIds.size > 0) {
        applyLookahead(canvasId, hits);
      }
    });

    return () => {
      unsub();
      clearLookahead();
    };
  }, [canvasId, stageRef]);
}
