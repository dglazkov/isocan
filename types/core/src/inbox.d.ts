import type { Actor, CanvasContents, Comment, CommentThread } from "./model.js";
import type { NewComment, Operation } from "./ops.js";
import type { MentionCandidate } from "./mentions.js";
import type { ActorJoins } from "./identity.js";
/**
 * **What is addressed to you, wherever it landed.**
 *
 * `docs/research/2026-08-29-the-inbox.md`, and the finding that shaped this
 * file: **`isocan wait` was already this rule.** It has decided "is this
 * comment for me" for weeks, across several canvases, and the app had no
 * equivalent — so a person could be @-mentioned on a canvas they were not
 * looking at and find out by chance.
 *
 * The rule lives here now rather than in the CLI, for the reason `itemThread`
 * moved: a rule one surface enforces and the other does not know is a habit,
 * not a rule. A second definition written for the person would be a second
 * answer to a question that has one, and the two would disagree silently —
 * which shows up as somebody not being told something.
 *
 * **No read state.** Version one is a LIST, not a count. Seen-marks live in
 * `localStorage` per canvas per actor, so a count would mean "in this browser"
 * and could not see a mention on a canvas this browser has never opened —
 * which is exactly the case an inbox is for. The research recommends a
 * per-canvas high-water mark as an operation when a count is wanted; until
 * then this reports what exists and lets the reader decide what is new.
 */
/** Why a comment is yours. Kept because the reasons are not equally urgent —
 *  a direct mention is somebody asking you; the Chat is the room being loud. */
type InboxReason = "mentioned" | "main-thread" | "in-your-thread";
export interface InboxEntry {
    canvasId: string;
    /** For saying where, without a second lookup. */
    canvasTitle?: string;
    threadId: string;
    comment: Comment;
    reason: InboxReason;
}
/**
 * The names you answer to. Your identity name, plus any session label you are
 * wearing — an agent called "Percy" this run is @Percy to everybody on the
 * canvas, and `wait` has always looked for both.
 */
export declare function namesFor(actor: Actor, label?: string | null): MentionCandidate[];
/**
 * Does this comment address you?
 *
 * Two ways, and both matter. `comment.mentions` is resolved at authoring time
 * against the actors the author could see — the durable, exact answer. The
 * body is re-read as well because older comments predate that field, and
 * because a name you answer to NOW (a session label) may not have been
 * resolvable when the comment was written.
 *
 * Ids are compared through `joined` (multi-identity phase 5): a mention of
 * `Dimitri 2` was resolved to `Dimitri 2`'s id when it was written, and that
 * id resolves to Dimitri now, so the thread is in Dimitri's inbox. Callers
 * that have no map compare ids as they always did.
 */
export declare function addressesActor(comment: NewComment | Comment, names: readonly MentionCandidate[], joined?: ActorJoins): boolean;
/**
 * Everything on one canvas that is addressed to this actor, oldest first.
 *
 * **Your own words are never in your inbox.** Obvious once said, and the kind
 * of thing a filter forgets: you are in every thread you wrote in, so without
 * this every comment you ever left would come back to you.
 */
/**
 * Why one comment is yours, or null when it is ether. THE routing rule,
 * stated once: named — by id or a name you answer to — or the main thread,
 * or a conversation you are already in. `inboxOn` folds a canvas with it and
 * `isocan wait` decides a summons with it, so a parked agent and the inbox
 * can never disagree about what is for you — and a daemon that summons
 * agents (`docs/projects/on-demand/design.md`) asks this same function
 * rather than growing a third copy.
 *
 * The comment may be a `NewComment` (an op still in flight, no author yet);
 * skipping your own words is the caller's job, since only the caller knows
 * whose they are. A missing thread (an op racing its own snapshot) can still
 * mention you; it cannot be main or already yours.
 */
export declare function reasonFor(comment: NewComment | Comment, thread: CommentThread | undefined, actorId: string, names: readonly MentionCandidate[], 
/** The registry's joins, when the caller holds them — see `addressesActor`. */
joined?: ActorJoins): InboxReason | null;
/**
 * **What a rule may say** (agents-on-demand phase 4, decided 2026-08-30):
 * today's filters, exactly — the items it names, the op types (or families,
 * `item.*`) it wants. This is the whole grammar, defined HERE so `wait`, the
 * inbox and the rc read one vocabulary; richer predicates ("the items Sian
 * owns") join this type in this file when something can actually write them,
 * never as a dialect one reader grows alone. Unknown keys in a stored rules
 * object are ignored, not errors: the record has carried rules opaquely
 * since phase 2, and a rule written by a newer build must not break an
 * older reader's routing.
 */
export interface AgentRules {
    /** Only changes touching these item ids. Empty/absent: any item. */
    items?: string[];
    /** Only these op types, `item.*` families allowed. Empty/absent with
     * `items` also empty: comments only — the enrolled default. `["*"]` is
     * everything, `wait --all-ops`'s spelling. */
    ops?: string[];
}
/** The stored rules field, read tolerantly — it has been opaque since
 * phase 2, and a malformed hand-me-down must cost the filter, not the
 * summons. */
export declare function rulesOf(raw: unknown): AgentRules;
/**
 * **THE routing composition, stated once** (agents-on-demand phase 4).
 * `reasonFor` is the is-this-for-me predicate; this is the whole rule a
 * park or a dispatcher applies to one op:
 *
 * - your own ops never wake you — otherwise an agent that writes what it
 *   watches for wakes itself, forever;
 * - a comment for you (`reasonFor`) is a SUMMONS, and it comes through any
 *   filter — the human reaching you is never the noise you asked to be
 *   spared;
 * - everything else is a CHANGE, taken only when the rules ask for it:
 *   filters narrow, an empty rule set means comments-only.
 *
 * It lived as loose composition in `wait`'s loop (`main.ts` checked the
 * summons before the filters ever ran); it lives here so the rc importing
 * the rule and the park applying it cannot drift — the piercing that must
 * never differ between them is one function's control flow.
 */
export declare function dispatchReason(op: Operation, authorId: string, agent: {
    actorId: string;
    names: readonly MentionCandidate[];
    rules?: AgentRules | null | undefined;
    /** The registry's joins, when the caller holds them — see `addressesActor`. */
    joined?: ActorJoins | undefined;
}, canvas: CanvasContents | null | undefined): InboxReason | "change" | null;
export declare function inboxOn(canvas: CanvasContents, actor: Actor, names: readonly MentionCandidate[], canvasId: string, canvasTitle?: string, 
/** The registry's joins, when the caller holds them — see `addressesActor`. */
joined?: ActorJoins): InboxEntry[];
/**
 * Newest first, across canvases — the order an inbox is read in.
 *
 * Sorted here rather than by each caller, because "newest" is the one thing
 * every surface must agree on and it is exactly the sort somebody reimplements
 * slightly differently.
 */
export declare function inboxNewestFirst(entries: readonly InboxEntry[]): InboxEntry[];
/** How many, by why — so a surface can say "2 mentions" without counting the
 *  room being loud as somebody asking you. */
export declare function inboxTally(entries: readonly InboxEntry[]): Record<InboxReason, number>;
/** One line, the same on every surface. */
export declare function inboxLine(entry: InboxEntry): string;
export {};
