/**
 * Identity colors: the one color an actor wears everywhere — their cursor,
 * their face in the pile, the outline on an item they are holding, a comment
 * pin, and the default ink in their Pen.
 *
 * A color is DERIVED from the actor id by default, so every client agrees on
 * it with no storage and no round trip, and a brand-new actor has a color the
 * moment it exists. Choosing one instead is `actor.setColor`: the choice lands
 * in the actor registry beside the name, which is what makes it durable and —
 * more importantly — the same for everyone. A color you can only see yourself
 * is not an identity.
 *
 * The palette is small and curated on purpose: every entry has to read on the
 * vellum ground AND the graphite one, because there is one canvas and two
 * themes, and drawings carry literal colors into their SVG.
 */
/** The palette, in the order a picker should show it. Cobalt is deliberately
 * absent: the app reserves it for structure (your own selection, primary
 * actions), so an actor wearing it would read as "selected". */
export declare const IDENTITY_COLORS: ReadonlyArray<{
    name: string;
    value: string;
}>;
/** Chosen colors, keyed by actor id — the registry's `colors` map. */
export type ActorColors = Record<string, string>;
/**
 * Current names, keyed by actor id — the registry's answer for a name that
 * was stamped onto something months ago.
 *
 * Every op and every comment carries the Actor who made it, name included, so
 * a rename would otherwise leave a thousand frozen copies of the old one on
 * the canvas: "Dion 2" still talking in a thread after Dion 2 became Di. The
 * registry is the one row that answers for all of them, past and future —
 * exactly the argument that keeps colors out of the Actor. The stamped name
 * stays in the log, because the log records what happened; it is just not what
 * anyone is shown.
 */
export type ActorNames = Record<string, string>;
/** The mark each actor wears in place of an initial, keyed by actor id. */
export type ActorMarks = Record<string, string>;
/**
 * Actors folded into other actors: old id → the id it was folded into
 * (`actor.join`, multi-identity phase 5). The registry's `joined` map, and
 * the wire shape that rides beside `names`.
 *
 * Readers resolve before they compare: `resolveActor` walks this map to the
 * id that answers now. The log is never rewritten, so an op written as
 * `Dimitri 2` still carries `Dimitri 2`'s id — what changes is that every
 * reader turns that id into Dimitri's first.
 */
export type ActorJoins = Record<string, string>;
/**
 * The actor id that answers for `actorId` now — itself, unless it was folded
 * into somebody, in which case the end of the chain. Transitive, and safe
 * against a cycle that should never have been written: a map that loops
 * answers with the last id before the loop closes rather than hanging.
 */
export declare function resolveActor(joined: ActorJoins | undefined, actorId: string): string;
/** Do these two ids name one person? */
export declare function sameActor(joined: ActorJoins | undefined, a: string, b: string): boolean;
/**
 * Every id that resolves to the same person as `actorId`, the resolved id
 * first. What an undo walks after a join: the person is one, so their stack
 * is every stack they ever wrote under.
 */
export declare function actorAliases(joined: ActorJoins | undefined, actorId: string): string[];
/**
 * **Is this one emoji?**
 *
 * Deliberately not a whitelist of code points: the emoji set grows every year
 * and a list would refuse next year's. What is being checked is the SHAPE —
 * one grapheme, and pictographic rather than a letter — because the failure
 * this prevents is somebody putting a word, a name, or three flags where a
 * single mark has to fit inside a 22px disc.
 *
 * `Intl.Segmenter` counts graphemes properly, so a family emoji joined by
 * zero-width joiners is ONE, which is what a reader sees and therefore the
 * only count that matters here.
 */
export declare function isFaceMark(mark: string): boolean;
/**
 * **What goes in the disc: the mark if there is one, else the initial.**
 *
 * One function because there were EIGHT places computing
 * `name.charAt(0).toUpperCase()` — the facepile, the rail strip, comments,
 * toasts, the share roster, the lens, the identity menu and the identity
 * dialog. Eight copies of a rule is eight places to forget the emoji, and the
 * ninth caller would have gone on drawing a letter with nothing to say it was
 * wrong.
 */
/**
 * **The mark somebody chose, or nothing.**
 *
 * `faceMark` below answers "what glyph goes in the disc", and falls back to
 * an initial because a disc is never empty. This is the raw question, for the
 * places that want the emoji OR nothing at all — a cursor chip already says
 * the name, so falling back to its first letter would print "D Dion".
 *
 * One fold: `faceMark` is written in terms of this, so there is a single
 * place that knows a mark is a chosen thing which may be absent.
 */
export declare function markOf(marks: ActorMarks | undefined, actor: {
    id: string;
}): string | null;
export declare function faceMark(marks: ActorMarks | undefined, actor: {
    id: string;
    name: string;
}, displayName?: string): string;
/** The name this actor goes by NOW, falling back to the one stamped at the
 * time — an actor the registry has never heard of (another machine's, or one
 * from before the registry) is still owed a name. */
export declare function actorNameIn(names: ActorNames | undefined, actor: {
    id: string;
    name: string;
}): string;
/** Any color the app is willing to store or draw with: a literal hex. */
export declare function isIdentityColor(value: string): boolean;
/** The color this actor wears: their choice if they made one, else the one
 * their id has always implied. */
export declare function actorColor(actorId: string, colors?: ActorColors): string;
