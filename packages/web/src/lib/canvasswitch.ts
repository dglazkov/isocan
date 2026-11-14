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

import type { NavigateFunction } from "react-router-dom";
import { canvasPath } from "@isocan/core";
import { useUiStore } from "../stores/uiStore.ts";

/**
 * **Going to another canvas, as a move rather than a cut.**
 *
 * A switch is one `navigate`, and the route element is the same `CanvasPage`
 * for every canvas, so without this the surface would simply be replaced
 * between one frame and the next — which reads as the page breaking and then
 * fixing itself. The two beats here say what happened instead: the canvas you
 * are leaving recedes, and the one you chose comes forward into its place.
 * The chrome around it — the bar, the rail — stays put, because it is the
 * same chrome; only the canvas changed.
 *
 * The phases are a class on the surface (`switching-out`, `switching-in`),
 * timed here to match the keyframes in `styles.css`. Under
 * `prefers-reduced-motion` the keyframes are off and the navigation happens
 * at once: a person who asked for no motion should not also be asked to wait
 * for motion they cannot see.
 */

/** How long each beat lasts. The CSS keyframes are written to the same
 *  numbers; a longer out-beat would be a switch that feels slow, and a longer
 *  in-beat would be a canvas you cannot click yet. */
export const SWITCH_OUT_MS = 140;
export const SWITCH_IN_MS = 220;

let pending: ReturnType<typeof setTimeout> | null = null;

export function switchCanvas(navigate: NavigateFunction, canvasId: string): void {
  const ui = useUiStore.getState();
  if (pending) clearTimeout(pending);
  if (reducedMotion()) {
    ui.setSwitching(null);
    navigate(canvasPath(canvasId));
    return;
  }
  ui.setSwitching("out");
  pending = setTimeout(() => {
    navigate(canvasPath(canvasId));
    useUiStore.getState().setSwitching("in");
    pending = setTimeout(() => {
      useUiStore.getState().setSwitching(null);
      pending = null;
    }, SWITCH_IN_MS);
  }, SWITCH_OUT_MS);
}

function reducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
}
