import type { LogEntry } from "@isocan/core";
import type { Ctx } from "./ctx.ts";
import { automaticSourceClient } from "./context-summary.ts";
import { designRequestPort } from "./design-request.ts";
import { questionnaireFailureStatus } from "./questionnaire-reader.ts";
import type { DesignReviewWritePort } from "./design-review-write.ts";
import type { PreparedDesignRepairPort } from "./design-repair-reader.ts";

const bySeq = (...lists: LogEntry[][]): LogEntry[] => [...new Map(lists.flat().map(row => [row.seq, row])).values()].sort((a, b) => a.seq - b.seq);
// Every canvas's history opens with its creation at seq 1, so an empty log is
// a missing one — the replica that adopted a snapshot and has seen no op since.
const gapless = (log: LogEntry[]): boolean => log.length > 0 && log.every((row, index) => row.seq === index + 1);

/**
 * **This canvas's whole history, from wherever the whole of it is**
 * (14 Oct 2026). A replica that never held a canvas is started by its home's
 * snapshot, so its own log begins after that snapshot and its archive is
 * empty — and `isocan design workflow` there said "Canonical review history
 * is incomplete at sequence 1" on every canvas a machine had joined rather
 * than made. The home holds the history the snapshot summarised; it is read
 * there, through the same source-forwarding the daemon already gives a
 * remote canvas's blobs and snapshots. The reader's own check is unchanged:
 * a home whose history really has a hole is still refused, never reset.
 */
async function completeHistory(ctx: Ctx, id: string, signal?: AbortSignal): Promise<LogEntry[]> {
  const [live, archived] = await Promise.all([ctx.client.getLog(id, 0), ctx.client.getArchivedLog(id)]);
  const local = bySeq(archived, live);
  if (gapless(local)) return local;
  const home = (await ctx.client.homes()).canvases[id];
  if (typeof home !== "string") return local;
  const remote = automaticSourceClient(ctx, home, signal);
  const [homeLive, homeArchived] = await Promise.all([remote.getLog(id, 0), remote.getArchivedLog(id)]);
  // The home's rows win a seq both hold: it is the authority they came from.
  return bySeq(local, homeArchived, homeLive);
}

/** Native review uses existing authenticated routes, archived history, real presence and wake policy. */
export function designReviewPort(ctx: Ctx): DesignReviewWritePort & PreparedDesignRepairPort {
  const send = async (canvasId: string, operation: Parameters<DesignReviewWritePort["sendReview"]>[1], options: { opId: string; originGroupMode?: "groups" | "legacy"; signal?: AbortSignal }) => {
    try { options.signal?.throwIfAborted(); return { status: "accepted" as const, receipt: await ctx.client.sendOp(canvasId, ctx.actor, operation, undefined, undefined, undefined, options.originGroupMode, undefined, options.opId) }; }
    catch (error) { return { status: questionnaireFailureStatus(error), reason: error instanceof Error ? error.message : String(error), ...(error && typeof error === "object" && "code" in error && typeof error.code === "string" ? { code: error.code } : {}) }; }
  };
  return { ...designRequestPort(ctx),
    history: (id, signal) => completeHistory(ctx, id, signal),
    repairs: (id, signal) => ctx.client.designRepairs(id, signal),
    sessions: id => ctx.client.listSessions(id), answering: id => ctx.client.rcAnswering(id),
    uploadReview: (id, text, filename, signal) => ctx.client.uploadBlob(id, Buffer.from(text), "application/json", filename, signal),
    upload: (id, text, filename, signal) => ctx.client.uploadBlob(id, Buffer.from(text), "text/html", filename, signal),
    sendReview: send, sendRepair: send,
  };
}
