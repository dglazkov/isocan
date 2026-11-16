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

import { useEffect, useRef } from "react";
import { useUiStore } from "../stores/uiStore.ts";

/** World grid spacing, in px at scale 1 — must match .canvas-viewport's dots. */
const GRID = 22;
/** Fade the spotlight to nothing over roughly this long once the cursor rests. */
const FADE_MS = 750;

/**
 * A little fun: the dot grid lights up around the cursor and decays as you
 * stop moving. It is a second, brighter copy of the grid (aligned to the base
 * one) shown only through a soft circular mask at the pointer; a rAF loop eases
 * its opacity back to zero. Decorative and cheap — no state, no re-renders per
 * move (we write straight to the node), and CSS hides it for reduced-motion.
 */
export function CursorGlow() {
  const on = useUiStore((s) => s.cursorGlow);
  const scale = useUiStore((s) => s.viewport.scale);
  const tx = useUiStore((s) => s.viewport.tx);
  const ty = useUiStore((s) => s.viewport.ty);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !on) return;
    let opacity = 0;
    let raf = 0;
    let last = 0;
    let running = false;

    function tick(now: number) {
      const dt = last ? now - last : 16;
      last = now;
      opacity = Math.max(0, opacity - dt / FADE_MS);
      el!.style.opacity = String(opacity);
      if (opacity > 0.002) {
        raf = requestAnimationFrame(tick);
      } else {
        running = false;
        last = 0;
      }
    }
    function onMove(e: PointerEvent) {
      el!.style.setProperty("--gx", `${e.clientX}px`);
      el!.style.setProperty("--gy", `${e.clientY}px`);
      opacity = 1;
      el!.style.opacity = "1";
      if (!running) {
        running = true;
        last = 0;
        raf = requestAnimationFrame(tick);
      }
    }
    window.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [on]);

  // Off means nothing drawn and no listener left running — the effect above
  // returns early on the same flag, so turning it off stops the work rather
  // than hiding its result.
  if (!on) return null;
  // The brighter grid must sit exactly over the base one — same size and origin.
  return (
    <div
      ref={ref}
      className="cursor-glow"
      style={{
        backgroundSize: `${GRID * scale}px ${GRID * scale}px`,
        backgroundPosition: `${tx}px ${ty}px`,
      }}
    />
  );
}
