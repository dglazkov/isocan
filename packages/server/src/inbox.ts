import { inboxNewestFirst, mergeSeen, type Canvas, type InboxEntry, type InboxResponse, type LogEntry } from "@isocan/core";

/** The canvas's home answered 404 for it: deleted there while this machine
 * was away. Its own kind of unavailable, because the remedy is the person's
 * (`isocan canvas forget`) rather than waiting for a home to come back. */
export class CanvasGoneAtHomeError extends Error {
  readonly gone = true;
}

/** A home that is down costs its own rows, never the rest of the inbox.
 * Four reads at a time; cancellation stops dispatching and reaches each read. */
export async function collectInbox(
  canvases: readonly Canvas[],
  read: (canvas: Canvas, signal: AbortSignal) => Promise<InboxResponse>,
  signal: AbortSignal,
): Promise<InboxResponse> {
  const result: InboxResponse = { entries: [], marks: {}, homes: {}, unavailable: [] };
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(4, canvases.length) }, async () => {
    while (!signal.aborted) {
      const canvas = canvases[next++];
      if (!canvas) break;
      try {
        const found = await read(canvas, signal);
        signal.throwIfAborted();
        result.entries.push(...found.entries);
        result.marks = mergeSeen(result.marks, found.marks);
        Object.assign(result.homes, found.homes);
        result.unavailable.push(...found.unavailable);
      } catch (err) {
        if (signal.aborted) break;
        result.unavailable.push({
          canvasId: canvas.id,
          error: err instanceof Error ? err.message : "Could not read this canvas",
          ...(err instanceof CanvasGoneAtHomeError ? { gone: true as const, title: canvas.title } : {}),
        });
      }
    }
  }));
  signal.throwIfAborted();
  result.entries = inboxNewestFirst(result.entries);
  return result;
}

/** A mark acknowledges a snapshot head. Retained comment operations let the
 * inbox distinguish later comments from the time their visit was recorded.
 * An imported or compacted comment keeps the established timestamp fallback. */
export function sequenceInbox(entries: readonly InboxEntry[], log: readonly LogEntry[]): InboxEntry[] {
  const sequences = new Map<string, number>();
  for (const entry of log) {
    const op = entry.envelope.op;
    if (op.type === "thread.create" || op.type === "thread.reply") {
      sequences.set(`${op.threadId}\u0000${op.comment.id}`, entry.seq);
    }
  }
  return entries.map((entry) => {
    const seq = sequences.get(`${entry.threadId}\u0000${entry.comment.id}`);
    return seq === undefined ? entry : { ...entry, seq };
  });
}
