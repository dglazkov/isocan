import type { ActorJoins, ActorNames } from "./identity.js";
import type { Actor, CanvasContents } from "./model.js";
/**
 * @-mentions. A mention is resolved at AUTHORING time against the actors the
 * author can see (comment authors, item creators, live presence sessions) and
 * stored structurally on the comment as actor ids — readers filter on ids and
 * never re-parse text.
 *
 * Names are free-form (spaces, emoji), so matching is candidate-driven rather
 * than grammar-driven: at each "@" every candidate name is tried — the full
 * name and its first whitespace-separated token ("@Dimitri" matches "Dimitri
 * Glazkov") — longest first. Matching is case-insensitive. The "@" must start
 * a word — a preceding letter/digit disqualifies it, so email addresses
 * mention nobody.
 *
 * `findMentionSpans` exposes WHERE each mention sits, which is what the web
 * app's chips (in the composer and in rendered bodies) are drawn from.
 */
/** A resolvable name. Pass one entry per name an actor answers to — their
 * Actor.name plus any presence label — duplicated ids are deduped. */
export interface MentionCandidate {
    id: string;
    name: string;
}
/** Where a mention sits in the body — what renderers underline as a chip. */
export interface MentionSpan {
    /** Index of the "@". */
    start: number;
    /** Index just past the matched name. */
    end: number;
    /** The mentioned actor. */
    actorId: string;
    /** The name as written, without the "@". */
    name: string;
}
/**
 * Every mention in `body`, in text order, non-overlapping. At each "@" the
 * longest matching candidate name wins, so "@Dimitri Glazkov" is one span
 * rather than a bare "@Dimitri" followed by loose text.
 */
export declare function findMentionSpans(body: string, candidates: MentionCandidate[]): MentionSpan[];
/** Where a slash command sits in the body — the same shape a mention has, so
 *  one chip renderer draws both. */
export interface CommandSpan {
    /** Index of the "/". */
    start: number;
    /** Index just past the verb. */
    end: number;
    /** The verb as written, without the "/". */
    name: string;
}
/**
 * **Every slash command in `body`, so a message that RAN something says so.**
 *
 * A message whose whole content is `/anatomy` and a path reads as plain text —
 * the one word that says work was asked for looks like any other word, and
 * there is nothing to click on to find out what it does. A mention is already
 * a chip; a command is the same kind of thing and was not.
 *
 * Here rather than in the web app because the rule is a fact about a body, and
 * both surfaces read bodies. It is the third span kind `splitChips` composes,
 * which is why this is a dozen lines rather than new machinery.
 *
 * **Only commands this canvas actually has.** `known` is the verbs the palette
 * would offer, so `/anatomy` lights up where the module is loaded and stays
 * plain text where it is not — a chip that offers to open something absent is
 * worse than no chip. And only at the start of a line: `and/or` is not a
 * command, `http://x/y` is not a command, and a person writing about a path
 * mid-sentence is not asking for one.
 */
export declare function findCommandSpans(body: string, known: readonly string[]): CommandSpan[];
/** Actor ids mentioned in `body`, in candidate order, deduped. */
export declare function extractMentions(body: string, candidates: MentionCandidate[]): string[];
/**
 * The names an actor answers to: what the canvas remembers PLUS what they go
 * by now.
 *
 * A rename reaches everything a person reads (lib/names.ts, actorNames) — and
 * for a while it did not reach the thing that matters most, because mentions
 * were matched against the name stamped on old ops. Rename "Dion 2" to "Di"
 * and `@Di` resolved to nobody: no chip in the web app, and worse, no id on
 * the comment, so the summons never woke her. A name you answer to has to
 * work in the one place names are for.
 *
 * The old names stay: text written months ago still says "@Dion 2", and that
 * should keep pointing at the same person.
 */
export declare function actorsAnswerTo(actors: MentionCandidate[], names: ActorNames | undefined, 
/** The registry's joins (multi-identity phase 5): every candidate's id is
 * resolved first, so a new "@Dimitri 2" is stored as a mention of Dimitri —
 * the person who answers to it now — rather than of an actor nobody is any
 * more. */
joined?: ActorJoins): MentionCandidate[];
/** One entry per actor visible in a canvas, under the first name they used.
 * Combine with the live presence roster for mention candidates. */
export declare function collectCanvasActors(canvas: CanvasContents): Actor[];
/** One entry per (actor, name) pair the canvas has recorded — the same person
 * can have worked under more than one name, and it is NAMES that `@mentions`
 * and "is this name taken?" key on. */
export declare function collectCanvasNames(canvas: CanvasContents): MentionCandidate[];
