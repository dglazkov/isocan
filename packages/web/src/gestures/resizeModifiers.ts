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
 * **Live Shift / Option resize modifier session** (Open Stitch phase 1B,
 * ADR 0257 §2.5 & ADR 0289 §3).
 *
 * Wraps `@isocan/core/resize-geometry`'s stateless `computeResizeBox` with
 * live `keydown` / `keyup` listeners so toggling Shift (proportional) or
 * Option/Alt (from centre) mid-drag recomputes directly from `start` + total
 * pointer delta without accumulating rounding or anchor drift.
 */

import {
  computeResizeBox,
  type CornerHandle,
  type Rect,
  type ResizeBounds,
  type ResizeModifiers,
} from "@isocan/core/resize-geometry";

export interface ResizeModifierSessionOptions {
  /** Item rectangle in world coordinates at pointer-down. */
  start: Rect;
  /** Active corner handle (`nw` | `ne` | `sw` | `se`). */
  handle: CornerHandle;
  /** Min/max world clamps. */
  bounds?: ResizeBounds;
  /** Kind-level aspect lock (e.g. image/video); makes Shift a no-op. */
  lockAspect?: boolean;
  /** Initial modifier key state at pointer-down. */
  initialModifiers?: Pick<ResizeModifiers, "proportional" | "fromCenter">;
  /** Event target for live keyboard listeners (defaults to `window`). */
  eventTarget?: Pick<Window, "addEventListener" | "removeEventListener"> | null;
  /** Invoked whenever pointer motion or a mid-drag modifier key changes the box. */
  onChange: (box: Rect, modifiers: Readonly<ResizeModifiers>) => void;
}

export interface ResizeModifierSession {
  /** Update the total world-space pointer delta from drag start and recompute. */
  update(
    delta: { dx: number; dy: number },
    pointerModifiers?: Pick<ResizeModifiers, "proportional" | "fromCenter">,
  ): Rect;
  /** Current computed rectangle. */
  currentBox(): Rect;
  /** Current active modifier flags. */
  currentModifiers(): ResizeModifiers;
  /** Detach keyboard listeners and return the settled rectangle. */
  dispose(): Rect;
}

/**
 * Start a live corner-resize gesture session that recomputes from `start` on
 * every pointer move and every mid-drag Shift / Option key transition.
 */
export function createResizeModifierSession(
  opts: ResizeModifierSessionOptions,
): ResizeModifierSession {
  const { start, handle, bounds, lockAspect = false, onChange } = opts;
  const target = opts.eventTarget === undefined
    ? (typeof window !== "undefined" ? window : null)
    : opts.eventTarget;

  let delta = { dx: 0, dy: 0 };
  let proportional = Boolean(opts.initialModifiers?.proportional);
  let fromCenter = Boolean(opts.initialModifiers?.fromCenter);
  let disposed = false;

  const activeModifiers = (): ResizeModifiers => ({
    proportional,
    fromCenter,
    lockAspect,
  });

  let latestBox: Rect = computeResizeBox(start, handle, delta, activeModifiers(), bounds);

  const recompute = (emit: boolean): Rect => {
    latestBox = computeResizeBox(start, handle, delta, activeModifiers(), bounds);
    if (emit) onChange(latestBox, activeModifiers());
    return latestBox;
  };

  const onKeyEvent = (e: Event): void => {
    if (disposed) return;
    const ke = e as KeyboardEvent;
    const nextProportional = Boolean(ke.shiftKey);
    const nextFromCenter = Boolean(ke.altKey);
    if (nextProportional === proportional && nextFromCenter === fromCenter) return;
    proportional = nextProportional;
    fromCenter = nextFromCenter;
    recompute(true);
  };

  const onBlur = (): void => {
    if (disposed) return;
    if (!proportional && !fromCenter) return;
    proportional = false;
    fromCenter = false;
    recompute(true);
  };

  target?.addEventListener("keydown", onKeyEvent);
  target?.addEventListener("keyup", onKeyEvent);
  target?.addEventListener("blur", onBlur);

  return {
    update(nextDelta, pointerModifiers) {
      if (disposed) return latestBox;
      delta = { dx: nextDelta.dx, dy: nextDelta.dy };
      if (pointerModifiers) {
        if (pointerModifiers.proportional !== undefined) proportional = pointerModifiers.proportional;
        if (pointerModifiers.fromCenter !== undefined) fromCenter = pointerModifiers.fromCenter;
      }
      return recompute(true);
    },
    currentBox() {
      return { ...latestBox };
    },
    currentModifiers() {
      return activeModifiers();
    },
    dispose() {
      if (!disposed) {
        disposed = true;
        target?.removeEventListener("keydown", onKeyEvent);
        target?.removeEventListener("keyup", onKeyEvent);
        target?.removeEventListener("blur", onBlur);
      }
      return { ...latestBox };
    },
  };
}
