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
import { deskOf, sprintState } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";

const Chip = lazy(() => import("./SprintChip.tsx").then((m) => ({ default: m.SprintChip })));

/** Load SprintChip and its sprint-only actions only on canvases running a sprint or linked as a desk. */
export function SprintChip(props: ComponentProps<typeof Chip>) {
  const active = useCanvasStore(
    (s) => Boolean(s.record && deskOf(s.record)) || Boolean(s.canvas && sprintState(s.canvas)),
  );
  return active ? <Suspense fallback={null}><Chip {...props} /></Suspense> : null;
}
