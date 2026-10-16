import type { CoreModule } from "@isocan/core";
import { MOOD_PROPS } from "@isocan/core/mood";

/**
 * **The record both surfaces register** (moodboard phase 0). A tile is an
 * ordinary image item, so the module owns no kind — only the provenance keys
 * the home writes onto each one (`docs/projects/moodboard/design.md` §1).
 * The route, the template and the deny-list are product code in
 * `@isocan/core/mood` and the server, because a module may add no route.
 */
export const moodModule: CoreModule = {
  name: "@isocan/mood",
  propertyKeys: Object.values(MOOD_PROPS),
};

export default moodModule;
