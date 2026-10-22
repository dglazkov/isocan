import type { WebModule } from "@isocan/core";
import { motionModule } from "./core.ts";

/**
 * **The web half, record only** (motion phase 0). A motion item plays in the
 * web already — it is an HTML item, and HTML items play — so phase 0 adds no
 * slot: registering the record behind the `motion` experiment is what keeps
 * the two module lists in step (`test/modules.test.ts`). *Animate…*, the
 * scrubber and *Render movie…* arrive in phase 2.
 */
export const motionWeb: WebModule<never> = {
  core: motionModule,
};

export default motionWeb;
