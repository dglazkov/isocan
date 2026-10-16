import type { WebModule } from "@isocan/core";
import { moodModule } from "./core.ts";

/**
 * **The web half is the record and nothing else**, for moodboard phase 0:
 * tiles are ordinary images the canvas already draws, and the tray, keep and
 * drop arrive in phase 1. Here because a module lives in both lists or
 * neither (`test/modules.test.ts`), and fetched only when the `moodboard`
 * experiment is on.
 */
export const moodWeb: WebModule<never> = { core: moodModule };

export default moodWeb;
