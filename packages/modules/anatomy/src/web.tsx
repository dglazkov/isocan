import { lazy, Suspense, type ComponentType, type ReactNode } from "react";
import type {
  InspectorFacts,
  OverlayFacts,
  PageFacts,
  RendererFacts,
  UnderlayFacts,
  WebModule,
  WorkspaceFacts,
} from "@isocan/core";
import {
  anatomyModule,
  PROJECT_MIME,
  NODE_MIME,
  CHECKPOINT_MIME,
  projectsOn,
  PROP,
} from "./manifest.ts";

const Workspace = lazy(() => import("./workspace.tsx"));
const Card = lazy(() => import("./card.tsx"));
function Render(props: RendererFacts) {
  return (
    <Suspense fallback={<div>Loading concept…</div>}>
      <Card {...props} />
    </Suspense>
  );
}
const LazyEdges = lazy(() => import("./edges.tsx"));
function Edges(props: UnderlayFacts) {
  if (!projectsOn(props.canvas).length) return null;
  return (
    <Suspense fallback={null}>
      <LazyEdges {...props} />
    </Suspense>
  );
}
export const anatomyWeb: WebModule<
  ComponentType<UnderlayFacts>,
  ComponentType<RendererFacts>,
  ComponentType<InspectorFacts>,
  ComponentType<PageFacts>,
  ComponentType<OverlayFacts>,
  ComponentType<WorkspaceFacts<ReactNode>>
> = {
  core: anatomyModule,
  underlays: [Edges],
  renderers: [
    { mimes: [PROJECT_MIME, NODE_MIME, CHECKPOINT_MIME], component: Render },
  ],
  workspaces: [
    {
      segment: "anatomy",
      label: "Anatomy",
      hint: "Explore concepts, decisions and evidence",
      cli: "anatomy show",
      component: Workspace,
      projectEntry: ({ project, canvas }) => {
        const hasAnalysis = projectsOn(canvas).length > 0;
        return hasAnalysis ||
          project.properties[PROP.repository] ||
          project.properties.repository
          ? {
              label: hasAnalysis ? "View Anatomy" : "Analyze repository",
              glyph: "◈",
            }
          : null;
      },
    },
  ],
};
export default anatomyWeb;
