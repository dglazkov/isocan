import { lazy, Suspense, useEffect, useState, type ComponentProps } from "react";
import { useUiStore } from "../stores/uiStore.ts";

const Panel = lazy(() => import("./ContextPanel.tsx").then((module) => ({ default: module.ContextPanel })));

/** Read the context layers only after inspection is requested; retain loaded links on close. */
export function ContextPanel(props: ComponentProps<typeof Panel>) {
  const open = useUiStore((state) => state.contextPanelOpen);
  const [opened, setOpened] = useState(open);
  useEffect(() => { if (open) setOpened(true); }, [open]);
  return open || opened ? <Suspense fallback={null}><Panel {...props} /></Suspense> : null;
}
