import { Suspense, lazy, type ComponentType } from "react";
import type {
  FocusFacts,
  InspectorFacts,
  Item,
  ItemVersion,
  ModuleFocus,
  PageFacts,
  RendererFacts,
  UnderlayFacts,
  WebModule,
} from "@isocan/core";
import { documentsModule, isDocumentItem } from "./core.ts";

/**
 * **The documents module's web half**: the outline beside the stage, a
 * Documents page, and the View/Edit focus studio. The components sit behind
 * a lazy boundary (`focus.tsx`) so first paint on a canvas pays only for the
 * module record and its focus matcher (`docs/projects/modules/design.md`).
 */

const LazyDocumentOutline = lazy(() =>
  import("./focus.tsx").then((m) => ({ default: m.DocumentOutline })),
);
const LazyDocumentsPage = lazy(() =>
  import("./focus.tsx").then((m) => ({ default: m.DocumentsPage })),
);
const LazyDocumentFocusView = lazy(() =>
  import("./focus.tsx").then((m) => ({ default: m.DocumentFocusView })),
);
const LazyDocumentFocusEdit = lazy(() =>
  import("./focus.tsx").then((m) => ({ default: m.DocumentFocusEdit })),
);

function DocumentOutline(facts: InspectorFacts) {
  return (
    <Suspense fallback={null}>
      <LazyDocumentOutline {...facts} />
    </Suspense>
  );
}

function DocumentsPage(facts: PageFacts) {
  return (
    <Suspense fallback={null}>
      <LazyDocumentsPage {...facts} />
    </Suspense>
  );
}

function DocumentFocusView(facts: FocusFacts) {
  return (
    <Suspense fallback={<div className="page-note">Reading document…</div>}>
      <LazyDocumentFocusView {...facts} />
    </Suspense>
  );
}

function DocumentFocusEdit(facts: FocusFacts) {
  return (
    <Suspense fallback={<div className="page-note">Loading document studio…</div>}>
      <LazyDocumentFocusEdit {...facts} />
    </Suspense>
  );
}

export function isDocumentsFocusMatch(item: Item, version: ItemVersion): boolean {
  return (
    isDocumentItem(item) &&
    (version.mimeType === "text/markdown" || version.mimeType === "text/plain")
  );
}

export const documentsFocusFacet: ModuleFocus<
  ComponentType<FocusFacts>,
  ComponentType<FocusFacts>
> = {
  id: "module.documents",
  priority: 15,
  matches: isDocumentsFocusMatch,
  view: DocumentFocusView,
  edit: DocumentFocusEdit,
  agentPrompts: [
    { label: "Tighten prose", prompt: "Edit this document for clarity, conciseness, and scannable headings." },
    { label: "Executive summary", prompt: "Add a crisp executive summary of key decisions at the top." },
  ],
};

export const documentsWeb: WebModule<
  ComponentType<UnderlayFacts>,
  ComponentType<RendererFacts>,
  ComponentType<InspectorFacts>,
  ComponentType<PageFacts>,
  never,
  never,
  never,
  never,
  ComponentType<FocusFacts>
> = {
  core: documentsModule,
  inspectors: [{ kinds: ["document"], label: "Outline", component: DocumentOutline }],
  pages: [{ segment: "docs", label: "Documents", hint: "every document on this canvas, with its shape", component: DocumentsPage }],
  focus: [documentsFocusFacet],
};

export default documentsWeb;
