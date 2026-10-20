/** Inbox and agent dispatch routing. Browser status projections stay in inbox.ts. */
import type { Actor, CanvasContents, Comment, CommentThread } from "./model.js";
import type { NewComment, Operation } from "./ops.js";
import { type MentionCandidate } from "./mentions.js";
import { type ActorJoins } from "./identity.js";
import type { RcPolicy } from "./protocol.js";
import { type InboxEntry, type AgentRules, type Keeping } from "./inbox.js";
type InboxReason = InboxEntry["reason"];
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
 * stated once: named — by id or a name you answer to — or (when not
 * addressed to someone else) the main thread, or a conversation you are
 * already in. `inboxOn` folds a canvas with it and `isocan wait` decides a
 * summons with it, so a parked agent and the inbox can never disagree about
 * what is for you — and a daemon that summons agents
 * (`docs/projects/on-demand/design.md`) asks this same function rather than
 * growing a third copy.
 *
 * The comment may be a `NewComment` (an op still in flight, no author yet);
 * skipping your own words is the caller's job, since only the caller knows
 * whose they are. A missing thread (an op racing its own snapshot) can still
 * mention you; it cannot be main or already yours.
 */
export declare function reasonFor(comment: NewComment | Comment, thread: CommentThread | undefined, actorId: string, names: readonly MentionCandidate[], 
/** The registry's joins, when the caller holds them — see `addressesActor`. */
joined?: ActorJoins, 
/** Known actors on the canvas, so un-resolved text mentions of other actors are recognized as for others. */
candidates?: readonly MentionCandidate[]): InboxReason | null;
/**
 * **Does this agent's gate admit that speaker — with no owner in sight?**
 *
 * The reading of `listen` for a caller that answers for nobody else: a
 * `wait` park is its own session, run by the person at its keyboard, so it
 * has no owner to protect and absent still admits everyone there. The rc,
 * which spends somebody's tokens on somebody's machine, reads the same field
 * through `answerPolicy` instead, where absent means its owner alone.
 *
 * A gate one surface applied and another could not describe is the failure
 * the sheepdog design names first — *"a silent gate: a person mentions a
 * sheepdog that does not listen to them and nothing says so"* — which is why
 * the rc announces its policy with its hold and `policyWords` says it.
 */
export declare function listensTo(rules: AgentRules | null | undefined, authorId: string, 
/** The registry's joins, when the caller holds them — a gate naming
 * `Dimitri 2` must still admit Dimitri. */
joined?: ActorJoins, now?: number): boolean;
/**
 * What a stored enrolment means at the rc that answers for it — the policy it
 * applies AND the one it announces with its hold, computed once so the two
 * cannot differ.
 */
export declare function answerPolicy(rules: AgentRules | null | undefined, keeping: Keeping, 
/** `EnrolledAgent.writtenBy`'s id; undefined for a row older than the
 * stamp, which is taken as it stands. */
writtenBy: string | undefined, joined?: ActorJoins): RcPolicy;
/** Whether a gate was set aside because somebody other than the owner wrote
 * it — so the rc can SAY why it answers only its owner, rather than seeming
 * to ignore a gate everybody can read. */
export declare function gateSetAside(rules: AgentRules | null | undefined, keeping: Keeping, writtenBy: string | undefined, joined?: ActorJoins): boolean;
/**
 * **Whose word an agent's turn carries** — the provenance `onBehalfOf`
 * reads. For each author of the entries that started the turn: an agent the
 * rc runs contributes the speakers ITS turn carried (followed as far as the
 * rc has seen), anybody else contributes themselves. An agent with nothing
 * recorded — started by its owner's machine, or before this rc began —
 * speaks for itself, which is its owner's hand.
 */
export declare function speakersFor(authorIds: readonly string[], carried: (agentId: string) => ReadonlySet<string> | undefined): Set<string>;
/**
 * **Did the gate turn away a direct ask?** Only a MENTION is answered in
 * words: somebody asked this agent by name and deserves to know why nothing
 * came. The Chat being loud, or a reply in a thread the agent was once in,
 * is the room talking, and an agent narrating every sentence it did not
 * answer would be the noise the gate exists to spare.
 */
export declare function turnedAway(op: Operation, authorId: string, agent: {
    actorId: string;
    names: readonly MentionCandidate[];
    policy: RcPolicy;
    hands?: readonly string[];
    joined?: ActorJoins | undefined;
    onBehalfOf?: readonly string[] | undefined;
}): boolean;
export declare function dispatchReason(op: Operation, authorId: string, agent: {
    actorId: string;
    names: readonly MentionCandidate[];
    rules?: AgentRules | null | undefined;
    /** The registry's joins, when the caller holds them — see `addressesActor`. */
    joined?: ActorJoins | undefined;
    /**
     * Whose word wakes it, from the rc that answers for it (`answerPolicy`).
     * When present it IS the gate, and the default it carries is the owner
     * alone; absent — a `wait` park, which answers for itself — the gate is
     * `rules.listen` read by `listensTo`.
     */
    policy?: RcPolicy | null | undefined;
    /** The owner's hands (`Keeping.hands`), when the caller is the rc. */
    hands?: readonly string[] | undefined;
    /**
     * **Whose word the author is carrying** — when the author is an agent
     * the rc runs and its turn was started by somebody's ask, the people
     * whose asks those were (`speakersFor`). The gate reads THEM, not the
     * agent: otherwise a stranger turned away by an agent that listens only
     * to its owner reaches it anyway, one hop later, through a sibling that
     * listens to everyone. Absent: the author speaks for itself.
     */
    onBehalfOf?: readonly string[] | undefined;
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
/** One line, the same on every surface. */
export declare function inboxLine(entry: InboxEntry): string;
export {};
