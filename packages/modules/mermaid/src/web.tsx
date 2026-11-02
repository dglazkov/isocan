import { Suspense, lazy, type ComponentType } from "react";
import type {
  FocusFacts,
  Item,
  ItemVersion,
  ModuleFocus,
  RendererFacts,
  UnderlayFacts,
  WebModule,
} from "@isocan/core";
import { MERMAID_MIME, mermaidModule } from "./core.ts";

/**
 * **The renderer and focus studio, behind lazy boundaries.** The Mermaid
 * library is large — larger than the app — and a canvas with no diagram on it
 * must not pay for it (`diagram.tsx`). Likewise `focus.tsx` arrives only when
 * someone enters View or Edit focus on a diagram; this file is what the
 * shell's list imports at boot, and it costs a few lines.
 */
const Diagram = lazy(() => import("./diagram.tsx"));
const LazyMermaidFocusView = lazy(() =>
  import("./focus.tsx").then((m) => ({ default: m.MermaidFocusView })),
);
const LazyMermaidFocusEdit = lazy(() =>
  import("./focus.tsx").then((m) => ({ default: m.MermaidFocusEdit })),
);

function DiagramView(facts: RendererFacts) {
  return (
    <Suspense fallback={<div className="file-view">{facts.filename}</div>}>
      <Diagram {...facts} />
    </Suspense>
  );
}

function MermaidFocusView(facts: FocusFacts) {
  return (
    <Suspense fallback={<div className="page-note">Loading diagram…</div>}>
      <LazyMermaidFocusView {...facts} />
    </Suspense>
  );
}

function MermaidFocusEdit(facts: FocusFacts) {
  return (
    <Suspense fallback={<div className="page-note">Loading diagram studio…</div>}>
      <LazyMermaidFocusEdit {...facts} />
    </Suspense>
  );
}

export function isMermaidFocusMatch(_item: Item, version: ItemVersion): boolean {
  return version.mimeType === MERMAID_MIME;
}

export const mermaidFocusFacet: ModuleFocus<
  ComponentType<FocusFacts>,
  ComponentType<FocusFacts>
> = {
  id: "module.mermaid",
  priority: 15,
  matches: isMermaidFocusMatch,
  view: MermaidFocusView,
  edit: MermaidFocusEdit,
  agentPrompts: [
    { label: "Clarify flow", prompt: "Simplify and reorganize this Mermaid diagram for clearer flow." },
    { label: "Add error path", prompt: "Add error-handling and retry branches to this diagram." },
  ],
};

export const mermaidWeb: WebModule<
  ComponentType<UnderlayFacts>,
  ComponentType<RendererFacts>,
  never,
  never,
  never,
  never,
  never,
  never,
  ComponentType<FocusFacts>
> = {
  core: mermaidModule,
  renderers: [{ mimes: [MERMAID_MIME], component: DiagramView }],
  focus: [mermaidFocusFacet],
};

export default mermaidWeb;
