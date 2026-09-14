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

/** An explicit repair waits for the home's acceptance; an offline queue keeps the draft and its pending notice. */
export async function saveDesignRepair(canvasId: string, actor: import("@isocan/core").Actor, options: Omit<import("@isocan/api/design-audit").DesignRepairRequest, "canvasId"> & { onQueued?: () => void }): Promise<import("@isocan/api/design-audit").DesignRepairResult> {
  const { repairDesignScreen } = await import("@isocan/api/design-audit");
  const { uploadBlob } = await import("./api.ts");
  const { sendEchoedResult } = await import("../stores/canvasStore.ts");
  const { creationDestination } = await import("./groupplacement.ts");
  const { originGroupMode } = creationDestination();
  const { onQueued, ...request } = options;
  return repairDesignScreen({
    ...designAuditIO,
    snapshot: getSnapshot,
    home: authoritativeHome,
    upload: async (id, text, filename, signal) => {
      signal?.throwIfAborted();
      const result = await uploadBlob(id, new Blob([text], { type: "text/html" }), filename);
      signal?.throwIfAborted();
      return result;
    },
    edit: async (id, operation, signal) => {
      signal?.throwIfAborted();
      const receipt = await sendEchoedResult(id, actor, operation, undefined, originGroupMode);
      if (receipt.status === "accepted") return { accepted: true };
      if (receipt.status === "refused") return { accepted: false, status: "refused", reason: receipt.message ?? "The home refused this repair." };
      onQueued?.();
      if (!receipt.completion) return { accepted: false, status: "pending", reason: "The repair is queued without a confirmed receipt. Check the saved versions before retrying." };
      const outcome = await receipt.completion;
      return outcome.status === "accepted" ? { accepted: true } : { accepted: false, status: "refused", reason: outcome.message ?? "The home refused the queued repair." };
    },
  }, { ...request, canvasId });
}
