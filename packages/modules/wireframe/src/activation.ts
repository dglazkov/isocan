import type { CanvasContents, Item, ItemVersion } from "@isocan/core";
import { wireframeModule } from "./record.ts";

/**
 * **What the web registers before the module's web half is fetched** (phase
 * 5) — the record (with `/wire`'s menu row), the dialog's id and title, and
 * the arrows' predicate. The composer, the renderer and the catalog arrive
 * only when a person types `/wire` or a canvas has wires on it:
 * `packages/web/src/modules.ts` hands this to `deferredModule`.
 */
export const wireframeActivation = {
  core: wireframeModule,
  dialogs: [{ id: "wire", title: "Wireframes" }],
  // Fetched wherever a wire is — a screen, a variation, a prototype all carry `fidelity: wireframe`: the arrows, the
  // maybe marks, the keep mark's `follow` (the prototype re-versioning on ⇧K) and a wire's Style ▸ menu all live in
  // the lazy half, and the menu must be there before anybody right-clicks (24 Sep 2026). A canvas with no wire
  // fetches nothing. First paint's, so it is written small.
  underlays: [{ needed: (canvas: CanvasContents) => Object.values(canvas.items).some((i) => i.properties?.fidelity === "wireframe") }],
  focus: [{
    id: "module.wireframe",
    priority: 20,
    matches: (item: Item, version: ItemVersion) =>
      item.properties?.fidelity === "wireframe" &&
      item.properties?.wirePrototype === undefined &&
      version.mimeType === "text/html",
    hasView: true,
    hasEdit: true,
    agentPrompts: [
      { label: "Swap section", prompt: "Replace the selected wireframe slot with a clearer catalog block." },
      { label: "Tighten copy", prompt: "Rewrite the wireframe copy so every CTA and heading is specific." },
      { label: "Polish hierarchy", prompt: "Apply visual polish tokens to emphasize the primary call-to-action." },
    ],
  }],
};
