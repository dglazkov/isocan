import { type CanvasSnapshotResponse, type ContextExtras, type ContextLayer, type LinkedCanvas } from "../../core/src/index.js";
import type { Ctx } from "./ctx.js";
/** Fetch inherited sources once, preserving every unavailable layer and its refusal. */
export declare function linkedCanvasesOf(ctx: Ctx, canvasId: string, snapshot: Pick<CanvasSnapshotResponse, "canvas">): Promise<LinkedCanvas[]>;
/** The live layered Context view; machine extras are supplied only by the process that knows them. */
export declare function readContextSummary(ctx: Ctx, canvasId: string, extras?: ContextExtras): Promise<ContextLayer[]>;
