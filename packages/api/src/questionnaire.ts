import type { Ctx } from "./ctx.ts";
import { contextHome } from "./context-summary.ts";
import { questionnaireFailureStatus, type QuestionnairePort, type QuestionnaireReferencePort } from "./questionnaire-reader.ts";

/** The existing authority-bearing client remains the only Node transport. */
export function questionnairePort(ctx: Ctx): QuestionnairePort & QuestionnaireReferencePort {
  return {
    get actorId() { return ctx.actor.id; },
    snapshot: (id, signal) => ctx.client.snapshot(id, signal),
    home: (id) => contextHome(ctx, id),
    blobBytes: (id, hash, signal) => ctx.client.downloadBlob(id, hash, signal),
    send: async (id, op, options) => {
      try {
        options.signal?.throwIfAborted();
        const receipt = await ctx.client.questionnaire(id, ctx.actor, op, options.opId);
        return { status: "accepted", receipt };
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        return { status: questionnaireFailureStatus(error), reason };
      }
    },
  };
}
