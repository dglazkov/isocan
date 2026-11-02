import type { Ctx } from "./ctx.ts";
import { automaticSourceClient, contextHome } from "./context-summary.ts";
import { designAuditPort } from "./design-audit.ts";
import { questionnaireFailureStatus } from "./questionnaire-reader.ts";
import type { DesignRequestReadPort, DesignRequestWritePort } from "./design-request-reader.ts";

/** Node keeps existing actor custody, home routing and source policy on every request read/write. */
export function designRequestPort(ctx: Ctx): DesignRequestReadPort & DesignRequestWritePort {
  return {
    ...designAuditPort(ctx),
    // Read-only discovery must remain available before an agent has named itself.
    get actorId() { try { return ctx.actor.id; } catch { return undefined; } },
    snapshot: (id, signal) => ctx.client.snapshot(id, signal),
    home: id => contextHome(ctx, id),
    requests: (id, signal) => ctx.client.designRequests(id, signal),
    decisions: (id, signal) => ctx.client.designDecisions(id, signal),
    decisionActors: id => ctx.client.questionnaireActors(id),
    blobBytes: (id, hash, signal) => ctx.client.downloadBlob(id, hash, signal),
    sourceBlobBytes: (source, hash, signal) => automaticSourceClient(ctx, source.expectedHome, signal).downloadBlob(source.canvasId, hash, signal),
    send: async (id, op, options) => {
      try {
        options.signal?.throwIfAborted();
        return { status: "accepted", receipt: await ctx.client.designRecord(id, ctx.actor, op, options.opId) };
      } catch (error) { return { status: questionnaireFailureStatus(error), reason: error instanceof Error ? error.message : String(error) }; }
    },
  };
}
