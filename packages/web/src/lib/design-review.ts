import type { Actor } from "@isocan/core";
import { designRepairsRoute } from "@isocan/core/design-repair";
import type { DesignReviewWritePort } from "@isocan/api/design-review";
import { questionnaireFailureStatus } from "@isocan/api/questionnaire";
import { designRequestReadIO } from "./design-request.ts";
import { ApiError, fetchRcAnswering, getArchivedOplog, getCurrentSessions, getOplog, postOp, request, uploadBlob } from "./api.ts";
import { canEditNow } from "./capability.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";

/** Shared review reads require complete history and real sessions; failed archive reads never replenish a budget. */
export function designReviewIO(actor: Actor | null): DesignReviewWritePort {
  return {
    ...designRequestReadIO,
    ...(actor ? { actorId: actor.id } : {}),
    // Both existing routes return their complete interval, without pagination.
    history: async (canvasId, signal) => {
      const [archive, live] = await Promise.all([getArchivedOplog(canvasId, { strict: true, ...(signal ? { signal } : {}) }), getOplog(canvasId, 0, signal)]);
      return [...archive, ...live];
    },
    repairs: (canvasId, signal) => request("GET", designRepairsRoute(canvasId), undefined, signal),
    sessions: getCurrentSessions,
    answering: fetchRcAnswering,
    uploadReview: (canvasId, text, filename, signal) => uploadBlob(canvasId, new Blob([text], { type: "application/json" }), filename, { signal }),
    sendReview: async (canvasId, operation, options) => {
      const current = useCanvasStore.getState();
      if (!actor || current.canvasId !== canvasId || current.past || !canEditNow()) return { status: "refused", reason: "Return to this current editable canvas to send its saved review action." };
      try {
        options.signal?.throwIfAborted();
        const receipt = await postOp(canvasId, actor, operation, options.opId, undefined, options.originGroupMode);
        return { status: "accepted", receipt };
      } catch (error) {
        return { status: questionnaireFailureStatus(error), reason: error instanceof Error ? error.message : "This review action was not confirmed.", ...(error instanceof ApiError && error.code ? { code: error.code } : {}) };
      }
    },
  };
}
