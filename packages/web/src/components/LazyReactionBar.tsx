import { lazy, Suspense, useEffect, useState, type ComponentProps } from "react";
import { useUiStore } from "../stores/uiStore.ts";

const KEY = (canvasId: string) => `isocan.reactions.${canvasId}`;

export function openReactionBar(canvasId: string, open: boolean): void {
  try {
    if (open) localStorage.setItem(KEY(canvasId), "1");
    else localStorage.removeItem(KEY(canvasId));
  } catch {
    // Storage denied: the choice holds for this session and no longer.
  }
  useUiStore.getState().setMarksOpen(open);
}

export function restoreReactionBar(canvasId: string): void {
  try {
    useUiStore.getState().setMarksOpen(localStorage.getItem(KEY(canvasId)) === "1");
  } catch {
    useUiStore.getState().setMarksOpen(false);
  }
}

const Bar = lazy(() => import("./ReactionBar.tsx").then((m) => ({ default: m.ReactionBar })));

/** Load the Reactions board on first opening, keeping it warm once opened. */
export function ReactionBar(props: ComponentProps<typeof Bar>) {
  const open = useUiStore((s) => s.marksOpen);
  const [opened, setOpened] = useState(open);
  useEffect(() => {
    if (open) setOpened(true);
  }, [open]);
  return open || opened ? (
    <Suspense fallback={null}>
      <Bar {...props} />
    </Suspense>
  ) : null;
}
