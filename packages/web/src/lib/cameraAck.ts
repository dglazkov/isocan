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
 * **Verified camera tween** (Open Stitch phase 1B, ADR 0304).
 *
 * Animates the viewport over a 320ms cubic ease-out curve while giving the
 * user unconditional priority: any `wheel` or `pointerdown` event immediately
 * cancels the tween and resolves `{ status: "interrupted", viewport }`. Agents
 * and callers only receive `{ status: "verified", viewport }` after the final
 * frame has settled on screen.
 */

import { useUiStore } from "../stores/uiStore.ts";
import type { Viewport } from "./viewport.ts";

/** Default verified-camera tween duration in milliseconds (ADR 0304). */
export const CAMERA_ACK_DURATION_MS = 320;

/** Cubic ease-out curve: fast takeoff, smooth settle. */
export function easeOutCubic(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - clamped, 3);
}

/** Terminal outcome returned only after the camera tween settles or yields. */
interface CameraAckResult {
  readonly status: "verified" | "interrupted";
  readonly viewport: Viewport;
}

interface AnimateViewportOptions {
  /** Tween duration in ms (defaults to `CAMERA_ACK_DURATION_MS` = 320). */
  durationMs?: number;
  /** Custom viewport reader (defaults to `useUiStore.getState().viewport`). */
  getViewport?: () => Viewport;
  /** Custom viewport writer (defaults to `useUiStore.getState().setViewport`). */
  setViewport?: (viewport: Viewport) => void;
  /** Event target watched for user `wheel` / `pointerdown` interruption (defaults to `window`). */
  interruptTarget?: Pick<Window, "addEventListener" | "removeEventListener"> | null;
  /** Reduced-motion override (defaults to `window.matchMedia("(prefers-reduced-motion: reduce)")`). */
  reducedMotion?: boolean;
  /** Optional animation frame / clock overrides for deterministic unit tests. */
  now?: () => number;
  requestFrame?: (cb: FrameRequestCallback) => number;
  cancelFrame?: (id: number) => void;
}

let activeCancel: (() => void) | null = null;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Tween the canvas viewport to `target` over 320ms ease-out and resolve only
 * once the camera settles (`"verified"`) or the user takes the camera back via
 * `wheel` / `pointerdown` (`"interrupted"`).
 */
export function animateViewportTo(
  target: Viewport,
  opts: AnimateViewportOptions = {},
): Promise<CameraAckResult> {
  // Any newly requested camera tween interrupts an older in-flight tween.
  activeCancel?.();

  const durationMs = opts.durationMs ?? CAMERA_ACK_DURATION_MS;
  const getViewport = opts.getViewport ?? (() => useUiStore.getState().viewport);
  const setViewport = opts.setViewport ?? ((vp) => useUiStore.getState().setViewport(vp));
  const interruptTarget =
    opts.interruptTarget === undefined
      ? (typeof window !== "undefined" ? window : null)
      : opts.interruptTarget;
  const reduced = opts.reducedMotion ?? prefersReducedMotion();
  const now = opts.now ?? (() => performance.now());
  const reqFrame = opts.requestFrame ?? ((cb: FrameRequestCallback) => requestAnimationFrame(cb));
  const cancelFrame = opts.cancelFrame ?? ((id: number) => cancelAnimationFrame(id));

  const from = { ...getViewport() };

  if (reduced || durationMs <= 0) {
    setViewport({ ...target });
    return Promise.resolve({ status: "verified", viewport: { ...getViewport() } });
  }

  return new Promise<CameraAckResult>((resolve) => {
    let rafId = 0;
    let settled = false;
    const started = now();

    const cleanup = () => {
      if (rafId) {
        cancelFrame(rafId);
        rafId = 0;
      }
      interruptTarget?.removeEventListener("wheel", onInterrupt, true);
      interruptTarget?.removeEventListener("pointerdown", onInterrupt, true);
      if (activeCancel === onInterrupt) activeCancel = null;
    };

    const finish = (status: "verified" | "interrupted") => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({ status, viewport: { ...getViewport() } });
    };

    const onInterrupt = () => {
      finish("interrupted");
    };

    activeCancel = onInterrupt;
    interruptTarget?.addEventListener("wheel", onInterrupt, { capture: true, passive: true });
    interruptTarget?.addEventListener("pointerdown", onInterrupt, { capture: true, passive: true });

    const step = (frameTime: number) => {
      if (settled) return;
      const elapsed = Math.max(0, (Number.isFinite(frameTime) ? frameTime : now()) - started);
      const progress = Math.min(1, elapsed / durationMs);
      const eased = easeOutCubic(progress);

      setViewport({
        tx: from.tx + (target.tx - from.tx) * eased,
        ty: from.ty + (target.ty - from.ty) * eased,
        scale: from.scale + (target.scale - from.scale) * eased,
      });

      if (progress >= 1) {
        finish("verified");
        return;
      }
      rafId = reqFrame(step);
    };

    rafId = reqFrame(step);
  });
}
