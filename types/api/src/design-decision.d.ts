import type { Ctx } from "./ctx.js";
import type { DesignDecisionWritePort } from "./design-decision-reader.js";
/** Node retains the existing canvas grants, actor custody and source policies on comparison reads and writes. */
export declare function designDecisionPort(ctx: Ctx): DesignDecisionWritePort;
