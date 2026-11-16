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

import { lazy, Suspense, useCallback, useSyncExternalStore } from "react";

const Panel = lazy(() => import("./DesignCraftPanel.tsx"));
const stages = new Map<string, string | null>(), listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
function set(key: string, stage: string | null) { stages.set(key, stage); for (const listener of listeners) listener(); }

/** Optional reading state is scoped to identity/request and survives responsive task remounts. */
export function DesignCraftButton({ canvasId, requestId, actorId }: { canvasId: string; requestId: string; actorId: string | null }) {
  const key = JSON.stringify([canvasId, requestId, actorId]);
  const get = useCallback(() => stages.get(key) ?? null, [key]);
  const stage = useSyncExternalStore(subscribe, get, get);
  return <section><button type="button" className="btn secondary" data-design-craft-entry={requestId} aria-expanded={stage !== null} onClick={() => set(key, stage === null ? "new-work" : null)}>{stage === null ? "Optional craft guidance" : "Close craft guidance"}</button>
    {stage !== null && <Suspense fallback={<p role="status">Opening saved craft context…</p>}><Panel key={key + stage} canvasId={canvasId} requestId={requestId} scopeKey={key} stage={stage} select={value => set(key, value)} /></Suspense>}
  </section>;
}
