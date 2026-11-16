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

const Manifest = lazy(() => import("./GroupContext.tsx").then((module) => ({ default: module.ContextManifestView })));
const Inspection = lazy(() => import("./GroupContext.tsx").then((module) => ({ default: module.LiveContextInspection })));
const Preview = lazy(() => import("./GroupContext.tsx").then((module) => ({ default: module.MessageContextPreview })));
const fallback = <p role="status">Loading context…</p>;

/** Frozen disclosure is downloaded only when a message actually carries it. */
export function ContextManifestView(props: ComponentProps<typeof Manifest>) {
  return <Suspense fallback={fallback}><Manifest {...props} /></Suspense>;
}

/** Inspection belongs to an opened panel, outside the canvas entry budget. */
export function LiveContextInspection(props: ComponentProps<typeof Inspection>) {
  return <Suspense fallback={fallback}><Inspection {...props} /></Suspense>;
}

/** Ordinary drafts must not load the group disclosure merely by mounting a composer. */
export function MessageContextPreview(props: ComponentProps<typeof Preview>) {
  return props.context.enabled ? <Suspense fallback={fallback}><Preview {...props} /></Suspense> : null;
}
