import type { CanvasSnapshotResponse } from "@isocan/core";
import type { Ctx } from "./ctx.ts";
import { automaticSourceClient, contextHome } from "./context-summary.ts";
import { readCanvasDesignAudit, type CanvasDesignAudit, type DesignAuditOptions, type DesignAuditReadPort } from "./design-audit-reader.ts";

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
