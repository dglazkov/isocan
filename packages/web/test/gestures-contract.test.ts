// @vitest-environment jsdom

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

import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { nodeChromeVisibility } from "@isocan/core/node-chrome";
import { createResizeModifierSession } from "../src/gestures/resizeModifiers.ts";
import {
  createMakeRoomDragSession,
  formatMakeRoomToast,
} from "../src/gestures/makeRoomDrag.ts";
import {
  NODE_DRAG_SLOP_PX,
  NODE_GESTURE_ATTR,
  NODE_HOLD_LIFT_MS,
  NODE_LIFTED_CLASS,
  NODE_LIFT_SCALE,
  NODE_PERIMETER_RING_PX,
  classifyNodePointerTarget,
  countToolbarsPerItem,
  createNodePressMachine,
  nodePerimeterRingEdges,
  perimeterRingWorldPx,
} from "../src/gestures/nodePress.ts";

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("resizeModifiers (live Shift / Option mid-drag recomputation)", () => {
  it("recomputes cleanly from start box when Shift or Alt is toggled mid-drag without drift", () => {
    const start = { x: 100, y: 100, width: 200, height: 100 };
    const changes: Array<{ x: number; y: number; width: number; height: number }> = [];
    const session = createResizeModifierSession({
      start,
      handle: "se",
      onChange: (box) => changes.push(box),
    });

    // Free drag: +100x, +20y -> 300x120 anchored at (100,100).
    const free = session.update({ dx: 100, dy: 20 });
    expect(free).toEqual({ x: 100, y: 100, width: 300, height: 120 });

    // Press Shift mid-drag without moving pointer -> proportional 2:1 -> 300x150.
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift", shiftKey: true }));
    expect(session.currentBox()).toEqual({ x: 100, y: 100, width: 300, height: 150 });

    // Hold Alt + Shift mid-drag -> symmetric around centre (200,150), 2x delta -> 400x200 at (0,50).
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Alt", shiftKey: true, altKey: true }),
    );
    expect(session.currentBox()).toEqual({ x: 0, y: 50, width: 400, height: 200 });

    // Release both mid-drag -> returns to exact original free-drag box with zero drift.
    window.dispatchEvent(new KeyboardEvent("keyup", { key: "Alt", shiftKey: false, altKey: false }));
    expect(session.currentBox()).toEqual(free);

    // After dispose, keyboard events no longer mutate the settled box.
    const settled = session.dispose();
    const countBefore = changes.length;
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift", shiftKey: true }));
    expect(changes.length).toBe(countBefore);
    expect(settled).toEqual(free);
  });
});

describe("makeRoomDrag (Alt-held preview, release clear, atomic drop batch)", () => {
  const allItems = [
    { id: "a", x: 0, y: 0, width: 100, height: 100 },
    { id: "b", x: 140, y: 0, width: 100, height: 100 },
    { id: "c", x: 280, y: 0, width: 100, height: 100 },
  ];

  it("previews displaced neighbours while Alt is held and clears cleanly if Alt is released before drop", () => {
    const previewEvents: number[] = [];
    const drag = createMakeRoomDragSession({
      movedIds: new Set(["a"]),
      allItems,
      onPreviewChange: (offsets) => previewEvents.push(offsets.size),
    });

    // Drag item `a` into `b` while holding Alt.
    const offsets = drag.update({ x: 110, y: 0, width: 100, height: 100 }, true);
    expect(offsets.size).toBeGreaterThanOrEqual(1);
    expect(offsets.get("b")?.dx).toBeGreaterThan(0);

    // Release Alt before dropping -> neighbour previews clear cleanly.
    const cleared = drag.update({ x: 110, y: 0, width: 100, height: 100 }, false);
    expect(cleared.size).toBe(0);
    expect(previewEvents[previewEvents.length - 1]).toBe(0);

    const committed = drag.commit([{ itemId: "a", x: 110, y: 0 }]);
    expect(committed.pushedCount).toBe(0);
    expect(committed.toast).toBeNull();
    expect(committed.moves).toEqual([{ itemId: "a", x: 110, y: 0 }]);
  });

  it("commits an atomic move batch and undoable toast when dropped with Alt held", () => {
    const onUndo = vi.fn();
    const drag = createMakeRoomDragSession({
      movedIds: new Set(["a"]),
      allItems,
    });

    drag.update({ x: 110, y: 0, width: 100, height: 100 }, true);
    const result = drag.commit([{ itemId: "a", x: 110, y: 0 }], onUndo);

    expect(result.pushedCount).toBeGreaterThanOrEqual(1);
    expect(result.moves[0]).toEqual({ itemId: "a", x: 110, y: 0 });
    expect(result.moves.length).toBe(1 + result.pushedCount);
    expect(result.toast?.message).toMatch(/^Moved \d+ objects? to make room$/);
    result.toast?.undo?.();
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(formatMakeRoomToast(3)?.message).toBe("Moved 3 objects to make room");
    expect(formatMakeRoomToast(1)?.message).toBe("Moved 1 object to make room");
  });
});

describe("nodePress (200ms hold lift vs >4px immediate drag + perimeter grab ring)", () => {
  it("lifts after 200ms stationary hold and applies lifted class", () => {
    vi.useFakeTimers();
    const card = document.createElement("div");
    const onLift = vi.fn();
    const onDragStart = vi.fn();
    const onEnd = vi.fn();

    const machine = createNodePressMachine({
      element: card,
      onLift,
      onDragStart,
      onEnd,
    });

    expect(NODE_LIFT_SCALE).toBe(1.025);
    expect(machine.pointerDown({ x: 10, y: 10 })).toBe(true);
    expect(machine.phase()).toBe("pressing");

    vi.advanceTimersByTime(NODE_HOLD_LIFT_MS - 1);
    expect(machine.isLifted()).toBe(false);
    expect(card.classList.contains(NODE_LIFTED_CLASS)).toBe(false);

    vi.advanceTimersByTime(1);
    expect(machine.phase()).toBe("lifted");
    expect(machine.isLifted()).toBe(true);
    expect(card.classList.contains(NODE_LIFTED_CLASS)).toBe(true);
    expect(onLift).toHaveBeenCalledTimes(1);

    machine.pointerMove({ x: 20, y: 10 });
    expect(onDragStart).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "lifted-drag", lifted: true }),
    );

    machine.pointerUp();
    expect(machine.phase()).toBe("idle");
    expect(card.classList.contains(NODE_LIFTED_CLASS)).toBe(false);
    expect(onEnd).toHaveBeenCalledWith({ moved: true, lifted: true, cancelled: false });
  });

  it("cancels hold lift and starts immediate drag when pointer moves >4px before 200ms", () => {
    vi.useFakeTimers();
    const onLift = vi.fn();
    const onDragStart = vi.fn();
    const machine = createNodePressMachine({ onLift, onDragStart });

    machine.pointerDown({ x: 10, y: 10 });
    machine.pointerMove({ x: 10 + NODE_DRAG_SLOP_PX + 1, y: 10 });

    expect(machine.phase()).toBe("dragging");
    expect(machine.isLifted()).toBe(false);
    expect(onDragStart).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "immediate-drag", lifted: false }),
    );

    vi.advanceTimersByTime(NODE_HOLD_LIFT_MS * 2);
    expect(onLift).not.toHaveBeenCalled();
    machine.pointerUp();
  });

  it("enforces data-node-{drag-handle,perimeter,interactive} target classification and 10px perimeter ring", () => {
    const card = document.createElement("div");
    card.innerHTML = `
      <div ${NODE_GESTURE_ATTR.dragHandle}="true"><span class="handle-child">Title</span></div>
      <div ${NODE_GESTURE_ATTR.perimeter}="true"></div>
      <div ${NODE_GESTURE_ATTR.interactive}="true"><span class="inner">Editable</span></div>
      <button type="button">Native button</button>
    `;

    expect(classifyNodePointerTarget(card.querySelector(".handle-child"))).toBe("drag-handle");
    expect(classifyNodePointerTarget(card.querySelector(`[${NODE_GESTURE_ATTR.perimeter}]`))).toBe("perimeter");
    expect(classifyNodePointerTarget(card.querySelector(".inner"))).toBe("interactive");
    expect(classifyNodePointerTarget(card.querySelector("button"))).toBe("interactive");

    const machine = createNodePressMachine();
    expect(machine.pointerDown({ x: 0, y: 0, target: card.querySelector(".inner") })).toBe(false);
    expect(machine.pointerDown({ x: 0, y: 0, target: card.querySelector(`[${NODE_GESTURE_ATTR.perimeter}]`) })).toBe(true);
    machine.dispose();

    expect(NODE_PERIMETER_RING_PX).toBe(10);
    expect(perimeterRingWorldPx(0.5)).toBe(20);
    expect(perimeterRingWorldPx(2)).toBe(5);
    const edges = nodePerimeterRingEdges(1);
    expect(edges).toHaveLength(4);
    expect(edges.every((e) => e.attrs["data-node-perimeter"] === "true")).toBe(true);
  });
});

describe("nodeChromeVisibility & one-toolbar-per-item contract", () => {
  it("sheds info below 33% and title below 56px while keeping kind icon always visible", () => {
    expect(nodeChromeVisibility(0.5, 120)).toEqual({
      kindIcon: true,
      title: true,
      infoIcons: true,
      labelRow: true,
    });
    expect(nodeChromeVisibility(0.32, 120)).toEqual({
      kindIcon: true,
      title: true,
      infoIcons: false,
      labelRow: true,
    });
    expect(nodeChromeVisibility(0.2, 48)).toEqual({
      kindIcon: true,
      title: false,
      infoIcons: false,
      labelRow: true,
    });
  });

  it("enforces at most one toolbar per canvas item in DOM and in ItemView.tsx", () => {
    const board = document.createElement("div");
    board.innerHTML = `
      <div data-item-id="itm_1"><div role="toolbar"></div></div>
      <div data-item-id="itm_2"></div>
    `;
    const counts = countToolbarsPerItem(board);
    expect(counts.get("itm_1")).toBe(1);
    expect(counts.get("itm_2")).toBe(0);
    for (const [, count] of counts) {
      expect(count).toBeLessThanOrEqual(1);
    }

    const itemViewSrc = readFileSync(
      path.resolve(process.cwd(), "packages/web/src/components/ItemView.tsx"),
      "utf8",
    );
    const toolbarMatches = itemViewSrc.match(/role="toolbar"/g) ?? [];
    expect(toolbarMatches.length).toBeLessThanOrEqual(1);
  });
});
