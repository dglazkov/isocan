import { lazy, Suspense, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { create } from "zustand";
import type { Actor, DesignQuestionSource } from "@isocan/core";
import type { DesignComparisonFilter } from "@isocan/api/design-decision";

const Dialog = lazy(() => import("./DesignComparisonDialog.tsx").then((module) => ({ default: module.DesignComparisonDialog })));
type ComparisonEntrance = { canvasId: string; actor: Actor; filter: DesignComparisonFilter; source?: DesignQuestionSource | undefined };
const useComparisonEntrance = create<{ opened: ComparisonEntrance | null }>(() => ({ opened: null }));
/** Buttons describe intent only: responsive chat/task parents do not own the running prototype's lifetime. */
export function DesignComparisonButton({ canvasId, actor, filter, source, children = "Compare options" }: ComparisonEntrance & { children?: string }) {
  return <button className="btn secondary" data-comparison-entry={JSON.stringify([canvasId, actor.id, filter, source])} onClick={() => useComparisonEntrance.setState({ opened: { canvasId, actor, filter, source } })}>{children}</button>;
}
/** One stable canvas-page host preserves active frames across phone/desktop layout changes, but never across actor/canvas boundaries. */
export function DesignComparisonHost({ canvasId, actor }: { canvasId: string; actor: Actor }) {
  const opened = useComparisonEntrance((state) => state.opened);
  const close = useCallback(() => useComparisonEntrance.setState({ opened: null }), []);
  useEffect(() => { if (opened && (opened.canvasId !== canvasId || opened.actor.id !== actor.id)) close(); }, [canvasId, actor.id, opened, close]);
  useEffect(() => () => { useComparisonEntrance.setState({ opened: null }); }, []);
  if (!opened || opened.canvasId !== canvasId || opened.actor.id !== actor.id) return null;
  return createPortal(<Suspense fallback={<p role="status">Opening comparison…</p>}><Dialog key={JSON.stringify([canvasId, actor.id, opened.filter, opened.source])} canvasId={canvasId} actor={actor} filter={opened.filter} initialSource={opened.source} onClose={close} /></Suspense>, document.body);
}

/** This shallow scan reveals a recovery doorway only; the lazy recovery reader validates every saved field before any retry. */
export function hasSavedComparisonPending(canvasId: string, actorId: string, requestId: string): boolean {
  try {
    return Object.keys(localStorage).some((key) => {
      if (!key.startsWith("isocan.design.comparison.v1:") || key.includes(":archive:")) return false;
      try { const value = JSON.parse(localStorage.getItem(key) ?? "null"); return value?.canvasId === canvasId && value?.actorId === actorId && value?.comparison?.requestId === requestId && !!value?.pending; } catch { return false; }
    });
  } catch { return false; }
}
