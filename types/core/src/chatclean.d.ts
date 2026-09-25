import type { Comment, CommentThread } from "./model.js";
import type { Operation } from "./ops.js";
import { type ActorJoins } from "./identity.js";
/**
 * **Cleaning up a thread — the Chat, usually** (24 Sep 2026).
 *
 * A Chat that an rc has been failing into for a week is forty copies of
 * *"Scout couldn't answer — …"*, and the people on the canvas have to scroll
 * past every one to find what anybody said. This is the one place that
 * decides which messages a clean-up takes and what ops it writes, so the
 * Chat's "Clean up…" menu and `isocan comment clean` cannot disagree about
 * either: both call `cleanupSelection` and send `cleanupOps` under one group.
 *
 * **What remove means, said once.** `comment.remove` takes a message out of
 * the thread. It does not take it out of the canvas's history: the op that
 * posted it is still in the log with its words, and the removal's own
 * inverse carries the whole comment, which is exactly what makes one undo
 * bring a clean-up back. `isocan history`, `at`, and `export` still show it.
 * A hard purge would be a different feature: rewriting a log that every
 * replica, every export and every undo inverse holds a copy of.
 */
/** Which messages a clean-up takes. */
export type CommentFilter = 
/** Everything the system voice said — `⚙ isocan` notices. */
{
    kind: "system";
}
/** Everything one actor said, where "one actor" is one PERSON after a join. */
 | {
    kind: "from";
    actorId: string;
}
/** Everything posted strictly before this instant (an ISO timestamp). */
 | {
    kind: "before";
    before: string;
}
/** The whole thread. */
 | {
    kind: "all";
};
/**
 * A design record is not a message anybody can tidy away: `design` and
 * `designDecision` comments are writer-owned records other flows read back
 * (a request's questions, a comparison's adoption), and taking one out of the
 * thread would leave those flows pointing at nothing. The clean-up skips them
 * and the home refuses a direct removal of one.
 */
export declare function removableComment(comment: Comment): boolean;
/**
 * **Who may take a message out of a thread.** Its author always — your own
 * words are yours to withdraw — and the canvas's owner, anybody's, including
 * the system voice's notices, which no author will ever come back for.
 * Everyone else, nobody's but their own.
 *
 * `owner` is the caller's answer to "does this actor own this canvas", which
 * only a home can give with authority (it reads the badge's claims and the
 * admission's rung). The web asks it of the rung the hello carried, the CLI
 * of the snapshot, and the home of `heldRung` — and it is the home's answer
 * that refuses.
 */
export declare function mayRemoveComment(comment: Pick<Comment, "author">, actorId: string, owner: boolean, joined?: ActorJoins): boolean;
/** Does this comment match the filter? */
export declare function matchesFilter(comment: Comment, filter: CommentFilter, joined?: ActorJoins): boolean;
/**
 * The comments a clean-up takes, in thread order: those matching the filter,
 * that this actor may remove, and that are not design records.
 */
export declare function cleanupSelection(thread: CommentThread, filter: CommentFilter, actorId: string, owner: boolean, joined?: ActorJoins): Comment[];
/**
 * **The ops a removal writes — send them under ONE group**, so one undo
 * brings every message back.
 *
 * One `comment.remove` per message, except where the removal would leave the
 * thread empty: a thread is never empty (`CommentThread.comments` says "always
 * at least one", and the reducer refuses the last removal), so taking every
 * message is the thread itself going — `thread.delete`, whose inverse restores
 * it whole, `main` included. For the Chat that is right as well as legal: the
 * next message posted births a fresh one, which is what an empty Chat always
 * did.
 */
export declare function cleanupOps(thread: CommentThread, commentIds: readonly string[]): Operation[];
/**
 * A "before" date as people type it: `2026-09-16` is that day's local
 * midnight (what a date picker means, and what somebody typing a date in a
 * terminal means), anything else is whatever `Date.parse` makes of it. Null
 * for nonsense, so both surfaces refuse it the same way.
 */
export declare function parseBefore(text: string): string | null;
/** "37 system notices", "1 message from Priya" — the count the confirm asks about. */
export declare function cleanupNoun(filter: CommentFilter, count: number, name?: string): string;
