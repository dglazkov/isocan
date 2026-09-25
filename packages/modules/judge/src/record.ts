import type { CoreModule } from "@isocan/core";

/**
 * **The record both surfaces register.** It owns no property keys, kinds,
 * marks or commands: the corpus reader writes nothing to any canvas. It lives
 * apart from `core.ts` so the web half registers a name and not the fold.
 */
export const judgeModule: CoreModule = {
  name: "@isocan/judge",
};
