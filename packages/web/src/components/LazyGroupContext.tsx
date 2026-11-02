import { lazy, Suspense, type ComponentProps } from "react";

const Manifest = lazy(() => import("./GroupContext.tsx").then((module) => ({ default: module.ContextManifestView })));
const Inspection = lazy(() => import("./GroupContext.tsx").then((module) => ({ default: module.LiveContextInspection })));
const Preview = lazy(() => import("./GroupContext.tsx").then((module) => ({ default: module.MessageContextPreview })));
const fallback = <p role="status">Loading context…</p>;

/** Frozen disclosure is downloaded only when a message actually carries it. */
export function ContextManifestView(props: ComponentProps<typeof Manifest>) {
  return <Suspense fallback={fallback}><Manifest {...props} /></Suspense>;
}

/** Inspection belongs to an opened panel, outside the canvas entry budget. */
export function LiveContextInspection(props: ComponentProps<typeof Inspection>) {
  return <Suspense fallback={fallback}><Inspection {...props} /></Suspense>;
}

/** Ordinary drafts must not load the group disclosure merely by mounting a composer. */
export function MessageContextPreview(props: ComponentProps<typeof Preview>) {
  return props.context.enabled ? <Suspense fallback={fallback}><Preview {...props} /></Suspense> : null;
}
