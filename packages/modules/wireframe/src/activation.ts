import type { CanvasContents } from "@isocan/core";
import { KEEP_PROP, MAYBE_PROP, wireframeModule } from "./record.ts";

/**
 * **What the web registers before the module's web half is fetched** (phase
 * 5) — the record (with `/wire`'s menu row), the dialog's id and title, and
 * the arrows' predicate. The composer, the renderer and the catalog arrive
 * only when a person types `/wire` or a canvas has two kept screens to join:
 * `packages/web/src/modules.ts` hands this to `deferredModule`.
 */
export const wireframeActivation = {
  core: wireframeModule,
  dialogs: [{ id: "wire", title: "Wireframes" }],
  // Arrows run between kept screens, and a maybe is marked until it is kept: a canvas with fewer than two kept and no unkept maybe fetches nothing.
  underlays: [{ needed: (canvas: CanvasContents) => {
    const all = Object.values(canvas.items).map((i) => i.properties ?? {});
    return all.filter((p) => p[KEEP_PROP]).length > 1 || all.some((p) => p[MAYBE_PROP] && !p[KEEP_PROP]);
  } }],
};
