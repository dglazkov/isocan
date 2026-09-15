import type { Ctx } from "./ctx.ts";
import { designRequestPort } from "./design-request.ts";
import { questionnaireFailureStatus } from "./questionnaire-reader.ts";
import type { DesignReviewWritePort } from "./design-review-write.ts";
import type { PreparedDesignRepairPort } from "./design-repair-reader.ts";

/** Native review uses existing authenticated routes, archived history, real presence and wake policy. */
export function designReviewPort(ctx: Ctx): DesignReviewWritePort & PreparedDesignRepairPort {
  const send = async (canvasId: string, operation: Parameters<DesignReviewWritePort["sendReview"]>[1], options: { opId: string; originGroupMode?: "groups" | "legacy"; signal?: AbortSignal }) => {
    try { options.signal?.throwIfAborted(); return { status: "accepted" as const, receipt: await ctx.client.sendOp(canvasId, ctx.actor, operation, undefined, undefined, undefined, options.originGroupMode, undefined, options.opId) }; }
    catch (error) { return { status: questionnaireFailureStatus(error), reason: error instanceof Error ? error.message : String(error), ...(error && typeof error === "object" && "code" in error && typeof error.code === "string" ? { code: error.code } : {}) }; }
  };
  return { ...designRequestPort(ctx),
    history: async id => { const [live, archived] = await Promise.all([ctx.client.getLog(id, 0), ctx.client.getArchivedLog(id)]); return [...new Map([...archived, ...live].map(row => [row.seq, row])).values()].sort((a, b) => a.seq - b.seq); },
    repairs: (id, signal) => ctx.client.designRepairs(id, signal),
    sessions: id => ctx.client.listSessions(id), answering: id => ctx.client.rcAnswering(id),
    uploadReview: (id, text, filename, signal) => ctx.client.uploadBlob(id, Buffer.from(text), "application/json", filename, signal),
    upload: (id, text, filename, signal) => ctx.client.uploadBlob(id, Buffer.from(text), "text/html", filename, signal),
    sendReview: send, sendRepair: send,
  };
}
