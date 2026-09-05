import { Suspense, lazy, type ComponentType } from "react";
import type { RendererFacts, UnderlayFacts, WebModule } from "@isocan/core";
import { MERMAID_MIME, mermaidModule } from "./core.ts";

/**
 * **The renderer, behind a lazy boundary.** The Mermaid library is large —
 * larger than the app — and a canvas with no diagram on it must not pay for
 * it. `diagram.tsx` is the far side of the boundary and is the only file
 * that imports the library; this one is what the shell's list imports at
 * boot, and it costs a few lines.
 */
const Diagram = lazy(() => import("./diagram.tsx"));

function DiagramView(facts: RendererFacts) {
  return (
    <Suspense fallback={<div className="file-view">{facts.filename}</div>}>
      <Diagram {...facts} />
    </Suspense>
  );
}

export const mermaidWeb: WebModule<ComponentType<UnderlayFacts>, ComponentType<RendererFacts>> = {
  core: mermaidModule,
  renderers: [{ mimes: [MERMAID_MIME], component: DiagramView }],
};
