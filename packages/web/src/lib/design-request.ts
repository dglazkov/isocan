import type { Actor } from "@isocan/core";
import { designRequestsRoute } from "@isocan/core/design-request";
import type { DesignRequestReadPort, DesignRequestWritePort } from "@isocan/api/design-request";
import { designAuditIO } from "./design-audit.ts";
import { getSnapshot, postOp, readBlob, request } from "./api.ts";
import { authoritativeHome, sourceBytes } from "./personal.ts";
import { creationDestination } from "./groupplacement.ts";
import { canEditNow } from "./capability.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";

/** Shared request readers retain the browser's badge recovery and automatic-source restrictions. */
export const designRequestReadIO: DesignRequestReadPort = {
  ...designAuditIO,
  snapshot: getSnapshot,
  home: authoritativeHome,
  requests: (canvasId, signal) => request("GET", designRequestsRoute(canvasId), undefined, signal),
  blobBytes: async (canvasId, hash, signal) => new Uint8Array(await (await readBlob(canvasId, hash, signal)).arrayBuffer()),
  sourceBlobBytes: (source, hash, signal) => sourceBytes(source.canvasId, hash, source.expectedHome, signal),
};

/** Lifecycle buttons send the saved canonical intent; the shared API determines receipt certainty. */
export function designRequestWriteIO(actor: Actor): DesignRequestWritePort {
  return {
    actorId: actor.id,
    snapshot: getSnapshot,
    send: async (canvasId, operation, options) => {
      const current = useCanvasStore.getState();
      if (current.canvasId === canvasId && (current.past || !canEditNow())) return { status: "refused", reason: "This view is read-only. Return to the current editable canvas before changing the task." };
      options.signal?.throwIfAborted();
      const receipt = await postOp(canvasId, actor, operation, options.opId, undefined, creationDestination().originGroupMode);
      return { status: "accepted", receipt };
    },
  };
}
