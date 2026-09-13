import { lazy, Suspense, useEffect, useState, type ComponentProps } from "react";
import { useUiStore } from "../stores/uiStore.ts";

const Panel = lazy(() => import("./PersonasPanel.tsx").then((module) => ({ default: module.PersonasPanel })));

/** Defer the file editor until first open, then preserve its draft and pending save while closed. */
export function PersonasPanel(props: ComponentProps<typeof Panel>) {
  const open = useUiStore((state) => state.personasPanelOpen);
  const [opened, setOpened] = useState(open);
  useEffect(() => { if (open) setOpened(true); }, [open]);
  return open || opened ? <Suspense fallback={null}><Panel {...props} /></Suspense> : null;
}
