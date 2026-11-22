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

import { lazy, Suspense, type ComponentProps } from "react";
import { useUiStore } from "../stores/uiStore.ts";

const inkModule = () => import("./InkLayer.tsx");
const LazyInk = lazy(() => inkModule().then((m) => ({ default: m.InkLayer })));
const LazySketch = lazy(() => inkModule().then((m) => ({ default: m.SketchBar })));

/** Load wet-ink layer only once strokes exist on the canvas. */
export function InkLayer() {
  const active = useUiStore((s) => s.sketch.length > 0);
  return active ? <Suspense fallback={null}><LazyInk /></Suspense> : null;
}

/** Load SketchBar only while holding P or displaying a placement error. */
export function SketchBar(props: ComponentProps<typeof LazySketch>) {
  const active = useUiStore((s) => s.penSession || (s.sketchError !== null && s.sketch.length > 0));
  return active ? <Suspense fallback={null}><LazySketch {...props} /></Suspense> : null;
}
