import type { Ctx } from "./ctx.ts";
import { designRequestPort } from "./design-request.ts";
import { questionnaireFailureStatus } from "./questionnaire-reader.ts";
import type { DesignDecisionWritePort } from "./design-decision-reader.ts";

/** Node retains the existing canvas grants, actor custody and source policies on comparison reads and writes. */
export function designDecisionPort(ctx: Ctx): DesignDecisionWritePort {
  return { ...designRequestPort(ctx),
    decisions: (id, signal) => ctx.client.designDecisions(id, signal),
    sendDecision: async (id, op, options) => {
      try { return { status: "accepted", receipt: await ctx.client.designDecision(id, ctx.actor, op, options.opId, options.signal) }; }
      catch (error) { return { status: questionnaireFailureStatus(error), reason: error instanceof Error ? error.message : String(error), ...(error && typeof error === "object" && "code" in error && typeof error.code === "string" ? { code: error.code } : {}) }; }
    },
  };
}
