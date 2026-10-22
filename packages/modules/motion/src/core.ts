import type { CoreModule } from "@isocan/core";
import { MOTION_PROPS } from "@isocan/core/motion";
import { RENDERED_FROM } from "@isocan/core/motion-render";

/**
 * **The record both surfaces register** (motion phase 0). A motion is an
 * ordinary HTML item, so the module owns no kind and no op — only the
 * property keys `isocan motion new` writes onto one
 * (`docs/projects/motion/design.md` §2), and since phase 1 the
 * `renderedFrom` a movie of it wears (an ordinary `video/mp4` item, §4).
 * The web's doors (*Animate…*, *Refresh from sources*, *Render movie…*,
 * phase 2) are the lazy half's, behind the `motion` experiment; a comment's
 * `at` is core's, on the comment, not this module's.
 */
export const motionModule: CoreModule = {
  name: "@isocan/motion",
  propertyKeys: [...Object.values(MOTION_PROPS), RENDERED_FROM],
};

export default motionModule;
