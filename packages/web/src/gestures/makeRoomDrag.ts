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
 * **Option/Alt-held make-room drag gesture** (Open Stitch phase 1B, ADR 0288).
 *
 * Wraps `@isocan/core/make-room` `computeMakeRoom` so holding Option/Alt while
 * dragging previews gentle neighbour displacements in real time, snaps
 * neighbours back cleanly if Option/Alt is released before drop, and emits one
 * atomic move batch plus an undoable toast descriptor on drop.
 */

import {
  computeMakeRoom,
  type MakeRoomOptions,
  type NamedRect,
} from "@isocan/core/make-room";
import type { Rect } from "@isocan/core/resize-geometry";

/** Atomic move entry matching `items.move` op shape. */
export interface AtomicMoveEntry {
  itemId: string;
  x: number;
  y: number;
}

/** Undoable toast metadata returned when a make-room drop displaced neighbours. */
export interface MakeRoomToast {
  readonly message: string;
  readonly count: number;
  readonly undo?: () => void;
}

/** Format the canonical undoable toast copy (`"Moved N objects to make room"`). */
export function formatMakeRoomToast(count: number, onUndo?: () => void): MakeRoomToast | null {
  if (count <= 0) return null;
  const noun = count === 1 ? "object" : "objects";
  return {
    message: `Moved ${count} ${noun} to make room`,
    count,
    ...(onUndo ? { undo: onUndo } : {}),
  };
}

export interface MakeRoomDragOptions {
  /** IDs of the items actively being dragged (never displaced as neighbours). */
  movedIds: ReadonlySet<string>;
  /** Snapshot of all candidate canvas items at drag start. */
  allItems: readonly NamedRect[];
  /** Options forwarded to `computeMakeRoom` (gap, protectedIds, maxIterations). */
  makeRoom?: MakeRoomOptions;
  /** Called whenever the live preview offsets change (including clearing on Alt release). */
  onPreviewChange?: (
    offsets: ReadonlyMap<string, { dx: number; dy: number }>,
    positions: ReadonlyMap<string, { x: number; y: number }>,
  ) => void;
}

export interface MakeRoomCommitResult {
  /** Combined atomic moves for the dragged item(s) + any displaced neighbours. */
  moves: AtomicMoveEntry[];
  /** Number of neighbour objects displaced to make room (0 if Alt was not held at drop). */
  pushedCount: number;
  /** Undoable toast descriptor when `pushedCount > 0`, otherwise `null`. */
  toast: MakeRoomToast | null;
}

export interface MakeRoomDragSession {
  /**
   * Recompute neighbour preview displacements for the dragged union box.
   * When `altHeld` is false, all neighbour previews clear immediately.
   */
  update(movedBox: Rect, altHeld: boolean): ReadonlyMap<string, { dx: number; dy: number }>;
  /** Current live neighbour offsets `{ dx, dy }` relative to each item's start position. */
  previewOffsets(): ReadonlyMap<string, { dx: number; dy: number }>;
  /** Current live neighbour target positions `{ x, y }`. */
  previewPositions(): ReadonlyMap<string, { x: number; y: number }>;
  /**
   * Commit the drop and produce one atomic move batch (dragged items + displaced
   * neighbours) plus an undoable toast when neighbours moved.
   */
  commit(
    draggedMoves?: readonly AtomicMoveEntry[],
    onUndo?: () => void,
  ): MakeRoomCommitResult;
  /** Abort the drag and clear all neighbour previews. */
  cancel(): void;
}

function mapsEqualOffsets(
  a: ReadonlyMap<string, { dx: number; dy: number }>,
  b: ReadonlyMap<string, { dx: number; dy: number }>,
): boolean {
  if (a.size !== b.size) return false;
  for (const [id, av] of a) {
    const bv = b.get(id);
    if (!bv || bv.dx !== av.dx || bv.dy !== av.dy) return false;
  }
  return true;
}

/**
 * Create a make-room drag session for Option/Alt-held canvas drags.
 */
export function createMakeRoomDragSession(opts: MakeRoomDragOptions): MakeRoomDragSession {
  const { movedIds, allItems, makeRoom, onPreviewChange } = opts;
  const startById = new Map<string, NamedRect>();
  for (const item of allItems) startById.set(item.id, item);

  let currentOffsets = new Map<string, { dx: number; dy: number }>();
  let currentPositions = new Map<string, { x: number; y: number }>();

  function setPreviews(
    nextOffsets: Map<string, { dx: number; dy: number }>,
    nextPositions: Map<string, { x: number; y: number }>,
  ): void {
    const changed = !mapsEqualOffsets(currentOffsets, nextOffsets);
    currentOffsets = nextOffsets;
    currentPositions = nextPositions;
    if (changed) onPreviewChange?.(currentOffsets, currentPositions);
  }

  return {
    update(movedBox, altHeld) {
      if (!altHeld) {
        if (currentOffsets.size > 0) {
          setPreviews(new Map(), new Map());
        }
        return currentOffsets;
      }

      const displaced = computeMakeRoom(movedBox, movedIds, allItems, makeRoom);
      const nextOffsets = new Map<string, { dx: number; dy: number }>();
      const nextPositions = new Map<string, { x: number; y: number }>();

      for (const [id, pos] of displaced) {
        const origin = startById.get(id);
        if (!origin) continue;
        nextPositions.set(id, { x: pos.x, y: pos.y });
        nextOffsets.set(id, { dx: pos.x - origin.x, dy: pos.y - origin.y });
      }

      setPreviews(nextOffsets, nextPositions);
      return currentOffsets;
    },

    previewOffsets() {
      return currentOffsets;
    },

    previewPositions() {
      return currentPositions;
    },

    commit(draggedMoves = [], onUndo) {
      const seen = new Set<string>();
      const moves: AtomicMoveEntry[] = [];
      for (const m of draggedMoves) {
        seen.add(m.itemId);
        moves.push({ itemId: m.itemId, x: Math.round(m.x), y: Math.round(m.y) });
      }
      let pushedCount = 0;
      for (const [itemId, pos] of currentPositions) {
        if (seen.has(itemId)) continue;
        seen.add(itemId);
        pushedCount++;
        moves.push({ itemId, x: Math.round(pos.x), y: Math.round(pos.y) });
      }

      setPreviews(new Map(), new Map());
      return {
        moves,
        pushedCount,
        toast: formatMakeRoomToast(pushedCount, onUndo),
      };
    },

    cancel() {
      if (currentOffsets.size > 0) {
        setPreviews(new Map(), new Map());
      }
    },
  };
}
