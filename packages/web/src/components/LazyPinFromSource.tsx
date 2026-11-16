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

const Picker = lazy(() => import("./PinFromSource.tsx").then((module) => ({ default: module.PinFromSource })));

/** The picker and the copy act it drives arrive only on a canvas that actually
 *  inherits something, and only once Context is open — the eager half of a
 *  feature has to be a separate file from the lazy half
 *  (`scripts/bundle-ceiling.mjs`). */
export function PinFromSource(props: ComponentProps<typeof Picker>) {
  return <Suspense fallback={<p className="ctx-why">Loading…</p>}><Picker {...props} /></Suspense>;
}
