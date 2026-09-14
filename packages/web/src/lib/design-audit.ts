import type { CanvasContents } from "@isocan/core";
import { readCanvasDesignAudit, type CanvasDesignAudit, type DesignAuditOptions, type DesignAuditReadPort } from "@isocan/api/design-audit";
import { getSnapshot, readBlobText } from "./api.ts";
import { authoritativeHome, personalApi, sourceSnapshot, sourceText } from "./personal.ts";

/** Browser reads use badge recovery; inherited snapshots and blobs also enforce source exclusion. */
export const designAuditIO: DesignAuditReadPort = {
  classifySource: personalApi.classifySource,
  sourceSnapshot,
  blobText: readBlobText,
  sourceBlobText: (source, hash, signal) => sourceText(source.canvasId, hash, source.expectedHome, signal),
};

/** Callers may use their current canvas snapshot; a report must be discarded when its inputs change. */
export async function readDesignAudit(canvasId: string, options: DesignAuditOptions = {}, captured?: CanvasContents): Promise<CanvasDesignAudit> {
  const canvas = captured ?? (await getSnapshot(canvasId, options.signal)).canvas;
  const home = await authoritativeHome(canvasId, options.signal);
  options.signal?.throwIfAborted();
  return readCanvasDesignAudit(designAuditIO, { ...options, canvasId, canvas, home });
}
