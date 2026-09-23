import type { CoreModule } from "@isocan/core";

/**
 * **The record both surfaces register** — and nothing else, on purpose.
 *
 * A screen is an ordinary HTML item, so the module adds no kind, no mime and
 * no property key yet: the canvas already knows how to draw everything it
 * makes. The record lives apart from `core.ts` so the web half can register
 * it without importing the catalog and the renderer, which a first visit to
 * the app has no use for (the entry chunk's budget, `scripts/bundle-ceiling.mjs`).
 */
export const wireframeModule: CoreModule = {
  name: "@isocan/wireframe",
};
