/**
 * **Purge: the bytes** — the shared half of `docs/projects/operator/design.md`,
 * "Purge: the bytes" (operator phase 3).
 *
 * A takedown stops a home serving a canvas and can be lifted; a purge erases
 * what the home holds under it and cannot. It is *a second act, refused unless
 * the canvas is taken down*, so that the erasure is the second of two
 * deliberate acts — and it is the first thing in this whole system that a
 * `--lift` cannot walk back. What this file holds is what a daemon, a terminal
 * and a ledger row must spell the same way: the route, the request, the
 * answer, the counts, and the shape of a **horizon** — the one honest thing a
 * purge can say about what it could NOT erase.
 *
 * **Irreversible, with a horizon, said in numbers** (design, D7). A hosted
 * home's bucket keeps a deleted object for a while; its database can be
 * rewound; its nightly exports age out; and copies on members' machines are
 * theirs. The verb prints all four so the reply to whoever reported the canvas
 * can be exact — *the files and the log are gone from the home now; here is
 * what still exists, where, and for how long* — rather than "it has been
 * deleted", which is the sentence that turns out to be false.
 *
 * **The numbers are deliberately NOT here.** Seven days, seven days and ninety
 * are facts about `infra/30-bucket.sh`, `infra/20-firestore.sh` and
 * `infra/90-backup-export.sh`, and they belong to the backing that has a
 * bucket (`@isocan/cloudstore`), where a test reads the scripts and fails the
 * day a horizon moves. A file home has no bucket and no export, and says so by
 * naming none. What every home has is members with replicas, and that horizon
 * is composed here because it is true of every backing.
 */
import type { CanvasTakedown } from "./takedown.js";
/** `POST /api/operator/canvases/:id/purge`. */
export declare const OPERATOR_PURGE_ROUTE = "/api/operator/canvases/:id/purge";
/**
 * What `isocan operator purge` sends.
 *
 * `force` is required by the route rather than only by the verb, so that a
 * caller who reached the route by hand meets the same refusal the CLI gives
 * before it opens a browser: an erasure needs to be asked for in so many
 * words. It is not the safeguard — the takedown is; a purge is refused on a
 * canvas that is not down whatever this says.
 */
export interface OperatorPurgeRequest {
    force?: boolean;
}
/**
 * **What was erased, counted.** Journey 6 step 2 asks for numbers, and these
 * are the ones a store can actually count as it deletes: blobs and their
 * bytes, log entries (live and archived), and the objects under the canvas's
 * prefix — snapshot, blobs, archive, overflow ops — on the backing that has
 * one. Counted by the act, not estimated before it, because the reply to the
 * reporter is a claim about what happened.
 */
export interface PurgeCounts {
    /** Blobs erased, and their bytes. */
    files: number;
    bytes: number;
    /** Log entries erased — the live log and whatever compaction had set aside. */
    ops: number;
    /** Objects or files removed under the canvas's own prefix, blobs included. */
    objects: number;
}
/**
 * **One thing that still exists after the purge, and for how long.**
 *
 * `days` is null for the horizon that never closes — the copies members hold
 * on their own machines are theirs, and this home cannot reach a laptop
 * (design, "Take a canvas down"). The sentence is rendered by the HOME, in
 * the words of the backing that knows, so a terminal running last month's
 * bundle prints what this home's infrastructure says today.
 */
export interface PurgeHorizon {
    /** `bucket`, `database`, `exports`, `replicas` — for a reader that branches. */
    kind: string;
    days: number | null;
    sentence: string;
}
/** What the route answers: the row as it now stands, the counts, and what
 * survives. `--json` prints it whole; the verb prints it as lines. */
export interface OperatorPurgeResponse {
    /** The takedown row, now carrying `purgedAt` and the counts — the record
     * journey 6 step 3 says stays: who made it, when it came down, why, and the
     * counts. */
    takedown: CanvasTakedown;
    erased: PurgeCounts;
    /** Every horizon this home can name, the members' replicas last. Never
     * empty: every home has that one. */
    survives: PurgeHorizon[];
}
/**
 * **The fourth horizon, true of every backing**: what members hold is theirs.
 *
 * Composed in core rather than by either backing because neither backing
 * knows it — it is a fact about the innkeeper posture, not about storage.
 * `relaying` is the count the takedown's reach gave, which is the only honest
 * number this home has: there is no registry of machines that have ever
 * linked (operator phase 1's trajectory), so the sentence says *relaying at
 * the time*, never *linked*.
 */
export declare function replicasHorizon(relaying: number): PurgeHorizon;
/**
 * **The refusal a purge meets on a canvas that is not down** — journey 6 step
 * 1, verbatim, because it is the one sentence this act exists to say. One
 * spelling, so the route and the verb's own preflight cannot drift.
 */
export declare function purgeNeedsTakedown(canvasId: string): string;
