import type { Canvas } from "./model.js";
import type { InboxEntry } from "./inbox.js";
/**
 * **What you have already seen, and where you were lately** — one fact, read
 * two ways.
 *
 * `docs/research/2026-09-12-seen-marks.md` is the argument; this file is the
 * whole of the shared computation, so the CLI, the web app and the daemon
 * cannot come to three answers about what "new" means.
 *
 * The fact is one row per person per canvas:
 *
 *     (person, canvas) → { seq, at }
 *
 * `seq` is the canvas's own oplog head as you last had it in front of you;
 * `at` is when you were there, stamped by the home that holds the canvas.
 * Both, because they answer different questions and neither can do the other's
 * job (D2):
 *
 * - **`at` is what everything reads today.** It says which comment is new
 *   (`newSince`), because a `Comment` carries `createdAt` and not the seq of
 *   the op that wrote it; and it is the only half comparable ACROSS canvases,
 *   which is what "lately" is ordered by.
 * - **`seq` is the clock-free half, and it is load-bearing in the MERGE.**
 *   Two machines' marks converge on the further-along reading position
 *   whatever their clocks say to each other, so a fast clock cannot claim you
 *   had read further than you had. It is also the exact answer to *has
 *   anything happened here at all* — one integer against a snapshot's
 *   `lastSeq`, no clock and no scan — which is what #147 step 3's home panel
 *   will ask. Nothing asks it yet; `movedSince` reads the canvas row instead,
 *   because a `Canvas` carries no head.
 *
 * **Where it lives is the decision, and it is not here.** A seen-mark is DESK
 * state at the home — the private ledger beside grants, passes and spaces —
 * and not canvas state, because it fails all three of the context project's
 * tests on purpose: it cannot be undone, everyone must NOT see it, and offline
 * it degrades harmlessly. That is why there is no op for it and why the
 * vocabulary stayed at 33 (D3, D4).
 *
 * **It is not a read receipt and must not become one** (D5). Nothing here, and
 * no route anywhere, returns another actor's marks; `GET /api/seen` answers
 * only for the actors the asking badge already claims. The honest version of
 * "who has seen this" is the presence plane, which answers live and writes
 * nothing down.
 *
 * **Only a visit writes a mark.** The single rule that keeps one fact honest
 * for two readers: the mark is written when you OPEN a canvas, so it means
 * both "I was here at `at`" and "everything up to `seq` was in front of me".
 * A background sweep or a "mark all read" button would move `at` without
 * anybody having been there, and the switcher's "lately" would fill up with
 * canvases nobody went to.
 */
export interface SeenMark {
    /** The canvas's oplog head as you last had it. */
    seq: number;
    /** When you were there — ISO, stamped by the home that holds the canvas. */
    at: string;
}
/** Canvas id → the mark, for one person. The wire shape of `GET /api/seen`. */
export type SeenMarks = Record<string, SeenMark>;
/** `GET /api/seen` — your own marks, every canvas, one read. Scoped to the
 *  actors the presenting badge claims, and there is deliberately no way to
 *  ask for anybody else's. `PUT /api/seen/:canvasId` moves one. */
export declare const SEEN_ROUTE = "/api/seen";
/** The route for one canvas's mark. Built here rather than spelled at each
 *  caller, for `grantsRoute`'s reason: the one place a route is written is
 *  the one place it can be got wrong. */
export declare function seenRoute(canvasId: string): string;
/** What a client sends to move a mark: the head it actually had in front of
 *  it. `at` is never sent — the home stamps it, because a wall clock a client
 *  supplies is a wall clock a client can lie with. */
export interface MarkSeenRequest {
    seq: number;
    /** Whose mark moves, when the badge speaks for several. Defaults to the
     *  badge's acting actor. */
    actorId?: string;
}
/** What it answers with: the mark as it now stands, which may be AHEAD of
 *  what was sent — another machine of yours may have been further along. */
export interface SeenResponse {
    mark: SeenMark;
}
/** Every mark this badge holds. */
export interface SeenMarksResponse {
    marks: SeenMarks;
}
/**
 * **The merge, and the only place either half is ever compared.**
 *
 * A join on each component independently — `seq` takes the larger, `at` takes
 * the later (ISO strings, so lexicographic is chronological). Three properties
 * fall out of that and each of them is a test:
 *
 * - **A mark never goes backwards.** An old client holding a stale `lastSeq`
 *   cannot pull yours back; its write is a no-op on the seq.
 * - **Two machines racing converge.** Max is commutative, associative and
 *   idempotent, so the order the writes arrive in cannot change the answer.
 * - **A revisit counts even when nothing happened.** `at` moves on its own,
 *   which is not a curiosity: a canvas you read for an hour and changed
 *   nothing on is exactly the one you come back to, and it is the case
 *   "lately" exists for.
 *
 * Independent maxes rather than "take the newer row whole" for that last
 * reason: a paired merge would drop a further-along `seq` from one machine
 * because another machine's visit was more recent.
 */
export declare function advanceSeen(current: SeenMark | undefined, incoming: SeenMark): SeenMark;
/** Fold one person's marks from several sources into one — the read side of
 *  multi-identity. A badge that claims two actors (which is what `actor.join`
 *  requires of it) holds two ledgers of marks for one person, and they are one
 *  person's marks: merged with the same rule, so a fold needs no migration and
 *  loses nothing. */
export declare function mergeSeen(...sources: readonly SeenMarks[]): SeenMarks;
/**
 * **Has this canvas moved since you were here?**
 *
 * From the canvas ROW, because that is what the list route gives and what
 * `isocan seen` has: the reducer stamps `updatedAt` on every op, so a canvas
 * whose last write is newer than your mark has moved. Unmarked means yes — a
 * canvas you have never opened has everything new in it.
 *
 * **The seq would be the better test and has no caller for it yet.** A
 * comparison against a snapshot's `lastSeq` is clock-free where this is not,
 * and it is what #147 step 3's home panel will ask; a `Canvas` row carries no
 * head, so asking it here would mean a snapshot per canvas. The seq is not
 * idle in the meantime — it is the clock-free half of the merge, which is what
 * stops a machine with a fast clock from claiming you had read further than
 * you had.
 */
export declare function movedSince(mark: SeenMark | undefined, canvas: Canvas): boolean;
/**
 * **The inbox, split into what is new and what you have already seen.**
 *
 * A second function rather than a filter inside `inboxOn`, deliberately: the
 * routing rule — *is this comment for me* — has one definition and this must
 * not become a second one. This takes entries the rule already produced and
 * asks a different question of them, which is *have I looked since*.
 *
 * Compared on `createdAt` against the mark's `at`, both stamped by the home
 * that holds that canvas, so the two sides of the comparison come from one
 * clock. A canvas with no mark is entirely new, which is exactly what an inbox
 * should say about a canvas you have never opened — the case the browser's
 * `localStorage` watermarks structurally could not see.
 */
export declare function newSince(entries: readonly InboxEntry[], marks: SeenMarks): InboxEntry[];
/**
 * **Where you were lately, newest first** — the switcher's shared list, and
 * the same fact the inbox just read.
 *
 * Ordered by `at` alone, because that is the half that is comparable across
 * canvases. Canvases with no mark are not here at all: "lately" is where you
 * HAVE been, and the switcher already lists everything else underneath in the
 * home screen's `recent` order.
 */
export declare function latelyOrder(marks: SeenMarks): {
    canvasId: string;
    mark: SeenMark;
}[];
