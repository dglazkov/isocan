/**
 * **The morph: a slide comes apart into its pieces, the pieces travel to
 * where they belong on the next slide, and come together flat again.**
 *
 * Keynote calls the middle of it Magic Move. What makes this one ours is the
 * first and last beat: the pieces lift off the slide into depth before they
 * travel, the way a slide looks when you pull its layers apart, and settle
 * back into a flat page at the end. Dion asked for exactly that after seeing
 * it somewhere else, and the 3D *rotations* (depth, cube, flip) were not it.
 *
 * Both halves here are pure, which is why they live in core rather than in
 * the browser that draws them:
 *
 * - `pairPieces` decides which piece on slide A becomes which piece on
 *   slide B — the same title, the same picture, the card with the same
 *   classes. A piece with no partner leaves (A) or arrives (B) instead.
 * - `morphPlan` turns two inventories into keyframes: for every piece on
 *   both slides, a transform and an opacity at each sample of the motion,
 *   already corrected for the pieces it sits inside.
 *
 * The inventories come from the slides themselves. A screen is a sandboxed
 * frame the app cannot look into, so the web surface loads a twin of each
 * slide with a small runtime (`web/src/lib/morphruntime.ts`) that lists its
 * own pieces and later plays the keyframes it is handed. Everything between
 * those two messages is this file.
 */
/** One piece of a slide, as the slide's own runtime measured it at rest. */
export interface MorphPiece {
    /** Its index in its slide's inventory — what the keyframes are addressed to. */
    i: number;
    /** The nearest enclosing piece's index, or -1: transforms compose, so a
     *  piece's own keyframes are written relative to its parent's. */
    parent: number;
    /** A run of words, a picture-like element, or a decorated box (a card). */
    kind: "text" | "media" | "box";
    tag: string;
    /** The author's own name for it — `data-morph`, else the element id. */
    key?: string | undefined;
    /** Its words, whitespace-collapsed, for text pieces. */
    text?: string | undefined;
    /** What it shows, for media pieces. */
    src?: string | undefined;
    /** A few of its classes, so the same card on two slides can find itself. */
    cls?: string | undefined;
    x: number;
    y: number;
    w: number;
    h: number;
}
/** A slide's inventory and the viewport it was measured in. */
export interface MorphScene {
    w: number;
    h: number;
    pieces: MorphPiece[];
}
/** One sample of a piece's motion, as CSS the runtime can hand to `animate`. */
interface MorphKeyframe {
    offset: number;
    transform: string;
    opacity: number;
}
/** Everything one slide's runtime plays: its pieces and its ground. */
interface MorphSide {
    tracks: Array<{
        i: number;
        frames: MorphKeyframe[];
    }>;
    /** The slide's own background, as a layer of its own: it drops away
     *  beneath the pieces as they lift, which is most of what makes them read
     *  as LIFTING rather than merely growing. */
    ground: MorphKeyframe[];
}
/** Both sides, and the tilt the surface puts on the two frames together. */
interface MorphPlan {
    out: MorphSide;
    in: MorphSide;
    scene: Array<{
        offset: number;
        transform: string;
    }>;
}
/** How many pieces a slide may offer. Past this the motion is noise, and
 *  the message carrying the plan stops being small. */
export declare const MORPH_MAX_PIECES = 160;
/**
 * **Which piece on slide A becomes which piece on slide B.**
 *
 * Passes from most to least certain, each greedy by distance, each piece
 * used once — so an author who names things (`data-morph="hero"`) gets
 * exactly what they named, and a deck nobody annotated still finds its
 * repeated title and its repeated card:
 *
 * 1. the author's key (`data-morph`, else `id`), same kind;
 * 2. the same words (text) or the same source (media);
 * 3. the same tag and classes (boxes and text), sizes within 6×;
 * 4. text that begins with the same words, sizes within 6×.
 *
 * Returns A index → B index.
 */
export declare function pairPieces(a: readonly MorphPiece[], b: readonly MorphPiece[]): Map<number, number>;
/** The three beats, as fractions of the whole: apart, across, together. */
export declare const MORPH_BEATS: {
    readonly apart: 0.28;
    readonly across: 0.74;
};
/**
 * **The keyframes for one flip**, both slides at once.
 *
 * Three beats (`MORPH_BEATS`):
 *
 * - **Apart** — slide A's pieces lift off its ground, each to its own
 *   height, while the surface tilts both frames back.
 * - **Across** — a paired piece travels from where it hangs on A to where its
 *   partner hangs on B, and the two cross-fade on the way, so the eye sees
 *   one thing move. A piece without a partner flies up and away (A) or rises
 *   out of the depth (B). A's ground fades and B's arrives.
 * - **Together** — B's pieces come down onto its ground and the tilt goes
 *   flat, which is the moment the live slide can take over unseen.
 *
 * `dir` is which way the deck went; the layers lean away from it.
 */
export declare function morphPlan(a: MorphScene, b: MorphScene, dir: "next" | "prev", samples?: number): MorphPlan;
/**
 * **What a slide's runtime said, made safe to plan with.** The runtime runs
 * inside the slide's own document, next to the slide's own scripts, so its
 * message is untrusted input: every number must be finite, every string is
 * cut short, and a piece may only point at a parent that came before it.
 * Null when it is not a scene at all.
 */
export declare function sceneFromMessage(data: unknown): MorphScene | null;
export {};
