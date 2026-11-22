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

import { lazy, Suspense } from "react";
import { useCanvasStore } from "../stores/canvasStore.ts";

const Bar = lazy(() => import("./OfflineBar.tsx").then((m) => ({ default: m.OfflineBar })));

/** Load OfflineBar only when offline, holding refused ops, or showing a notice. */
export function OfflineBar() {
  const active = useCanvasStore(
    (s) => s.connection === "offline" || s.refused.length > 0 || s.notice !== null,
  );
  return active ? <Suspense fallback={null}><Bar /></Suspense> : null;
}
