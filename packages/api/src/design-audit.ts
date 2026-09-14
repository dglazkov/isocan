import type { CanvasSnapshotResponse } from "@isocan/core";
import type { Ctx } from "./ctx.ts";
import { automaticSourceClient, contextHome } from "./context-summary.ts";
import { readCanvasDesignAudit, repairDesignScreen, type CanvasDesignAudit, type DesignAuditOptions, type DesignAuditReadPort, type DesignRepairRequest, type DesignRepairResult } from "./design-audit-reader.ts";
import { ApiError } from "./routes.ts";

/** Node supplies bytes and the same authority-bearing client used for inherited Context. */
export function designAuditPort(ctx: Ctx): DesignAuditReadPort {
  return {
    classifySource: (source, signal) => ctx.client.classifySource(source, signal),
    sourceSnapshot: (source, signal) => automaticSourceClient(ctx, source.expectedHome, signal).snapshot(source.canvasId, signal),
    blobText: async (id, hash, signal) => (await ctx.client.downloadBlob(id, hash, signal)).toString("utf8"),
    sourceBlobText: async (source, hash, signal) => (await automaticSourceClient(ctx, source.expectedHome, signal).downloadBlob(source.canvasId, hash, signal)).toString("utf8"),
  };
}

/** Audit a captured or fresh canvas using the caller's authority and immutable version blobs. */
export async function readDesignAudit(ctx: Ctx, canvasId: string, options: DesignAuditOptions = {}, captured?: Pick<CanvasSnapshotResponse, "canvas">): Promise<CanvasDesignAudit> {
  const signal = options.signal ?? ctx.sourceContext?.signal;
  const snapshot = captured ?? await ctx.client.snapshot(canvasId, signal);
  signal?.throwIfAborted();
  return readCanvasDesignAudit(designAuditPort(ctx), {
    ...options, ...(signal ? { signal } : {}), canvasId, canvas: snapshot.canvas,
    home: await contextHome(ctx, canvasId),
  });
}

/** Node adapts conditional repair receipts; transport uncertainty cannot become a confirmed refusal. */
export async function repairDesignItem(ctx: Ctx, request: DesignRepairRequest): Promise<DesignRepairResult> {
  return repairDesignScreen({
    ...designAuditPort(ctx),
    snapshot: (id, signal) => ctx.client.snapshot(id, signal),
    home: (id) => contextHome(ctx, id),
    upload: (id, text, filename, signal) => ctx.client.uploadBlob(id, Buffer.from(text), "text/html", filename, signal),
    edit: async (id, operation, signal) => {
      try {
        signal?.throwIfAborted();
        await ctx.client.sendOp(id, ctx.actor, operation);
        return { accepted: true };
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        // The daemon reports validation, admission, missing-resource, conflict,
        // and incompatible-client refusals with these statuses. A timeout
        // (including an HTTP 408 from a proxy) is no receipt of non-acceptance.
        if (error instanceof ApiError && [400, 401, 403, 404, 405, 409, 410, 413, 415, 422, 426].includes(error.status)) return { accepted: false, status: "refused", reason };
        return { accepted: false, status: "pending", reason };
      }
    },
  }, request);
}
