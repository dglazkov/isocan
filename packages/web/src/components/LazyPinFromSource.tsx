import { lazy, Suspense, type ComponentProps } from "react";

const Picker = lazy(() => import("./PinFromSource.tsx").then((module) => ({ default: module.PinFromSource })));

/** The picker and the copy act it drives arrive only on a canvas that actually
 *  inherits something, and only once Context is open — the eager half of a
 *  feature has to be a separate file from the lazy half
 *  (`scripts/bundle-ceiling.mjs`). */
export function PinFromSource(props: ComponentProps<typeof Picker>) {
  return <Suspense fallback={<p className="ctx-why">Loading…</p>}><Picker {...props} /></Suspense>;
}
