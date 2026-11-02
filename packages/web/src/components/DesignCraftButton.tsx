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
