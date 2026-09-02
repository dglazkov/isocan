import type { Actor } from "./model.js";
import type { Operation } from "./ops.js";
import type { ActorClaim } from "./badge.js";
import { OpValidationError } from "./errors.js";
import { type ActorColors, type ActorJoins, type ActorMarks, type ActorNames } from "./identity.js";
export type ActorClaimOp = Extract<Operation, {
    type: "actor.claim";
}>;
export type ActorSetColorOp = Extract<Operation, {
    type: "actor.setColor";
}>;
export type ActorSetMarkOp = Extract<Operation, {
    type: "actor.setMark";
}>;
export type ActorJoinOp = Extract<Operation, {
    type: "actor.join";
}>;
/**
 * The actor registry: who everyone is, and who may speak as them. Identity
 * used to be the one mutation that never became an operation — four stores,
 * no single writer, and two clients re-implementing the same continuity rule
 * over different storage (#55). `actor.claim` moved it here: claims serialize
 * at the single writer, and the registry's history is an oplog like
 * everything else's.
 *
 * The registry has TWO HALVES, and this file only holds one of them. That
 * split is the two-ledger rule made mechanical, and it is not cosmetic:
 *
 * - The PUBLIC face — ids, the name each one goes by now, chosen colors — is
 *   canvas state. It is `ActorRegistry`, it lives in the `Store`, it
 *   replicates, and it REPLAYS: `bindName` reconstructs it from the actors
 *   oplog alone.
 * - The PRIVATE half — the claims table, which badge may speak as which
 *   actor — is desk state (`ActorClaim`, in `badge.ts`). It lives behind the
 *   desk, it never replicates, and it is written DIRECTLY rather than
 *   replayed. It has to be: claims key on badge ids, and badge ids stay out
 *   of the oplog, so the claims table is not reconstructible from the log at
 *   all. Two ledgers, two writes — it falls out rather than being imposed.
 *
 * There is no lookup by name anywhere in this file. A resuming agent presents
 * the SAME session key under the same badge — harnesses name conversations,
 * not processes, so the key survives resume — and is handed the same actor
 * back. Name-based resumption is what made a returning Kenny
 * indistinguishable from a second Kenny; the deliberate way back for an agent
 * whose conversation is truly gone is `as`, which is reincarnation, not a
 * coincidence of spelling.
 *
 * Trust: the home knows WHO IS ASKING (a badge it minted), and — as of
 * mechanism 5 — whether the actor a request names is one that badge claims.
 * That check is `claimsActor` below: one line, run by the engine inside the
 * single-writer chain, and deliberately desk-blind. Nothing in this file has
 * ever heard of a badge record; it is handed claim ROWS and judges actors.
 */
/** The name one actor goes by now, and when they took it. */
export interface ActorNameRow {
    name: string;
    /** The claim that set this name. Recency lives here rather than being
     * scanned out of the claims, which is what makes a name outlive the
     * session that took it. */
    at: string;
}
/** Actor id → the name they go by now. */
export type ActorNamesRegistry = Record<string, ActorNameRow>;
export interface ActorRegistry {
    /**
     * The name each actor goes by now, keyed by ACTOR id.
     *
     * Stored rather than derived from the claims, and that is a bug fix as much
     * as a re-key: a name used to live only on a claim row, so an actor whose
     * claim went away silently reverted to whatever name was stamped on each
     * op — "Dion 2" still talking in a thread after Dion 2 became Di, which is
     * the exact failure the registry exists to prevent. A name is the actor's,
     * the way a color already was.
     */
    names: ActorNamesRegistry;
    /** Chosen identity colors, keyed by ACTOR id — deliberately not by session
     * key and not on the Actor itself: an Actor is stamped onto every op and
     * every comment, and a color that rode along would be a thousand copies of
     * a preference, each frozen at the moment it was written. Here it is one
     * row that answers for all of them, past and future. */
    colors: ActorColors;
    /**
     * Chosen face marks, keyed by ACTOR id — same shape and same reasoning as
     * the colours above.
     *
     * **Optional on the type**, because registries written before this field
     * existed are on disk right now and read back without it. A `?? {}` at every
     * read is cheaper than a migration over every home's actors log, and there
     * is nothing to migrate TO: absent and empty mean the same thing.
     */
    marks?: ActorMarks;
    /**
     * Actors folded into other actors, old id → new id (`actor.join`,
     * multi-identity phase 5). Optional for the reason `marks` is: registries
     * written before the field are on disk now, and absent means nobody has
     * joined anybody. Readers go through `resolveActor` rather than reading
     * this directly, so a chain of joins resolves to its end.
     */
    joined?: ActorJoins;
}
export declare const emptyActorRegistry: () => ActorRegistry;
/** A claim row as served over the API — to the badge that holds it, and to
 * nobody else. `key` is the claim's `sessionKey`: a client's own index into
 * its own badge's claims, which is all it ever was for a client. */
export interface ActorBindingRecord {
    key: string;
    actor: Actor;
    boundAt: string;
    /** See ActorClaim.canvasId. */
    canvasId?: string;
}
/** Somebody a canvas answers to. Not only the faces on it right now: an
 * @-mention reaches a name that was used once and put down, so a name stays
 * taken after its wearer goes quiet. */
export interface NameHolder {
    actor: Actor;
    /** Canvas title, for saying where. */
    canvas: string;
    /** Wearing it at this moment, rather than remembered from the history. */
    live: boolean;
}
export declare function harnessOf(sessionKey: string | undefined): string | null;
/** Names hiding in the letters of "isocan" — where allocation starts when the
 * harness is unknown, and where it lands when a letter's names run out. */
export declare const ISOCAN_NAMES: readonly ["Isaac", "Kenny", "Nico", "Sonia", "Iona", "Osian", "Isao", "Cana"];
/**
 * Where a replica asks its home for a name that is free THERE — the one
 * question about a shared namespace that a replica cannot answer for itself.
 *
 * A route constant rather than a literal in two files, for the same reason
 * `DOOR_ROUTE` is one: the caller and the answerer live in different modules,
 * and two spellings of one path is a divergence waiting to happen.
 */
export declare const FREE_NAME_ROUTE = "/api/actors/free-name";
/** The answer: one name, free in the asking badge's scope. Deliberately one
 * name and not the taken set — see the route in `http.ts`. */
export interface FreeNameResponse {
    name: string;
}
export interface ClaimContext {
    registry: ActorRegistry;
    /**
     * The presenting badge's own claims. Its rows are what "mine" means: a
     * session key found here is this holder resuming itself.
     */
    own: readonly ActorClaim[];
    /**
     * The pre-badge shelf row for THIS claim's session key, if the one-time
     * migration left one. Counts as "mine" exactly once; adopting it is the
     * caller's job (see `ClaimResult.adopted`).
     */
    shelved?: ActorClaim;
    /**
     * Every claim a NAME may be judged against — mechanism 10's narrowing.
     * The presenting badge's own rows, the rows of badges admitted where this
     * one is admitted, and the migration shelf. NOT the whole home: name
     * uniqueness exists so `@`-mentions resolve and the facepile reads, which
     * are roster needs, so the question is asked of exactly the rosters this
     * badge can see. Two strangers on unrelated canvases can both have an
     * Isaac, and neither ever hears about the other.
     *
     * The solo home degenerates correctly: a local daemon's badge is admitted
     * to the canvases it works on, so this is the whole table again — the same
     * code, with the scope emerging from the badge rather than hard-coded.
     */
    scoped: readonly ActorClaim[];
    /**
     * Every claim on the actor `as` names, from ANYWHERE on the desk. Actor ids
     * are global and never recycled (mechanism 10), so "is somebody already
     * this actor" is a global question even though "is this name taken" is not
     * — otherwise a stranger could reincarnate a live actor merely by being
     * admitted somewhere else.
     */
    claimants: readonly ActorClaim[];
    /**
     * **Does a badge that is NOT this one already speak as the actor `as` names,
     * under a key this claimant is not presenting?** — gathered, never derived
     * here.
     *
     * It is a boolean rather than the rows themselves because this file has
     * never heard of a badge and must not start: the reducer judges actors, the
     * gathering knows who is holding what (`Engine.claimContext`). What the
     * boolean buys is the tightening mechanism 6 asks for — see `admit`, where
     * "resuming somebody who is already somebody needs a vouch" replaces
     * "resuming somebody who is *visibly* somebody needs a vouch".
     */
    heldElsewhere?: boolean;
    /**
     * **The attribute that vouches for `as`** — the second satisfier of
     * resumption's one rule (mechanism 6), or absent when nothing does.
     *
     * A string and not a badge, for `heldElsewhere`'s reason: what the reducer
     * needs to know is that somebody who is already this actor has proved the
     * same thing this claimant has proved — `email:jordan@acme.test`, held by
     * her laptop and now by her phone. Who holds it is the gathering's business.
     *
     * It is carried rather than collapsed into a boolean because a refusal and
     * an audit both want to name it, and because a vouch nobody can name is the
     * kind of authorization that is impossible to review.
     */
    vouchedBy?: string;
    /** Everyone the canvases IN SCOPE answer to — live faces AND names
     * remembered from history, the same set an @-mention resolves against.
     * Scoped to the claiming badge's admissions, for mechanism 10's reason. */
    held: readonly NameHolder[];
    /**
     * A name the AUTHORITY over this namespace has already picked out as free —
     * the home's answer, when this daemon is a replica and the claimant supplied
     * no name of their own. Absent on a home, which IS the authority, and absent
     * whenever a name was supplied: an explicit name is judged, never allocated.
     *
     * It exists because a replica and its home ask "is this name taken" in
     * DIFFERENT SCOPES, and both are right. Scope is the presenting badge's
     * admissions (mechanism 10), and a fresh replica's local badge has none —
     * so every roster name looks free to it, while the home judges the very same
     * name against the rosters that badge can see THERE and refuses. Two scopes,
     * one name. Allocation is the only place that mismatch is worth closing: an
     * allocated name is a question about a shared namespace, and on a replica
     * the home owns the namespace. See `Engine.claim` for why a CLAIM still does
     * not forward.
     *
     * A preference and not an instruction: it is checked against the local scope
     * below like any other candidate, and skipped if it is taken here.
     */
    preferred?: string;
    /** The envelope timestamp — claims are pure; the caller owns the clock. */
    now: string;
    /** Injectable for tests. */
    mintId?: () => string;
}
export interface ClaimResult {
    /** The public half, replayable — what the store persists. */
    registry: ActorRegistry;
    /** Who the claiming session now is — stamped into the envelope, which is
     * how the caller (and a crash-recovery replay) learns the answer. */
    actor: Actor;
    /** The private half: the presenting badge's claim list after this claim.
     * The engine hands it to the desk. Not replayable, and not meant to be. */
    claims: ActorClaim[];
    /** A shelved legacy row this claim adopted, if any — the sessionKey whose
     * pre-badge claim now belongs to the presenting badge. The desk deletes it;
     * adoption is one-time and first-come. */
    adopted?: string;
}
/**
 * The identity reducer. Validates a claim against everything the daemon can
 * see — the registry, the claims table, live presence, every canvas's history
 * — and returns the bound actor plus BOTH halves of the effect. Runs only at
 * the single writer, so two agents claiming at the same moment serialize: the
 * second is refused or allocated a different name BY CONSTRUCTION, not by a
 * client-side pre-check both of them can pass at once.
 */
export declare function applyClaim(ctx: ClaimContext, op: ActorClaimOp): ClaimResult;
/**
 * The PUBLIC effect of a logged claim — replayable from the envelope alone,
 * because validation already happened when the entry was logged. Taking a
 * name IS the act of naming an actor, so a claim writes one row: actor id →
 * name.
 *
 * Newest wins, judged by the stamp rather than by arrival order. Replay
 * normally delivers entries oldest-first and the guard never fires — but the
 * one-time migrations append entries stamped with their ORIGINAL timestamps
 * onto the end of a log that already has newer ones, so log order is not time
 * order there, and a two-month-old legacy row must not re-letter an actor who
 * was renamed last week.
 */
export declare function bindName(registry: ActorRegistry, envelope: {
    actor: Actor;
    ts: string;
}): ActorRegistry;
/**
 * The PRIVATE effect of a claim: this badge's claim list, after it.
 *
 * One actor is one claim PER BADGE — binding a session key to an actor
 * releases any other key on the SAME badge still holding it, so an `as`
 * reclaim leaves the abandoned session a stranger rather than a second face.
 * Eviction stops at the badge on purpose: two badges may hold one actor (a
 * pass mints a badge carrying a named claim — "Jordan's tab and her daemon"),
 * so "one actor, one holder" was never going to survive, and the narrower
 * rule is already the shape the pass needs.
 */
export declare function bindClaim(claims: readonly ActorClaim[], envelope: {
    actor: Actor;
    ts: string;
    op: ActorClaimOp;
}): ActorClaim[];
/**
 * A claim that was HANDED OVER rather than made — what redeeming a pass
 * writes onto the redeeming badge's list (phase 8).
 *
 * It sits beside `bindClaim` because it is the other way a row gets onto a
 * badge, and it is a separate function because the two differ in every detail
 * that matters:
 *
 * - **No session key.** Nobody presented one. A pass is redeemed by a surface
 *   that has not yet decided which of its conversations this is, and inventing
 *   a key here would put a string the home cannot verify into the one field
 *   the design says the home must never trust. The row is still found by every
 *   question that matters, because `claimsActor` — the membership check that
 *   decides whether this badge may speak as this actor — asks about the actor
 *   and never about the key.
 * - **No eviction by key**, for the same reason; only the badge's own earlier
 *   row for the SAME actor is replaced, so redeeming twice (two passes, one
 *   actor) leaves one row rather than two.
 * - **It is not `applyClaim`, and it is not `as`.** `as` is reincarnation, and
 *   `reincarnate` refuses while the actor is visibly somebody — which, at the
 *   exact moment a pass is redeemed, it always is: Jordan's tab is open on the
 *   canvas she just minted from. A handoff is the opposite gesture from a
 *   claim. Nobody is asserting anything; a holder that already is this actor
 *   said so, on the record, when it minted the pass.
 */
export declare function bindHandoff(claims: readonly ActorClaim[], envelope: {
    actor: Actor;
    ts: string;
    canvasId?: string;
}): ActorClaim[];
/**
 * The membership check — mechanism 5, entire.
 *
 * Everywhere an actor is named, the name must be one the speaker's badge
 * vouches for: ops, undo/redo (or you could undo someone else's work by
 * naming them), and every presence beat, including a daemon's RELAYED
 * presence, where one connection carries several actors and each of them must
 * be in the badge's claims.
 *
 * It takes claim ROWS, not a badge — this file has never heard of badges and
 * must not start now. That is the trick of the whole mechanism: the reducer
 * keeps judging actors and the oplog keeps carrying `actor` and `clientId`
 * with badge ids nowhere in it, while enforcement lands UNDER the vocabulary.
 * The rules that already looked like authorization — `comment.update`'s "only
 * the author", actor-scoped undo — become authorization the moment an actor
 * means something, with the isomorphism contract untouched.
 */
export declare function claimsActor(claims: readonly ActorClaim[], actorId: string): boolean;
/** The refusal, in one voice wherever the check runs. The honest client's
 * remedy is always the same and always available — claim first, which the
 * agent guide already teaches as the first act. */
export declare function notYourActor(actorId: string): OpValidationError;
/**
 * Choosing the color you wear (`actor.setColor`). Home-scoped like a claim,
 * applied by the engine against the registry, and NOT undoable — the same
 * posture as naming yourself. A null color puts you back on the color your id
 * implies, which is why "no row" and "the derived color" mean the same thing.
 */
export declare function applyActorColor(registry: ActorRegistry, op: ActorSetColorOp): ActorRegistry;
/**
 * The mark you wear instead of your initial (`actor.setMark`). Same posture as
 * the colour: home-scoped, applied against the registry, not undoable, and a
 * null mark puts you back on your initial so "no row" and "derived" are one
 * state.
 */
export declare function applyActorMark(registry: ActorRegistry, op: ActorSetMarkOp): ActorRegistry;
/**
 * **Two actors become one person** (`actor.join`, multi-identity phase 5).
 *
 * Writes one row into the registry's `joined` map, `from` → `into`, and
 * nothing else: no name moves, no colour moves, no log entry changes. The
 * wire shapes below (`actorNames`, `actorColors`, `actorMarks`) read through
 * the map, so every client that already shows a name for an id shows the
 * joined person's name without learning anything new.
 *
 * Refused as a join (`bad-join`) when `from` is `into`, when `from` is
 * already folded into somebody, or when the join would close a cycle; refused
 * as `unknown-actor` when either id has no name row here. Whether the
 * speaker may do this at all — the presenting badge must claim both — is the
 * engine's question, asked with `claimsActor` before this runs.
 */
export declare function applyActorJoin(registry: ActorRegistry, op: ActorJoinOp): ActorRegistry;
/**
 * The refusal for a badge that does not speak for both sides of a join. Its
 * own code rather than `not-your-actor`, because the remedy is different: a
 * join is not "claim that actor first" but "be both first", which on a
 * browser is the door's proof and on a CLI is `--as` with a vouch.
 */
export declare function notBothActors(from: string, into: string, missing: string): OpValidationError;
/** The actors folded into others, old id → new id — the wire shape. */
export declare function actorJoins(registry: ActorRegistry): ActorJoins;
/** The mark every actor wears, keyed by actor id — the wire shape. A folded
 * actor wears the mark of the person it was folded into. */
export declare function actorMarks(registry: ActorRegistry): ActorMarks;
/**
 * The colour every actor who chose one wears, keyed by actor id — the wire
 * shape. Only the exceptions, as before, plus one row per folded actor: it
 * wears the person's colour, chosen or derived, because the colour its own
 * id implies is the colour of somebody who no longer answers.
 */
export declare function actorColors(registry: ActorRegistry): ActorColors;
/**
 * The name every actor goes by now, keyed by actor id — the wire shape.
 *
 * A read, not a derivation. It used to walk every claim and take the newest
 * per actor; recency is stored now, so replay order does that work and a name
 * survives the claim that made it.
 *
 * A folded actor answers with the name of the person it was folded into
 * (multi-identity phase 5): every comment written as `Dimitri 2` shows
 * Dimitri, and no client had to learn a new field to show it.
 */
export declare function actorNames(registry: ActorRegistry): ActorNames;
/**
 * The next free isocan name: the roster in order, then numbered rounds
 * ("Isaac 2", …) — allocation can always answer.
 *
 * Exported so a home can answer `FREE_NAME_ROUTE` with the SAME function that
 * would allocate here. Building a second, similar allocator for that route is
 * exactly the shape of the bug it exists to fix.
 */
export declare function allocateName(ctx: ClaimContext, sessionKey?: string | null): string;
