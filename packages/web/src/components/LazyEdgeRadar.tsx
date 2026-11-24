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
import { useCanvasStore } from "../stores/canvasStore.ts";

const Radar = lazy(() => import("./EdgeRadar.tsx").then((m) => ({ default: m.EdgeRadar })));

/** Load EdgeRadar and its geometry once the canvas actually holds items. */
export function EdgeRadar(props: ComponentProps<typeof Radar>) {
  const hasItems = useCanvasStore((s) => Boolean(s.canvas && Object.keys(s.canvas.items).length > 0));
  return hasItems ? <Suspense fallback={null}><Radar {...props} /></Suspense> : null;
}
