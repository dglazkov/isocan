import type { WebModule } from "@isocan/core";
import { wireframeModule } from "./record.ts";

/**
 * **The web half, empty on purpose.** A screen is an HTML item, which the app
 * already draws; phase 0 needs nothing more from this surface. The record is
 * registered so the module is in both lists (`test/modules.test.ts`) and a
 * later phase's slots — the keep mark, the link lines — have somewhere to go.
 * It imports the record and not `core.ts`, so the catalog and the renderer
 * stay out of the entry chunk.
 */
export const wireframeWeb: WebModule<never> = {
  core: wireframeModule,
};

export default wireframeWeb;
