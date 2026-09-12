import {
  lazy,
  Suspense,
  useId,
  type ComponentType,
  type ReactNode,
} from "react";
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
  projectEdges,
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
function Edges({ canvas, drag }: UnderlayFacts) {
  const marker = useId();
  const edges = projectsOn(canvas).flatMap((p) => projectEdges(canvas, p.id));
  if (!edges.length) return null;
  const at = (item: (typeof edges)[number]["from"]) => ({
    x:
      item.x + item.width / 2 + (drag?.itemIds.includes(item.id) ? drag.dx : 0),
    y:
      item.y +
      item.height / 2 +
      (drag?.itemIds.includes(item.id) ? drag.dy : 0),
  });
  return (
    <svg
      style={{
        position: "absolute",
        overflow: "visible",
        pointerEvents: "none",
        width: 1,
        height: 1,
      }}
      aria-hidden
    >
      <defs>
        <marker
          id={marker}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--ink-soft)" />
        </marker>
      </defs>
      {edges.map((e, index) => {
        const a = at(e.from),
          b = at(e.to);
        const dx = b.x - a.x,
          dy = b.y - a.y;
        const start = Math.min(
          e.from.width / 2 / (Math.abs(dx) || 1),
          e.from.height / 2 / (Math.abs(dy) || 1),
        );
        const end = Math.min(
          e.to.width / 2 / (Math.abs(dx) || 1),
          e.to.height / 2 / (Math.abs(dy) || 1),
        );
        a.x += dx * start;
        a.y += dy * start;
        b.x -= dx * end;
        b.y -= dy * end;
        return (
          <g key={`${e.from.id}:${e.to.id}:${index}`}>
            <path
              d={`M ${a.x} ${a.y} C ${(a.x + b.x) / 2} ${a.y}, ${(a.x + b.x) / 2} ${b.y}, ${b.x} ${b.y}`}
              fill="none"
              stroke="var(--ink-soft)"
              strokeOpacity=".4"
              strokeWidth="2"
              markerEnd={`url(#${marker})`}
              strokeDasharray={e.coupling === "loose" ? "6 5" : undefined}
            />
            {e.label && (
              <text
                x={(a.x + b.x) / 2}
                y={(a.y + b.y) / 2 - 8}
                fill="var(--ink-soft)"
                fontSize="12"
                textAnchor="middle"
              >
                {e.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
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
    },
  ],
};
export default anatomyWeb;
