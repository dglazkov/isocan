import type { CanvasContents } from "./model.js";
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
export declare function recentActivity(canvas: CanvasContents, actorId: string, limit?: number): ActivityEntry[];
export {};
