import type { Actor } from "@isocan/core";
import type { DesignDecisionWritePort } from "@isocan/api/design-decision";
import { questionnaireFailureStatus } from "@isocan/api/questionnaire";
import { designRequestReadIO } from "./design-request.ts";
import { ApiError, postOp } from "./api.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { canEditNow } from "./capability.ts";
import { creationDestination } from "./groupplacement.ts";

/** Comparison acts use the same authenticated transport and preserve uncertainty after a lost response. */
export function designDecisionIO(actor: Actor): DesignDecisionWritePort {
  return {
    ...designRequestReadIO,
    actorId: actor.id,
    sendDecision: async (canvasId, operation, options) => {
      const current = useCanvasStore.getState();
      if (current.canvasId !== canvasId || current.past || !canEditNow()) return { status: "refused", reason: "Return to this current editable canvas before changing its design decision." };
      try {
        options.signal?.throwIfAborted();
        const receipt = await postOp(canvasId, actor, operation, options.opId, undefined, creationDestination().originGroupMode);
        return { status: "accepted", receipt };
      } catch (error) {
        return { status: questionnaireFailureStatus(error), reason: error instanceof Error ? error.message : "The decision was not confirmed.", ...(error instanceof ApiError && error.code ? { code: error.code } : {}) };
      }
    },
  };
}
