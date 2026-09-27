import { lazy, Suspense, type ComponentProps } from "react";

const Presentation = lazy(() => import("./Viewer.tsx").then((module) => ({ default: module.Viewer })));

/**
 * The presentation a `view` admission gets, loaded when that is the answer.
 *
 * Both places that render it have already waited on the home — `ViewerGate`
 * on its snapshot GET, `CanvasPage` on the canvas it connected to — so the
 * chunk arrives inside a beat that was happening anyway, and the editors who
 * are nearly every visit stop paying for a face they never see.
 */
export function Viewer(props: ComponentProps<typeof Presentation>) {
  return <Suspense fallback={null}><Presentation {...props} /></Suspense>;
}
