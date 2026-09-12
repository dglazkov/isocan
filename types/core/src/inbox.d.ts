import type { Actor, CanvasContents, Comment, CommentThread } from "./model.js";
import type { NewComment, Operation } from "./ops.js";
import type { MentionCandidate } from "./mentions.js";
import type { ActorJoins } from "./identity.js";
import type { RcPolicy } from "./protocol.js";
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
 * **This file knows nothing about read state, and that is deliberate.**
 *
 * Version one was a LIST with no count at all, because the only seen-marks
 * were `localStorage` ones — per canvas per actor per BROWSER, so a count
 * would have meant "in this browser" and could not have seen a mention on a
 * canvas this browser had never opened, which is exactly the case an inbox is
 * for. There is a durable mark now (`seen.ts`, 12 Sep 2026: one row per person
 * per canvas, kept by the home, not an op) and `newSince` answers the count.
 *
 * It stays a SEPARATE function over the entries this one produces, rather than
 * a clause inside `reasonFor`. "Is this comment for me" has one definition and
 * `isocan wait` parks on it; folding "have I looked since" into it would make a
 * parked agent's summons depend on whether somebody had read a canvas.
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
    /**
     * **Whose word wakes this agent** — actor ids, read at the rc that answers
     * for it by `answerPolicy`. Absent or empty means **its owner alone** — the
     * person whose machine answers — which is owner-only summons, the default
     * since 11 Sep 2026 (from 9 to 11 Sep it meant anyone admitted). A list
     * admits the owner and those people; `["*"]` admits everyone, what a team's
     * agent wants (`docs/research/2026-09-04-sheepdog.md`, "whom it listens
     * to").
     *
     * It is a gate on the SPEAKER, and `items`/`ops` are filters on what
     * changed — a different question, which is why it is a third field here
     * and an outer gate in `dispatchReason` rather than a third clause in
     * the composition. A mention pierces every filter, deliberately; it must
     * not pierce this one, or a pet agent its owner pays for answers every
     * stranger on a shared canvas.
     *
     * `["*"]` is the same spelling `ops` uses for "everything", said
     * explicitly so a person can turn a gate off without deleting a field.
     *
     * A name may carry how long it lasts — `{ id, until }` beside the bare ids
     * every older gate is made of (`ListenEntry`, issue #272 phase 3). Read it
     * with `parseListen` / `listenGrants` rather than by hand; the union is
     * deliberate, so a reader that forgets is a type error rather than a gate
     * that quietly matches nobody.
     */
    listen?: ListenEntry[];
}
/** The `listen` spelling for "anyone" — `ops`'s idiom, one definition. */
export declare const LISTEN_ANYONE = "*";
/**
 * **How long a grant lasts, written into the name it grants to** (issue #272
 * phase 3, 11 Sep 2026).
 *
 * A timed grant needed somewhere to live, and there were two places it could
 * have gone: a sibling field on `AgentRules` (`until: { [id]: iso }`) or the
 * entry itself. The entry wins, and the reason is which way each one FAILS on
 * a reader that has never heard of expiry.
 *
 * `rulesOf` drops keys it does not know, deliberately — the record has
 * carried rules opaquely since phase 2. So a sibling `until` map would be
 * invisible to an older build, which would go on honouring a grant that
 * lapsed a month ago: a gate failing OPEN, on the one field whose whole job
 * is to decide who may spend somebody's tokens.
 *
 * **The expiry belongs to the name, so it is written on the name.** An entry
 * is a bare actor id — which is every gate written before today, unchanged —
 * or `{ id, until }`. Two reasons this rather than packing the date into the
 * string (`usr_dion until <ISO>`), which was the first shape and was wrong:
 *
 * - **The type system can enforce it.** With `ListenEntry[]`, a reader that
 *   treats an element as an id gets a type error; with `string[]`, the same
 *   reader compiles and silently matches nobody. A gate that fails by
 *   accident — in either direction — is exactly what this field exists to
 *   prevent, so the failure has to be one a compiler can see.
 * - **An older reader drops it cleanly.** `rulesOf` has always kept only
 *   strings in this list, so a build that has never heard of expiry does not
 *   see a listener id that is not an id: it sees no entry at all, the grant
 *   is absent, and the agent answers its owner alone. Fail closed, and
 *   nothing anywhere renders half a date as a person's name.
 *
 * There is no migration to write, because both shapes are read: a plain
 * string is a grant with no expiry, which is what every stored gate already
 * is, and `spellListen` still writes a bare string when nobody said how long
 * — so a gate that gains no expiry is byte-identical to what it was.
 *
 * `listen` staying a list on one field is what lets phase 3 be a field on
 * the record rather than a new op: the vocabulary stays at 33, and
 * `agent.enroll` carries this as it carried the gate before.
 */
/** One name in the gate, read: who, and — when the owner said how long —
 *  until when, as an ISO instant (absolute, so two machines in two timezones
 *  cannot read one grant two ways). */
interface ListenGrant {
    id: string;
    until?: string;
}
/** A name in the gate, stored: an actor id, or that id with how long the
 *  grant lasts. `LISTEN_ANYONE` is the one id that is not a person. */
export type ListenEntry = string | ListenGrant;
/** A stored entry, read. An `until` that is not a time is ignored rather
 *  than trusted: a gate must never widen because a value was malformed. */
export declare function parseListen(entry: ListenEntry): ListenGrant;
/** The entry to store — the inverse of `parseListen`, here so the two
 *  spellings cannot drift apart. A grant with no expiry stays a bare string,
 *  so a gate that never gains one is byte-identical to what it always was
 *  and every older reader goes on reading it. */
export declare function spellListen(id: string, until?: string | null): ListenEntry;
/**
 * The gate's names, parsed and dated — what every surface that wants to SHOW
 * a gate reads, rather than each one learning the spelling. `lapsed` is kept
 * in the list rather than filtered out of it, because a grant that ran out is
 * the thing a refusal has to be able to name.
 */
export declare function listenGrants(listen: readonly ListenEntry[] | undefined, now?: number): (ListenGrant & {
    lapsed: boolean;
})[];
/**
 * **The list a grant writes.** One name added to — or taken out of — the gate
 * that already STANDS, which is `RcPolicy.listen` and not the stored field:
 * a gate somebody other than the owner wrote has already been set aside
 * (`answerPolicy`), and appending to the stored value would quietly bring it
 * back. The owner's click says one thing; it must not also resurrect
 * somebody else's.
 *
 * `LISTEN_ANYONE` swallows the list, because "anyone" is not one more name —
 * it is the answer instead of the list — and taking it away leaves the names
 * that were there before it, which is the gate the owner last chose by hand.
 */
export declare function withListener(policy: RcPolicy, actorId: string, admit: boolean, opts?: {
    until?: string | null;
    joined?: ActorJoins;
    now?: number;
}): ListenEntry[];
/** When this asker's grant ran out, if they had one and it did — so a
 *  refusal can say *lapsed* rather than repeating *never*. */
export declare function lapsedFor(policy: RcPolicy, actorId: string, joined?: ActorJoins, now?: number): string | undefined;
/**
 * **How long, as a person says it** — `tonight`, `7d`, `30d`, `never`, or an
 * instant spelled out. Resolved to an absolute instant at the moment of the
 * grant, on the granter's clock, because a gate read on three machines in
 * three timezones must mean one moment.
 */
export declare function listenUntil(spec: string, now?: number): string | null;
/** A grant's remaining life, in the clipped vocabulary the rosters use:
 *  *until tonight*, *for 6 days*, *lapsed 2h ago*. */
export declare function untilWords(until: string, now?: number): string;
/** The stored rules field, read tolerantly — it has been opaque since
 * phase 2, and a malformed hand-me-down must cost the filter, not the
 * summons. */
export declare function rulesOf(raw: unknown): AgentRules;
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
 * How a surface says a STORED gate when no rc is in sight to say its policy
 * (`policyWords` is the words once one is) — null when there is none to say,
 * so a caller can append it without asking whether there is anything to
 * append. With nobody answering, the stored list is all there is to read.
 *
 * `nameOf` resolves an actor id to the name that reader would show; ids are
 * the fallback, never a blank, because a gate nobody can read is the silent
 * gate wearing a different hat.
 */
export declare function listenWords(rules: AgentRules | null | undefined, nameOf: (actorId: string) => string | undefined, now?: number): string | null;
/**
 * **Owner-only summons** (decided 11 Sep 2026; issue #238, the rc research
 * note's recommendation 6, agent-custody's open question).
 *
 * A summoned turn runs on the rc owner's machine and spends the rc owner's
 * tokens, and until this any member admitted to a shared canvas could start
 * one. `rc --sandbox` bounds what a turn may REACH; this bounds who may START
 * one, and a shared canvas makes it the sharper question of the two.
 *
 * **The owner** is the person whose machine answers: the rc's home identity
 * (`~/.isocan/identity.json`, the actor its badge holds under `home:person`).
 * Not whoever enrolled the agent — an agent can enrol an agent, and the web's
 * add is an ask the rc completes — but whose bill it is, which only the
 * machine can say. Compared through `actor.join`, so the same person under a
 * second, joined identity is the owner too.
 *
 * **The owner's hands** are every other actor the owner's machine speaks as —
 * the agents its rc runs, the person's own interactive sessions. Their word
 * counts as the owner's: they run on the owner's machine and the owner's
 * tokens already, a chain of them is bounded by the cycle guard, and without
 * it two agents on one laptop could no longer ask each other anything.
 *
 * **The default is the owner alone.** `listen` absent or empty now means
 * exactly that (it meant everyone from 9 to 11 Sep); a list admits the owner
 * AND those people; `["*"]` admits everyone, which is what a team's agent
 * wants and is now said out loud with `isocan rc listen <name> --to everyone`.
 *
 * **Only the owner's word widens.** The gate lives in a record every admitted
 * member can write, so the rc reads it only when `writtenBy` is the owner's
 * word; anybody else's enrolment reads as owner-only there. A stranger can
 * still make an agent do less (withdraw it, narrow nothing into something) —
 * the canvas may narrow; it may never spend.
 */
export interface Keeping {
    owner: Actor;
    /** Actor ids the owner's machine speaks as — `actorBindings()` on the rc's
     * badge, plus the agents it answers for. */
    hands?: readonly string[];
}
/** Is this actor the owner, or one of the owner's hands? */
export declare function ownersWord(keeping: Keeping, actorId: string, joined?: ActorJoins): boolean;
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
/** Does this policy admit that speaker? `hands` is the rc's own knowledge
 * and never crosses the wire; a reader without it asks about people. */
export declare function mayWake(policy: RcPolicy, authorId: string, joined?: ActorJoins, hands?: readonly string[], 
/** The clock a timed grant is read against — a parameter so a test can
 *  stand at a moment, and `Date.now()` because every real caller is at
 *  this one. */
now?: number): boolean;
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
 * How every surface says a policy: *listens only to Nico*, *listens only to
 * you*, *listens to Nico and Usama*, *listens to Nico and 2 others* — or null
 * for everyone, when there is nothing to qualify. The same vocabulary as
 * `listenWords`, so a tray, `isocan who` and a refusal in a thread all say
 * one thing one way.
 */
export declare function policyWords(policy: RcPolicy, nameOf: (actorId: string) => string | undefined, 
/** Who is reading, so the owner reads *you* rather than their own name. */
viewerId?: string, joined?: ActorJoins, now?: number): string | null;
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
/**
 * The same question asked by a CLIENT, before or just after it posts: which
 * of the agents this comment names will the answering rc turn away? Read
 * against the policies the rcs announced (`RcAnsweringResponse.policies`),
 * so the CLI's note and the web's line say what the rc will do rather than
 * guessing at it. Agents with no announced policy are nobody's to predict.
 */
export declare function refusedMentions(mentions: readonly string[] | undefined, authorId: string, policies: Readonly<Record<string, RcPolicy>> | undefined, joined?: ActorJoins, now?: number): {
    actorId: string;
    policy: RcPolicy;
    lapsed?: string;
}[];
/**
 * The sentence a turned-away asker reads — the rc's system voice in the
 * thread, the CLI's note after a comment, the web under it. It names the
 * owner, because the owner is the only person who can change the answer, and
 * it names the exact gesture, because "ask them to widen it" with no verb is
 * a riddle.
 */
export declare function turnedAwayLine(agentName: string, policy: RcPolicy, nameOf: (actorId: string) => string | undefined, asker: string, 
/** When this asker's own grant ran out, if it did — the one clause a
 *  lapsed grant adds to the refusal a gate that never had it would give
 *  (issue #272 phase 3). */
opts?: {
    lapsed?: string | undefined;
    now?: number;
}): string;
/** Does this comment body read as the refusal this agent got? The system
 *  voice is the only author that writes one, which the caller checks. */
export declare function readsAsTurnedAway(body: string, agentName: string): boolean;
/**
 * **THE routing composition, stated once** (agents-on-demand phase 4).
 * `reasonFor` is the is-this-for-me predicate; this is the whole rule a
 * park or a dispatcher applies to one op:
 *
 * - your own ops never wake you — otherwise an agent that writes what it
 *   watches for wakes itself, forever;
 * - a speaker outside the gate is not here at all: `listen` is applied
 *   BEFORE everything below, so an op from outside it is neither a summons
 *   nor a change, and never reaches the ceiling to be counted against it;
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
/** How many, by why — so a surface can say "2 mentions" without counting the
 *  room being loud as somebody asking you. */
export declare function inboxTally(entries: readonly InboxEntry[]): Record<InboxReason, number>;
/** One line, the same on every surface. */
export declare function inboxLine(entry: InboxEntry): string;
export {};
