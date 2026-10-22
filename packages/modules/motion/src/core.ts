import type { CoreModule } from "@isocan/core";
import { MOTION_PROPS } from "@isocan/core/motion";

/**
 * **The record both surfaces register** (motion phase 0). A motion is an
 * ordinary HTML item, so the module owns no kind and no op — only the
 * property keys `isocan motion new` writes onto one
 * (`docs/projects/motion/design.md` §2). The web's doors (*Animate…*, the
 * scrubber, *Render movie…*) are phase 2's; until then the web half carries
 * this record alone, behind the `motion` experiment.
 */
export const motionModule: CoreModule = {
  name: "@isocan/motion",
  propertyKeys: Object.values(MOTION_PROPS),
};

export default motionModule;
