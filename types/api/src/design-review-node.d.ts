import type { Ctx } from "./ctx.js";
import type { DesignReviewWritePort } from "./design-review-write.js";
import type { PreparedDesignRepairPort } from "./design-repair-reader.js";
/** Native review uses existing authenticated routes, archived history, real presence and wake policy. */
export declare function designReviewPort(ctx: Ctx): DesignReviewWritePort & PreparedDesignRepairPort;
