import { lazy, Suspense, type ComponentProps } from "react";
import { usePhone } from "../lib/phone.ts";
import { useUiStore } from "../stores/uiStore.ts";

const Panel = lazy(() => import("./ContextPanel.tsx").then((module) => ({ default: module.ContextPanel })));

/** Read context only during inspection; closing unmounts any private response state. */
export function ContextPanel(props: ComponentProps<typeof Panel>) {
  const phone = usePhone();
  const open = useUiStore((state) => state.contextPanelOpen);
  return (!phone && open) || props.onClose ? <Suspense fallback={null}><Panel {...props} /></Suspense> : null;
}
