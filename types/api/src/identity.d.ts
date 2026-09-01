import type { Actor } from "../../core/src/index.js";
import type { DaemonClient } from "./client.js";
/**
 * A machine holds one person and any number of agents, and no two of them are
 * the same person.
 *
 * Two slots, most specific first. A SESSION identity is one agent, in
 * whatever directory it happens to work — and it lives in the DAEMON, not in
 * a file here: naming yourself is `actor.claim`, a mutation applied by the
 * single writer like every other mutation in isocan (#57), so two agents
 * claiming one name at the same moment serialize instead of racing. The HOME
 * identity (`~/.isocan/identity.json`) belongs to whoever owns the machine —
 * you. It is the one slot that stays a local file, because a person opening a
 * fresh terminal is the only party with no session and no transcript, and
 * their name has to work before any daemon exists.
 *
 * So an agent naming itself never renames the human, and the human's canvas
 * is never created under an agent's name. One slot per machine was the old
 * design, and the skill told agents to claim it — so the last agent to
 * introduce itself became the user. A DIRECTORY slot
 * (`<dir>/.isocan/identity.json`) came next and failed the mirrored way: a
 * directory has one identity file, so it handed its name to whoever walked in
 * next (#56). Sessions are the slot that is actually per-agent.
 */
export interface ResolvedIdentity {
    actor: Actor;
    /** "session" = this agent, whatever directory it is in. "home" = the
     * human's. */
    source: "session" | "home";
    /** Where the slot lives, for saying so. */
    file: string;
    /** The harness that named this session, when `source` is "session". */
    harness?: string;
    /** The session key this actor is claimed under — the harness conversation's
     * for an agent, the home slot's for the human. What a re-claim presents. */
    key: string;
}
/**
 * The session key the HUMAN's actor is claimed under.
 *
 * `~/.isocan/identity.json` is a local file, and until mechanism 5 it was
 * ASSERTED in every request body and claimed by nothing — so the moment the
 * membership check went live it would have been refused with
 * `not-your-actor`, for every solo human on every machine, at once. The fix
 * is not to grandfather asserted actors (that hole never closes); it is to
 * make the human's actor a real claim on the machine's badge, minted the
 * first time that machine speaks for them.
 *
 * It is a key like any other, so everything downstream already works: one
 * actor per key per badge, `whoami` can find it, and a rename is the same
 * rename an agent does. The prefix cannot collide with a harness key —
 * `harnessSessions` builds `<harness>:<conversation id>`, and no harness is
 * called "home".
 */
export declare const HOME_CLAIM_KEY = "home:person";
export declare function readIdentity(home: string): Promise<Actor | null>;
/**
 * Who this process is, when it has said so before. Asks the daemon —
 * starting one if none answers, since the registry lives behind the single
 * writer now — but only when a harness session is in the environment at all:
 * a bare shell resolves the home identity offline, as it always has.
 *
 * A nested agent sees its own session id AND the ids of whatever launched
 * it, so several keys can be bound at once. The newest binding wins: an
 * agent names itself when it starts, so the most recently claimed session is
 * the closest one to this process.
 */
export declare function findSessionIdentity(client: DaemonClient, home: string): Promise<{
    actor: Actor;
    harness: string;
    key: string;
} | null>;
export interface ClaimOptions {
    /** Omitted: the daemon hands out the next free isocan name. */
    name?: string;
    /** Become a NEW actor even if the name is worn — a second Kenny on purpose. */
    fresh?: boolean;
    /** Resume an existing actor whose conversation (and session id) is gone. */
    as?: string;
    /** The canvas of the directory the claim is made from, when it is already
     * bound (#60) — recorded on the binding as informational scope. */
    canvasId?: string;
}
/**
 * Name the agent running this command: send `actor.claim` to the daemon and
 * be told who you are. Everything that used to be checked here — recency
 * windows, live faces, names remembered by canvases — is the reducer's
 * business now, checked atomically at the single writer.
 *
 * The key claimed is an unclaimed one first: a nested agent inherits the
 * variables of the agent that launched it, and that one has already taken
 * its own key — so the key still free is this process's own.
 */
export declare function claimSessionIdentity(client: DaemonClient, home: string, options?: ClaimOptions): Promise<{
    actor: Actor;
    harness: string;
}>;
/**
 * Why there is no identity here — the truthful version.
 *
 * "No identity configured" is right for a home nobody has ever named
 * themselves in, and WRONG for the case that actually happens: this machine's
 * badge was lost or wiped (a cleared `auth` block, a re-badged client, a home
 * that forgot), so the claims are still on the desk but on a badge nobody
 * holds. The identity IS configured; it is just not reachable from here. The
 * old message named neither the cause nor the way out, and pointed at
 * `--name`, which would mint a STRANGER and strand the history — the precise
 * mistake `--as` exists to prevent.
 *
 * Asked only about session keys this process already presents, so the answer
 * can only ever be "the conversation you are in belongs to that actor". A
 * message that listed the home's actors would be handing out a roster to
 * impersonate.
 *
 * Nothing is adopted. Coming back stays a deliberate act — `--as` — because a
 * badge that silently inherited whatever a session key pointed at would become
 * "anyone who learns a session key can take that actor" the moment claims
 * carry authorization.
 */
export declare function noIdentityHere(client: DaemonClient, home: string): Promise<string>;
/**
 * The directory identity files the deleted slot left behind (#56, #59). One
 * may be sitting in any checkout an agent ever named itself in — this repo
 * had the Kenny that caused #55. It no longer speaks for anyone, but it is
 * also the only local record of which actor id made that directory's
 * history, so it is renamed aside rather than deleted, with a one-time
 * notice saying what it was and the deliberate way back (`--as`).
 */
export declare function retireStrandedIdentities(cwd: string, home: string): Promise<void>;
/**
 * Who this command speaks as: this agent, else the human. The session slot is
 * path-independent by design, so an agent that named itself keeps its name
 * after it wanders into another directory, and two agents sharing one
 * directory stay two people.
 */
export declare function resolveIdentity(client: DaemonClient, home: string): Promise<ResolvedIdentity | null>;
/** A session named by the caller instead of found in the environment — what
 * `connect({ identity })` takes. The two fields are `ISOCAN_SESSION_ID` and
 * `ISOCAN_HARNESS`, spelled as an argument. */
export interface ExplicitIdentity {
    /** The stable session key — what `ISOCAN_SESSION_ID` would carry. */
    session: string;
    /** What set it, for `whoami` and presence. Defaults to "isocan", exactly
     * as the environment spelling does. */
    harness?: string;
}
/**
 * **A stated session key, resolved the way the ambient walk resolves one**
 * (iso-api phase 2). `connect({ identity })` is the environment surgery a
 * script used to perform — export `ISOCAN_SESSION_ID`, clear every harness
 * variable — expressed as an argument: one key, looked up in the same
 * registry, wired for the same reclaim. No fallback to the home identity,
 * deliberately: a script that names who it is must never quietly run as the
 * machine's person because the name was not claimed yet. Null says so, and
 * the caller owns the refusal sentence.
 */
export declare function resolveExplicitIdentity(client: DaemonClient, home: string, identity: ExplicitIdentity): Promise<ResolvedIdentity | null>;
/**
 * Claim the actor this command speaks as — landmine one and landmine two,
 * both defused by one act.
 *
 * The home identity is a local file that nothing ever claimed, so the first
 * time a machine speaks for its person the home refuses with
 * `not-your-actor`; a badge replaced at the door holds no claims at all, so
 * the first act after any recovery is refused the same way. Both are answered
 * by claiming, and `DaemonClient` calls this on exactly those two refusals —
 * which is why it costs nothing at all on the commands that do not need it,
 * and one invisible round trip on the ones that do.
 *
 * `as` + the name is the right instrument and not a loophole. It is the same
 * claim a browser persona sends to resume itself, and it is still judged:
 * refused while the actor is visibly somebody else, refused if the name now
 * answers to another actor this badge can see. What it does NOT do is mint
 * anybody — the id in the file is the id that lands on the badge, so an
 * upgraded human keeps their history instead of quietly becoming new. And a
 * same-key claim on a dead badge never trips the claim-stands window, because
 * `reincarnate` excludes the caller's own session key.
 */
export declare function reclaimIdentity(client: DaemonClient, identity: {
    actor: Actor;
    key: string;
}): Promise<void>;
/**
 * **The person a pass handed this machine** — Scene 5's `setup`, and the one
 * place an identity arrives from outside instead of being chosen here.
 *
 * `writeIdentity` cannot do this job: it takes a NAME and mints an id when it
 * finds none, which is precisely the wrong act. The actor id came from the
 * home, attached to a claim the redeeming badge now holds, and minting a
 * second Jordan beside the real one is the "quietly becomes new" failure the
 * whole `--as` apparatus exists to prevent.
 *
 * **It has to be written down at all because the redeem response is the only
 * announcement there will ever be.** A handoff row carries no session key by
 * design (nobody presented one), and `GET /api/actors` answers by session key
 * — so the identity a pass endowed is *unaskable* after the moment it is
 * handed over, even though the badge holds it and every op will be accepted
 * under it. Dropping the answer would strand the person on their own machine.
 *
 * **It never overwrites a person who is already here.** A machine has one
 * human, they chose their own name, and a command pasted out of a chat window
 * is not the gesture that renames them — so an identity file naming a
 * DIFFERENT actor is left exactly as it is and the caller says so. The same
 * actor is refreshed, which is how a rename at the home reaches a machine that
 * has been offline. Returns what the file says afterwards, and whether this
 * call is what put it there.
 */
export declare function adoptIdentity(home: string, actor: Actor): Promise<{
    actor: Actor;
    adopted: boolean;
}>;
/** Rename in place — the actor id is the stable key, so your history stays
 * yours — unless `fresh`, which makes you a new person entirely. */
export declare function writeIdentity(home: string, name: string, fresh?: boolean): Promise<Actor>;
/** First-run flow: prompt on a TTY, otherwise fail with instructions. */
export declare function requireIdentity(client: DaemonClient, home: string): Promise<Actor>;
