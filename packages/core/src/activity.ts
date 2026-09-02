import type { CanvasContents } from "./model.ts";

/**
 * What somebody has been doing here.
 *
 * A facepile answers "is anyone around"; the next question a collaborator asks
 * is "and what have they been up to", which the canvas can already answer — a
 * comment carries its author and time, an item carries who made it, and every
 * version carries who added it. Nothing new is stored: this is a read over the
 * state both clients already hold, which is why it lives in core rather than
 * in whichever surface asked first.
 *
 * Deleted work is left out. An item in the trash is not something to offer
 * somebody a way to go and look at.
 */

type ActivityKind = "said" | "made" | "edited";

export interface ActivityEntry {
  kind: ActivityKind;
  /** ISO timestamp of the act itself, not of anything downstream. */
  at: string;
  /** What it happened to — an item to fly to, when there is one. */
  itemId?: string;
  /** The thread a comment landed in, for opening it. */
  threadId?: string;
  /** The item's name, or where the thread is pinned. */
  subject: string;
  /** What they said, for a comment. */
  body?: string;
}

/** Most recent first. `limit` is a display budget, not a time window: a canvas
 * nobody has touched in a week should still say what happened last. */
export function recentActivity(
  canvas: CanvasContents,
  actorId: string,
  limit = 6,
): ActivityEntry[] {
  const entries: ActivityEntry[] = [];

  // Deleted work is simply absent: `item.delete` moves the item OUT of
  // canvas.items and into the trash, so iterating items is already the live
  // set. A thread whose anchor went with it is the one case left to check.
  for (const item of Object.values(canvas.items)) {
    if (item.createdBy.id === actorId) {
      entries.push({ kind: "made", at: item.createdAt, itemId: item.id, subject: item.title });
    }
    // Every version after the first is an edit — the first IS the creation,
    // and saying both would report one act twice.
    for (const version of item.versions.slice(1)) {
      if (version.createdBy.id !== actorId) continue;
      entries.push({ kind: "edited", at: version.createdAt, itemId: item.id, subject: item.title });
    }
  }

  for (const thread of Object.values(canvas.threads)) {
    const anchor = thread.anchorItemId ? canvas.items[thread.anchorItemId] : undefined;
    if (thread.anchorItemId && !anchor) continue;
    const subject = anchor ? anchor.title : thread.main ? "the main thread" : "the canvas";
    for (const comment of thread.comments) {
      if (comment.author.id !== actorId) continue;
      entries.push({
        kind: "said",
        at: comment.createdAt,
        threadId: thread.id,
        ...(anchor ? { itemId: anchor.id } : {}),
        subject,
        body: comment.body,
      });
    }
  }

  return entries.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)).slice(0, limit);
}
