import { lazy, Suspense, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import type { Actor } from "@isocan/core";
import type { DesignSystemTarget } from "@isocan/api/design-system";
import { useUiStore } from "../stores/uiStore.ts";

const Dialog = lazy(() => import("./DesignSystemsDialog.tsx").then((module) => ({ default: module.DesignSystemsDialog })));

/** This small doorway captures the intended scope; large reference bodies load only after opening. */
export function DesignSystemsButton({ canvasId, actor, target, compact = false }: { canvasId: string; actor: Actor; target?: DesignSystemTarget | undefined; compact?: boolean }) {
  const [opened, setOpened] = useState<DesignSystemTarget | null>(null);
  const close = useCallback(() => setOpened(null), []);
  return <><button className={compact ? "tool-btn" : "btn secondary"} aria-label="Design system and references" title="Design system and references" onClick={() => {
    const state = useUiStore.getState();
    setOpened(target ?? (state.selectedItemIds.length === 1 ? { kind: "item", itemId: state.selectedItemIds[0]! } : state.activeGroupId ? { kind: "group", groupId: state.activeGroupId } : { kind: "canvas" }));
  }}>{compact ? <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" aria-hidden><path d="M3 3h6v6H3zM12 3h5v6h-5zM3 12h6v5H3z"/><circle cx="14.5" cy="14.5" r="2.5"/></svg> : "Design system & references…"}</button>{opened && createPortal(<Suspense fallback={null}><Dialog key={JSON.stringify([canvasId, actor.id])} canvasId={canvasId} actor={actor} initialTarget={opened} onClose={close} /></Suspense>, document.body)}</>;
}
