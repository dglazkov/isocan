import type { WebModule } from "@isocan/core";
import { judgeModule } from "./record.ts";

/**
 * **The web half is the record and nothing else**, on purpose. The corpus
 * reader writes to no canvas and draws nothing; it is a terminal act by the
 * person whose verdicts it reads (`isocan judge corpus`). The record is here
 * because a module lives in both lists or neither (`test/modules.test.ts`),
 * and it is the size of a name — no slot, no chunk, nothing first paint pays
 * for beyond the record itself.
 */
export const judgeWeb: WebModule<never> = { core: judgeModule };

export default judgeWeb;
