import { lazy, Suspense, useEffect, useState, type ComponentProps } from "react";
import { useUiStore } from "../stores/uiStore.ts";

const Panel = lazy(() => import("./FilesPanel.tsx").then((module) => ({ default: module.FilesPanel })));

/** Load the Files panel on first opening, then keep it — and its filter — while it is closed. */
export function FilesPanel(props: ComponentProps<typeof Panel>) {
  const open = useUiStore((state) => state.filesPanelOpen);
  const [opened, setOpened] = useState(open);
  useEffect(() => { if (open) setOpened(true); }, [open]);
  return open || opened ? <Suspense fallback={null}><Panel {...props} /></Suspense> : null;
}
