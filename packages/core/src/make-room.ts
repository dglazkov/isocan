/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * **Make-room push engine** (Open Stitch phase 1B, ADR 0288).
 *
 * Moves colliding neighbours clear of a moved or grown rectangle with minimal
 * motion, cascading via BFS so pushed items never land on top of further
 * neighbours. Pinned/protected IDs never move (movable items slide around them
 * instead). A 512px spatial grid index keeps neighbour lookups O(1) locally so
 * 500-item canvases resolve in sub-millisecond time.
 */

import type { Rect } from "./resize-geometry.ts";

/** Rectangle paired with its item ID. */
export interface NamedRect extends Rect {
  id: string;
}

/** Options controlling push clearance, immovable items, and cascade safety cap. */
export interface MakeRoomOptions {
  /** Minimum clearance gap kept between boxes after pushing (default 24). */
  gap?: number;
  /** Item IDs that must never be moved (pinned, locked, or actively edited). */
  protectedIds?: ReadonlySet<string>;
  /** Safety cap on BFS push iterations to guarantee termination. */
  maxIterations?: number;
}

/** Default clearance gap maintained between pushed boxes in world units. */
const MAKE_ROOM_DEFAULT_GAP = 24;

/** Spatial hash cell size in world pixels (ADR 0288). */
const MAKE_ROOM_GRID_CELL = 512;

const CELL_STRIDE = 1_048_576;

function cellKey(cx: number, cy: number): number {
  return cx * CELL_STRIDE + cy;
}

function cellRange(rect: Rect, pad: number): [number, number, number, number] {
  const minCx = Math.floor((rect.x - pad) / MAKE_ROOM_GRID_CELL);
  const maxCx = Math.floor((rect.x + rect.width + pad) / MAKE_ROOM_GRID_CELL);
  const minCy = Math.floor((rect.y - pad) / MAKE_ROOM_GRID_CELL);
  const maxCy = Math.floor((rect.y + rect.height + pad) / MAKE_ROOM_GRID_CELL);
  return [minCx, maxCx, minCy, maxCy];
}

class SpatialGrid {
  private readonly cells = new Map<number, Set<string>>();
  private readonly span = new Map<string, [number, number, number, number]>();

  insert(id: string, rect: Rect): void {
    const range = cellRange(rect, 0);
    this.span.set(id, range);
    const [minCx, maxCx, minCy, maxCy] = range;
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const key = cellKey(cx, cy);
        let bucket = this.cells.get(key);
        if (!bucket) {
          bucket = new Set();
          this.cells.set(key, bucket);
        }
        bucket.add(id);
      }
    }
  }

  update(id: string, rect: Rect): void {
    const prev = this.span.get(id);
    const next = cellRange(rect, 0);
    if (
      prev &&
      prev[0] === next[0] &&
      prev[1] === next[1] &&
      prev[2] === next[2] &&
      prev[3] === next[3]
    ) {
      return;
    }
    if (prev) {
      const [minCx, maxCx, minCy, maxCy] = prev;
      for (let cx = minCx; cx <= maxCx; cx++) {
        for (let cy = minCy; cy <= maxCy; cy++) {
          const bucket = this.cells.get(cellKey(cx, cy));
          if (bucket) bucket.delete(id);
        }
      }
    }
    this.insert(id, rect);
  }

  query(rect: Rect, pad: number, out: Set<string>): void {
    out.clear();
    const [minCx, maxCx, minCy, maxCy] = cellRange(rect, pad);
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const bucket = this.cells.get(cellKey(cx, cy));
        if (!bucket) continue;
        for (const id of bucket) out.add(id);
      }
    }
  }
}

/** Minimal-motion displacement that moves `target` clear of `pusher` by `gap`, or null if already clear. */
function minimalPush(pusher: Rect, target: Rect, gap: number): { dx: number; dy: number } | null {
  const pushRight = pusher.x + pusher.width + gap - target.x;
  const pushLeft = pusher.x - gap - target.width - target.x; // negative when overlapping
  const pushDown = pusher.y + pusher.height + gap - target.y;
  const pushUp = pusher.y - gap - target.height - target.y; // negative when overlapping

  if (pushRight <= 0 || pushLeft >= 0 || pushDown <= 0 || pushUp >= 0) {
    return null;
  }

  // Pick the direction with minimal absolute travel; break ties outward from pusher centre.
  const pCx = pusher.x + pusher.width / 2;
  const pCy = pusher.y + pusher.height / 2;
  const tCx = target.x + target.width / 2;
  const tCy = target.y + target.height / 2;

  const candidates: Array<{ dx: number; dy: number; dist: number; outward: number }> = [
    { dx: pushRight, dy: 0, dist: pushRight, outward: tCx >= pCx ? 0 : 1 },
    { dx: pushLeft, dy: 0, dist: -pushLeft, outward: tCx < pCx ? 0 : 1 },
    { dx: 0, dy: pushDown, dist: pushDown, outward: tCy >= pCy ? 0 : 1 },
    { dx: 0, dy: pushUp, dist: -pushUp, outward: tCy < pCy ? 0 : 1 },
  ];

  let best = candidates[0]!;
  for (let i = 1; i < candidates.length; i++) {
    const c = candidates[i]!;
    if (c.dist < best.dist || (c.dist === best.dist && c.outward < best.outward)) {
      best = c;
    }
  }
  return { dx: best.dx, dy: best.dy };
}

/**
 * Compute minimal-motion displacements for neighbours colliding with `moved`.
 *
 * Returns a map of `itemId -> { x, y }` containing only items that actually
 * moved. Items in `movedIds` and `opts.protectedIds` never appear in the result.
 */
export function computeMakeRoom(
  moved: Rect,
  movedIds: ReadonlySet<string>,
  all: readonly NamedRect[],
  opts: MakeRoomOptions = {},
): Map<string, { x: number; y: number }> {
  const gap = opts.gap ?? MAKE_ROOM_DEFAULT_GAP;
  const protectedIds = opts.protectedIds;
  const maxIterations = opts.maxIterations ?? Math.max(all.length * 8, 1000);

  const initial = new Map<string, Rect>();
  const current = new Map<string, Rect>();
  const grid = new SpatialGrid();

  for (const box of all) {
    if (movedIds.has(box.id)) continue;
    const rect: Rect = { x: box.x, y: box.y, width: box.width, height: box.height };
    initial.set(box.id, rect);
    current.set(box.id, { ...rect });
    grid.insert(box.id, rect);
  }

  const queue: Array<{ rect: Rect; sourceId?: string }> = [{ rect: moved }];
  let head = 0;
  let iterations = 0;
  const nearby = new Set<string>();

  while (head < queue.length && iterations < maxIterations) {
    const pusher = queue[head++]!;
    iterations++;

    grid.query(pusher.rect, gap, nearby);
    for (const id of nearby) {
      if (id === pusher.sourceId) continue;
      if (protectedIds?.has(id)) continue;

      const target = current.get(id);
      if (!target) continue;

      const delta = minimalPush(pusher.rect, target, gap);
      if (!delta) continue;

      target.x += delta.dx;
      target.y += delta.dy;
      grid.update(id, target);

      // If this newly displaced box landed on a protected item, bounce it clear
      // of that immovable obstacle too so protected items remain untouched walls.
      if (protectedIds && protectedIds.size > 0) {
        const afterProtected = new Set<string>();
        grid.query(target, gap, afterProtected);
        for (const obstacleId of afterProtected) {
          if (!protectedIds.has(obstacleId)) continue;
          const wall = current.get(obstacleId);
          if (!wall) continue;
          const bounce = minimalPush(wall, target, gap);
          if (bounce) {
            target.x += bounce.dx;
            target.y += bounce.dy;
            grid.update(id, target);
          }
        }
      }

      queue.push({ rect: { ...target }, sourceId: id });
    }
  }

  const displaced = new Map<string, { x: number; y: number }>();
  for (const [id, rect] of current) {
    const start = initial.get(id)!;
    if (rect.x !== start.x || rect.y !== start.y) {
      displaced.set(id, { x: rect.x, y: rect.y });
    }
  }
  return displaced;
}
