import type { CanvasSnapshotResponse, ContextExtras, ContextLayer, LinkedCanvas } from "../../core/src/index.js";
import type { Ctx } from "./ctx.js";
/** Personal inclusion is deliberate; ambient resources retain the existing shared-only default. */
export interface ContextSummaryOptions {
    personal?: "exclude" | {
        actorId: string;
    };
    signal?: AbortSignal;
}
/** Fetch only ordinary inherited sources after classification; private sources cannot govern designs. */
export declare function linkedCanvasesOf(ctx: Ctx, canvasId: string, snapshot: Pick<CanvasSnapshotResponse, "canvas">): Promise<LinkedCanvas[]>;
/** Node adapts transport and bytes; the browser-safe reader owns the layered Context assembly. */
export declare function readContextSummary(ctx: Ctx, canvasId: string, extras?: ContextExtras, options?: ContextSummaryOptions): Promise<ContextLayer[]>;
