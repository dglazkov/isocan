import type { Actor, CanvasContents, CanvasSnapshotResponse } from "@isocan/core";
import { readCanvasDesignAudit, type CanvasDesignAudit, type DesignAuditOptions, type DesignAuditReadPort } from "@isocan/api/design-audit";
import type { PreparedDesignRepair, PreparedDesignRepairPort } from "@isocan/api/design-repair";
import { designRepairsRoute } from "@isocan/core/design-repair";
import { questionnaireFailureStatus } from "@isocan/api/questionnaire";
import { ApiError, getSnapshot, postOp, readBlobText, request, uploadBlob } from "./api.ts";
import { authoritativeHome, personalApi, sourceSnapshot, sourceText } from "./personal.ts";
import { creationDestination } from "./groupplacement.ts";
import { canEditNow } from "./capability.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";

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

/** Repairs preserve exact caller intent and use canonical receipts; optimistic versions prove no acceptance. */
export function designRepairIO(actor: Actor): PreparedDesignRepairPort {
  return {
    ...designAuditIO,
    actorId: actor.id,
    snapshot: getSnapshot,
    home: authoritativeHome,
    repairs: (canvasId, signal) => request("GET", designRepairsRoute(canvasId), undefined, signal),
    upload: async (id, text, filename, signal) => {
      signal?.throwIfAborted();
      const result = await uploadBlob(id, new Blob([text], { type: "text/html" }), filename, { signal });
      signal?.throwIfAborted();
      return result;
    },
    sendRepair: async (canvasId, operation, options) => {
      const current = useCanvasStore.getState();
      if (current.canvasId !== canvasId || current.past || !canEditNow()) return { status: "refused", reason: "Return to this current editable canvas before saving its repair." };
      try {
        options.signal?.throwIfAborted();
        const receipt = await postOp(canvasId, actor, operation, options.opId, undefined, creationDestination().originGroupMode);
        return { status: "accepted", receipt };
      } catch (error) {
        return { status: questionnaireFailureStatus(error), reason: error instanceof Error ? error.message : "The repair was not confirmed.", ...(error instanceof ApiError && error.code ? { code: error.code } : {}) };
      }
    },
  };
}

/** The editor's opening snapshot supplies its original target; inherited reads retain their normal policy. */
export async function captureDesignAuditRepair(canvasId: string, itemId: string, opened: CanvasSnapshotResponse, signal?: AbortSignal) {
  const { captureDesignRepair } = await import("@isocan/api/design-repair");
  return captureDesignRepair({ ...designAuditIO, snapshot: async () => opened, home: authoritativeHome }, { canvasId, itemId, ...(signal ? { signal } : {}) });
}

/** Sending is separate from preparation and acknowledged local storage so every retry keeps the same identity. */
export async function saveDesignRepair(actor: Actor, prepared: PreparedDesignRepair, retry = false, signal?: AbortSignal) {
  const { submitDesignRepair } = await import("@isocan/api/design-repair");
  return submitDesignRepair(designRepairIO(actor), prepared, { retry, ...(signal ? { signal } : {}) });
}
