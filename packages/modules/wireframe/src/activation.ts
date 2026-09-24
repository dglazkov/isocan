import type { CanvasContents } from "@isocan/core";
import { KEEP_PROP, MAYBE_PROP, wireframeModule } from "./record.ts";

/**
 * **What the web registers before the module's web half is fetched** (phase
 * 5) — the record (with `/wire`'s menu row), the dialog's id and title, and
 * the arrows' predicate. The composer, the renderer and the catalog arrive
 * only when a person types `/wire` or a canvas has wires a person has marked:
 * `packages/web/src/modules.ts` hands this to `deferredModule`.
 */
export const wireframeActivation = {
  core: wireframeModule,
  dialogs: [{ id: "wire", title: "Wireframes" }],
  // Fetched where a screen is in a prototype, a maybe is marked, or a prototype stands: the arrows, the maybe
  // marks, and the keep mark's `follow` (the prototype re-versioning on ⇧K) all live in the lazy half, so it must be
  // loaded wherever a keep can change a prototype (24 Sep 2026). A canvas with none of the three fetches nothing.
  // First paint's, so it is written small.
  underlays: [{ needed: (canvas: CanvasContents) => Object.values(canvas.items).some(({ properties: p = {} }) => p[KEEP_PROP] || p[MAYBE_PROP] || p.wirePrototype) }],
};
