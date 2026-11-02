import { lazy, Suspense, useEffect, useState, type ComponentProps } from "react";
import { useUiStore } from "../stores/uiStore.ts";

const Panel = lazy(() => import("./ExtensionPanel.tsx").then((module) => ({ default: module.ExtensionPanel })));

/** Load the canvas extension panel dock on first opening, keeping it warm once opened. */
export function ExtensionPanel(props: ComponentProps<typeof Panel>) {
  const open = useUiStore((state) => state.extensionPanelOpen);
  const [opened, setOpened] = useState(open);
  useEffect(() => { if (open) setOpened(true); }, [open]);
  return open || opened ? <Suspense fallback={null}><Panel {...props} /></Suspense> : null;
}
