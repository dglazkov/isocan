import { lazy, Suspense, useEffect, useState, type ComponentProps } from "react";
import { useUiStore } from "../stores/uiStore.ts";

const Panel = lazy(() => import("./TrashPanel.tsx").then((module) => ({ default: module.TrashPanel })));

/** Load Trash on first inspection, then retain its queued restore while it is closed. */
export function TrashPanel(props: ComponentProps<typeof Panel>) {
  const open = useUiStore((state) => state.trashOpen);
  const [opened, setOpened] = useState(open);
  useEffect(() => { if (open) setOpened(true); }, [open]);
  return open || opened ? <Suspense fallback={null}><Panel {...props} /></Suspense> : null;
}
