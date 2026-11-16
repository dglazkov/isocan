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
import type { Actor } from "@isocan/core";

const DesignReviewPanel = lazy(() => import("./DesignReviewPanel.tsx").then(module => ({ default: module.DesignReviewPanel })));
type ReviewNavigation = { open: boolean; selected: string | null };
const closed: ReviewNavigation = { open: false, selected: null };
const navigation = new Map<string, ReviewNavigation>();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
function remember(key: string, next: ReviewNavigation) {
  const prior = navigation.get(key) ?? closed;
  if (prior.open === next.open && prior.selected === next.selected) return;
  navigation.set(key, next); for (const listener of listeners) listener();
}

/** Scoped reading intent survives responsive chat remounts; it contains no evidence or authority. */
export function DesignReviewButton({ canvasId, actor, requestId, threadId, canEdit }: { canvasId: string; actor: Actor | null; requestId: string; threadId: string | undefined; canEdit: boolean }) {
  const key = JSON.stringify([canvasId, actor?.id ?? null, requestId]);
  const get = useCallback(() => navigation.get(key) ?? closed, [key]);
  const state = useSyncExternalStore(subscribe, get, get);
  const select = useCallback((runId: string) => { const prior = navigation.get(key) ?? closed; remember(key, { ...prior, selected: runId }); }, [key]);
  return <section className="design-task-review">
    <button type="button" className="btn secondary" data-design-review-entry={requestId} aria-expanded={state.open} onClick={() => remember(key, { ...state, open: !state.open })}>{state.open ? "Close review" : "Review and checks"}</button>
    {state.open && <Suspense fallback={<p role="status">Opening the saved review…</p>}><DesignReviewPanel key={key} canvasId={canvasId} actor={actor} requestId={requestId} threadId={threadId} canEdit={canEdit} selected={state.selected} select={select} /></Suspense>}
  </section>;
}
