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
 * **Press-and-hold pickup, screen-constant perimeter grab ring, and DOM gesture
 * contract** (Open Stitch phase 1B, ADR 0289).
 *
 * - 200ms stationary hold lifts the card (`scale(1.025)` via `.node-press-lifted`)
 * - Moving past 4px before 200ms cancels the hold timer and starts an immediate drag
 * - A screen-constant 10px perimeter grab ring keeps iframes/sites draggable
 * - Static DOM attributes (`data-node-drag-handle`, `data-node-perimeter`,
 *   `data-node-interactive`) define pointer ownership unambiguously
 */

/** Stationary press duration before a card lifts for press-and-hold pickup (ms). */
export const NODE_HOLD_LIFT_MS = 200;

/** Pointer travel threshold (screen px) that immediately starts a drag instead of waiting for hold-lift. */
export const NODE_DRAG_SLOP_PX = 4;

/** Tactile lift scale factor applied during press-and-hold pickup. */
export const NODE_LIFT_SCALE = 1.025;

/** CSS class toggled on a node while lifted during press-and-hold pickup. */
export const NODE_LIFTED_CLASS = "node-press-lifted";

/** Screen-constant perimeter grab ring thickness in screen pixels (works over iframes). */
export const NODE_PERIMETER_RING_PX = 10;

/** Canonical DOM contract data attributes (ADR 0289). */
export const NODE_GESTURE_ATTR = {
  dragHandle: "data-node-drag-handle",
  perimeter: "data-node-perimeter",
  interactive: "data-node-interactive",
} as const;

/** Native interactive selector that yields drag pickup unless explicitly marked as a drag handle. */
const NATIVE_INTERACTIVE_SELECTOR =
  'button, a, input, textarea, select, [contenteditable="true"], [role="textbox"]';

export type NodeTargetRole = "drag-handle" | "perimeter" | "interactive" | "content";

/**
 * Classify a DOM event target against the ADR 0289 attribute contract:
 * 1. Explicit `[data-node-interactive]` owns the pointer (no drag pickup).
 * 2. Explicit `[data-node-perimeter]` starts perimeter grab (works over iframes).
 * 3. Explicit `[data-node-drag-handle]` starts handle drag.
 * 4. Native interactive controls yield to interactive clicks; everything else is card content.
 */
export function classifyNodePointerTarget(target: EventTarget | null): NodeTargetRole {
  if (!target || typeof (target as Element).closest !== "function") return "content";
  const el = target as Element;
  if (el.closest(`[${NODE_GESTURE_ATTR.interactive}]`)) return "interactive";
  if (el.closest(`[${NODE_GESTURE_ATTR.perimeter}]`)) return "perimeter";
  if (el.closest(`[${NODE_GESTURE_ATTR.dragHandle}]`)) return "drag-handle";
  if (el.closest(NATIVE_INTERACTIVE_SELECTOR)) return "interactive";
  return "content";
}

/**
 * Convert the screen-constant 10px perimeter grab ring into world units at `zoom`,
 * clamped so extreme zooms stay well-behaved.
 */
export function perimeterRingWorldPx(zoom: number, screenPx = NODE_PERIMETER_RING_PX): number {
  const safeZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  return Number((screenPx / safeZoom).toFixed(3));
}

/** Four screen-constant edge strips describing a node's perimeter grab ring. */
export interface PerimeterRingEdge {
  readonly side: "top" | "right" | "bottom" | "left";
  readonly attrs: {
    readonly "data-node-perimeter": "true";
    readonly "data-node-drag-handle": "true";
    readonly "data-perimeter-side": "top" | "right" | "bottom" | "left";
  };
  readonly thicknessWorldPx: number;
}

/** Build the four edge descriptors for a node's screen-constant 10px perimeter grab ring. */
export function nodePerimeterRingEdges(zoom: number): readonly PerimeterRingEdge[] {
  const thicknessWorldPx = perimeterRingWorldPx(zoom);
  const sides = ["top", "right", "bottom", "left"] as const;
  return sides.map((side) => ({
    side,
    thicknessWorldPx,
    attrs: {
      "data-node-perimeter": "true",
      "data-node-drag-handle": "true",
      "data-perimeter-side": side,
    },
  }));
}

export type NodePressPhase = "idle" | "pressing" | "lifted" | "dragging";

export interface NodePressStartInfo {
  readonly dx: number;
  readonly dy: number;
  readonly lifted: boolean;
  readonly mode: "immediate-drag" | "lifted-drag";
  readonly role: NodeTargetRole;
}

export interface NodePressEndInfo {
  readonly moved: boolean;
  readonly lifted: boolean;
  readonly cancelled: boolean;
}

export interface NodePressMachineOptions {
  /** Hold threshold before lifting (defaults to `NODE_HOLD_LIFT_MS` = 200ms). */
  holdMs?: number;
  /** Drag slop threshold in screen pixels (defaults to `NODE_DRAG_SLOP_PX` = 4px). */
  slopPx?: number;
  /** Optional host element that receives `NODE_LIFTED_CLASS` while lifted. */
  element?: HTMLElement | null;
  onLift?: () => void;
  onDragStart?: (info: NodePressStartInfo) => void;
  onDragMove?: (delta: { dx: number; dy: number; lifted: boolean }) => void;
  onEnd?: (info: NodePressEndInfo) => void;
}

export interface NodePressMachine {
  readonly phase: () => NodePressPhase;
  readonly isLifted: () => boolean;
  pointerDown: (point: { x: number; y: number; target?: EventTarget | null }) => boolean;
  pointerMove: (point: { x: number; y: number }) => void;
  pointerUp: () => void;
  pointerCancel: () => void;
  dispose: () => void;
}

/**
 * Pure/DOM press-and-hold state machine distinguishing a 200ms stationary lift
 * (`scale(1.025)`) from an immediate >4px drag gesture.
 */
export function createNodePressMachine(opts: NodePressMachineOptions = {}): NodePressMachine {
  const holdMs = opts.holdMs ?? NODE_HOLD_LIFT_MS;
  const slopPx = opts.slopPx ?? NODE_DRAG_SLOP_PX;
  const element = opts.element ?? null;

  let phase: NodePressPhase = "idle";
  let lifted = false;
  let moved = false;
  let role: NodeTargetRole = "content";
  let start = { x: 0, y: 0 };
  let timer: ReturnType<typeof setTimeout> | null = null;

  function clearTimer(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function applyLiftClass(on: boolean): void {
    if (!element) return;
    if (on) element.classList.add(NODE_LIFTED_CLASS);
    else element.classList.remove(NODE_LIFTED_CLASS);
  }

  function finish(cancelled: boolean): void {
    clearTimer();
    if (phase === "idle") return;
    const summary: NodePressEndInfo = { moved, lifted, cancelled };
    phase = "idle";
    lifted = false;
    moved = false;
    applyLiftClass(false);
    opts.onEnd?.(summary);
  }

  return {
    phase: () => phase,
    isLifted: () => lifted,

    pointerDown({ x, y, target = null }) {
      clearTimer();
      role = classifyNodePointerTarget(target);
      if (role === "interactive") {
        phase = "idle";
        lifted = false;
        moved = false;
        return false;
      }
      start = { x, y };
      phase = "pressing";
      lifted = false;
      moved = false;
      applyLiftClass(false);

      timer = setTimeout(() => {
        timer = null;
        if (phase !== "pressing") return;
        phase = "lifted";
        lifted = true;
        applyLiftClass(true);
        opts.onLift?.();
      }, holdMs);

      return true;
    },

    pointerMove({ x, y }) {
      if (phase === "idle") return;
      const dx = x - start.x;
      const dy = y - start.y;

      if (phase === "dragging") {
        opts.onDragMove?.({ dx, dy, lifted });
        return;
      }

      if (Math.hypot(dx, dy) > slopPx) {
        clearTimer();
        const wasLifted = lifted;
        phase = "dragging";
        moved = true;
        opts.onDragStart?.({
          dx,
          dy,
          lifted: wasLifted,
          mode: wasLifted ? "lifted-drag" : "immediate-drag",
          role,
        });
        opts.onDragMove?.({ dx, dy, lifted: wasLifted });
      }
    },

    pointerUp() {
      finish(false);
    },

    pointerCancel() {
      finish(true);
    },

    dispose() {
      clearTimer();
      phase = "idle";
      lifted = false;
      moved = false;
      applyLiftClass(false);
    },
  };
}

/**
 * Count `[role="toolbar"]` elements mounted inside each `[data-item-id]` node.
 * Enforces the Open Stitch **one-toolbar-per-item** invariant (ADR 0289).
 */
export function countToolbarsPerItem(root: ParentNode): Map<string, number> {
  const counts = new Map<string, number>();
  for (const node of root.querySelectorAll("[data-item-id]")) {
    const id = node.getAttribute("data-item-id");
    if (!id) continue;
    const ownToolbars = Array.from(node.querySelectorAll('[role="toolbar"]')).filter(
      (tb) => tb.closest("[data-item-id]") === node,
    );
    counts.set(id, ownToolbars.length);
  }
  return counts;
}
