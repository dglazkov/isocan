import { lazy, Suspense, useEffect, useState, type ComponentProps } from "react";
import { useUiStore } from "../stores/uiStore.ts";

const Tray = lazy(() => import("./AgentTray.tsx").then((module) => ({ default: module.AgentTray })));

/** Load the Agents panel on first opening, then keep it — and the row it had open — while it is closed. */
export function AgentTray(props: ComponentProps<typeof Tray>) {
  const open = useUiStore((state) => state.agentsPanelOpen);
  const [opened, setOpened] = useState(open);
  useEffect(() => { if (open) setOpened(true); }, [open]);
  return open || opened ? <Suspense fallback={null}><Tray {...props} /></Suspense> : null;
}
