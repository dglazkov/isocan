import type { CanvasSnapshotResponse, ContextExtras, ContextLayer, LinkedCanvas } from "../../core/src/index.js";
import type { Ctx } from "./ctx.js";
import { DaemonClient } from "./client.js";
/** Personal inclusion is deliberate; ambient resources retain the existing shared-only default. */
export interface ContextSummaryOptions {
    personal?: "exclude" | {
        actorId: string;
    };
    signal?: AbortSignal;
}
/** Resolve authoritative context home, preserving a policy-scoped handle's already asserted authority. */
export declare function contextHome(ctx: Ctx, canvasId: string): Promise<string>;
/** Reassert automatic-source policy on every transport read, including version blobs. */
export declare function automaticSourceClient(ctx: Ctx, expectedHome: string, signal?: AbortSignal): DaemonClient;
/** Fetch only ordinary inherited sources after classification; private sources cannot govern designs. */
export declare function linkedCanvasesOf(ctx: Ctx, canvasId: string, snapshot: Pick<CanvasSnapshotResponse, "canvas">): Promise<LinkedCanvas[]>;
/** Node adapts transport and bytes; the browser-safe reader owns the layered Context assembly. */
export declare function readContextSummary(ctx: Ctx, canvasId: string, extras?: ContextExtras, options?: ContextSummaryOptions): Promise<ContextLayer[]>;
