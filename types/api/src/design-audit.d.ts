import type { CanvasSnapshotResponse } from "../../core/src/index.js";
import type { Ctx } from "./ctx.js";
import { type CanvasDesignAudit, type DesignAuditOptions, type DesignAuditReadPort, type DesignRepairRequest, type DesignRepairResult } from "./design-audit-reader.js";
/** Node supplies bytes and the same authority-bearing client used for inherited Context. */
export declare function designAuditPort(ctx: Ctx): DesignAuditReadPort;
/** Audit a captured or fresh canvas using the caller's authority and immutable version blobs. */
export declare function readDesignAudit(ctx: Ctx, canvasId: string, options?: DesignAuditOptions, captured?: Pick<CanvasSnapshotResponse, "canvas">): Promise<CanvasDesignAudit>;
/** Node adapts conditional repair receipts; transport uncertainty cannot become a confirmed refusal. */
export declare function repairDesignItem(ctx: Ctx, request: DesignRepairRequest): Promise<DesignRepairResult>;
