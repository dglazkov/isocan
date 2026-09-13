import { itemsTouchedBy, lensActs, opWords, type CanvasContents, type LogEntry, type SeenMark } from "@isocan/core";
/** Captured before this visit advances the authoritative mark. */
export interface PriorVisit { canvasId: string; actorId: string; head: number; mark: SeenMark | null; available: boolean }
interface VisitChange { seq: number; words: string; itemIds: string[]; threadId: string | null }
/** Fold only the absence interval, using core activity words and explicit op targets;
 * an incomplete retained log must say so instead of inventing the missing history. */
export function visitDigest(prior: PriorVisit, canvas: CanvasContents, entries: readonly LogEntry[]) {
  const from = prior.mark?.seq;
  if (!prior.available) return { notice: "Previous visit unavailable.", rows: [] as VisitChange[] };
  if (from === undefined) return { notice: "This is your first recorded visit.", rows: [] as VisitChange[] };
  if (from >= prior.head) return { notice: "Nothing new since your last visit.", rows: [] as VisitChange[] };
  const interval = entries.filter((entry) => entry.seq > from && entry.seq <= prior.head).sort((a, b) => a.seq-b.seq);
  const complete = interval.length === prior.head-from && interval.every((entry, i) => entry.seq === from+i+1);
  const rows = interval.slice(-20).reverse().map((entry): VisitChange => {
    const act = lensActs([{ canvasId: prior.canvasId, canvasTitle: "", entries: [entry] }], () => true)[0]!;
    const op = entry.envelope.op;
    const threadId = "threadId" in op && typeof op.threadId === "string" && canvas.threads[op.threadId] ? op.threadId : null;
    return { seq: entry.seq, words: `${act.actor} ${opWords(act.op) ?? "changed the canvas"}`, itemIds: itemsTouchedBy(op, canvas).filter((id) => Boolean(canvas.items[id])), threadId };
  });
  return { notice: !complete ? "Some history from your absence is unavailable. Showing the records this home still has." : interval.length > 20 ? `Showing the latest 20 of ${interval.length} changes.` : `${rows.length} changes since your last visit.`, rows };
}
