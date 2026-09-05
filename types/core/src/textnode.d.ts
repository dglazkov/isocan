import type { Item } from "./model.js";
/**
 * **The text node: words typed straight onto the canvas.**
 *
 * Deliberately NOT a new op type, and not a new kind of thing in the model —
 * a text node is an ordinary `item.add` whose version blob is markdown, the
 * same move the Pen makes with an SVG (`drawing.ts`) and the mini-browser
 * makes with a `text/uri-list`. Everything the vocabulary already promises
 * comes free: undo is `item.delete`, re-editing is `item.addVersion` so every
 * wording is kept, `isocan ls` lists it, `isocan get` hands back a real `.md`,
 * GC keeps the blob alive, `#Title` points at it, an agent can `wait` on it —
 * and a client that predates this renders it as what it is, a markdown note.
 *
 * What makes it a text NODE rather than a note somebody uploaded is the same
 * signal a drawing uses: `properties.kind`. That is what tells both clients to
 * draw it chromeless — words on the canvas rather than a card with a filename
 * — and it is a property so that stripping it leaves an ordinary, still-valid
 * markdown item rather than something broken.
 *
 * Markdown rather than plain text because people write lists and emphasis
 * without being asked to, the app already renders it, and a `.md` is the file
 * somebody would have made by hand.
 */
export declare const TEXT_MIME = "text/markdown";
export declare const TEXT_FILENAME = "text.md";
/** `properties.kind` on an item born from the Text tool. */
export declare const TEXT_KIND = "text";
export declare const TEXT_PROPERTIES: Record<string, string>;
export declare function isTextItem(item: Item): boolean;
/** How wide a text node starts, in world units — and the width its title is
 * measured against. Wide enough for a sentence, narrow enough that a
 * paragraph wraps into a block somebody can place. */
export declare const TEXT_WIDTH = 320;
/** Point size the canvas draws a text node at, in world units. Shared so the
 * box the app reserves and the box the CLI guesses are the same box. */
export declare const TEXT_SIZE = 16;
/**
 * **The size ladder, and why it doubles.**
 *
 * A text node's size is in WORLD units, so it shrinks with the canvas: at 10%
 * zoom, default text renders at 1.6 screen px, which is not small text — it
 * is texture. The eye needs about 8px to read a word at all.
 *
 * That makes size the zoom answer rather than a matter of taste. Each step
 * doubles, so each step survives twice as far out, and the ladder maps
 * one-to-one onto a zoom you can name:
 *
 *   body    16 → readable to  50%   a note, a sentence, the default
 *   heading 32 → readable to  25%   names a thing beside it
 *   title   64 → readable to  12%   names a cluster; survives the whole-board view
 *   display 128 → readable to  6%   the one label on a canvas you read first
 *
 * Steps rather than a number, because a canvas carrying fourteen arbitrary
 * text sizes is a canvas nobody can scan — the ladder IS the hierarchy, and
 * it only works if everyone is on it.
 */
export declare const TEXT_STYLES: readonly ["body", "heading", "title", "display"];
export type TextStyle = (typeof TEXT_STYLES)[number];
export declare const TEXT_STYLE_SIZE: Record<TextStyle, number>;
/**
 * **What each step is CALLED on a control: a size, not a role.**
 *
 * The names above are the ladder's own vocabulary — a heading is a heading
 * because of how far out it stays readable — and they are what the property
 * and the CLI say. On the bar they were shown as B / H / T / D, and four
 * initials of words nobody had been told is a code, not a control; it was
 * reported as hard to grok. S / M / L / XL is a vocabulary everybody already
 * has, and it says the one thing a person choosing is thinking about. The
 * step name stays the canvas's word, so a label change is not a migration.
 *
 * One map, read by both surfaces: the bar shows these, and `isocan text
 * --style` accepts them beside the names.
 */
export declare const TEXT_STYLE_LABEL: Record<TextStyle, string>;
/** A step from what somebody typed — its name or its label, either case —
 *  or null, so the caller can refuse with the list rather than guess. */
export declare function textStyleFrom(value: string): TextStyle | null;
/** `properties.textStyle` — absent means `body`, which is what every text
 *  node made before the ladder existed says, and it stays correct. */
export declare const TEXT_STYLE_PROP = "textStyle";
export declare function textStyleOf(item: Item): TextStyle;
/** World-unit size of a node's words. */
export declare function textSizeOf(item: Item): number;
/**
 * **The faces — a closed set, each meaning something rather than offering a
 * taste.**
 *
 * The set is closed because text is a SHARED fact: an item, versioned, in the
 * oplog, whose box was measured on whichever machine typed it. A face that
 * resolves against whatever fonts a person happens to have installed renders
 * one collaborator's canvas differently from another's, and overflows its own
 * box for whoever is missing it. So every member is either a stack that
 * exists everywhere, or a file this app is responsible for.
 *
 * - `sans` — the app's own voice; a note that belongs to the interface.
 * - `mono` — commands, paths, logs. Agent-written notes are full of them,
 *   and a whole node of mono reads as machine output at a glance.
 * - `serif` — prose and quotes. Against a canvas of machine-made screens it
 *   reads as *somebody wrote this*, which nothing else here says.
 * - `hand` — scribbling on the board, which is what a canvas is for.
 *
 * **`hand` is the exception, and it is one deliberately.** The stylesheet
 * records this repo throwing a webfont out, and that decision stands where it
 * was made: on the front page's critical path, for a display face that size
 * and weight could have done instead. This is a different case in every
 * particular — it is content inside items rather than the first paint a
 * stranger sees, it is `display=swap` so nothing waits on it, and there is no
 * system stack that could do the job. CSS `cursive` resolves to Comic Sans on
 * Windows and Snell Roundhand — formal calligraphy — on macOS: opposite
 * tones, so unlike the other three the INTENT does not survive the trip.
 *
 * It is SELF-HOSTED — one woff2 served from this app, with its SIL Open Font
 * License beside it (see `index.html`). It began on Google Fonts as a stated
 * temporary, to buy the ability to swap the face in one line while we found
 * out which handwriting felt right on a canvas; that settled on Caveat, so
 * the two costs written down at the time are paid off rather than carried.
 * Offline it is still handwriting, and nobody outside the machine is told
 * who is looking.
 */
export declare const TEXT_FACES: readonly ["sans", "mono", "serif", "hand"];
export type TextFace = (typeof TEXT_FACES)[number];
export declare const TEXT_FACE_STACK: Record<TextFace, string>;
/**
 * How much bigger a face has to be drawn to hold the ladder's promise.
 *
 * The ladder says a step is readable down to a named zoom, and that promise
 * is about the SIZE OF A LETTER, not the number in the CSS. Caveat has a much
 * smaller x-height than a UI sans, so `hand` at 16 reads like sans at 13 and
 * would quietly sit a rung lower than the control claims. Multiplying it back
 * up keeps every step meaning what the tooltip says it means, on every face.
 */
export declare const TEXT_FACE_SCALE: Record<TextFace, number>;
/** The world-unit size to actually draw this node's words at. */
export declare function textDrawSize(item: Item): number;
export declare const TEXT_FACE_PROP = "textFace";
export declare function textFaceOf(item: Item): TextFace;
/**
 * **Paper: the same words, on something you could pick up.**
 *
 * A text node is a caption — words that belong to the space around them. A
 * post-it is an object: edges, a colour, a shadow, and the sense that it
 * could be peeled off and stuck somewhere else. That difference is real and
 * it is entirely presentational, which is why this is a property on the node
 * rather than a new kind of thing with its own tool. `docs/research/
 * 2026-09-01-post-it-notes.md` is the argument, including why a post-it is
 * not a comment: a comment is ADDRESSED — author, thread, unread state — and
 * a sticky note is not a message.
 *
 * Absent means no paper, which is every text node made before this existed
 * and stays exactly right. Strip the property and an ordinary text node is
 * what is left, the same promise `kind` makes.
 *
 * **A closed set, and it means nothing.** The colours are paper, not a
 * taxonomy: the moment yellow means "todo" the canvas has a vocabulary
 * nobody wrote down and everybody reads differently. Closed for the reason
 * the faces are closed — this is a SHARED fact, and a colour resolved from
 * somebody's local taste renders one collaborator's canvas differently from
 * another's.
 */
export declare const PAPERS: readonly ["yellow", "pink", "blue", "green", "grey"];
export type Paper = (typeof PAPERS)[number];
export declare const PAPER_PROP = "paper";
/** The paper this node is written on, or null for none — a plain text node. */
export declare function paperOf(item: Item): Paper | null;
export declare function isPaper(value: unknown): value is Paper;
/**
 * The patch that puts a note on paper or takes it off — one place, so the app
 * and the CLI cannot spell the property two ways.
 *
 * Clearing uses `removeProperties`, because `properties` MERGES: an unpaper
 * that quietly left the value on would leave the note yellow forever. Same
 * shape, and the same reason, as `slidePatch`.
 */
export declare function paperPatch(paper: Paper | null): {
    properties: Record<string, string>;
} | {
    removeProperties: string[];
};
/**
 * **How big a note starts, and why it is a square rather than a line.**
 *
 * A physical post-it's constraint is what makes it useful: it will not hold
 * an essay, so it holds an idea. A note that grows to fit its text is a text
 * node with a background — the shape is doing no work. So paper starts square
 * and a drag overrides it, like any other item.
 */
export declare const PAPER_SIZE = 220;
/** Should this node draw its words, or the mark that stands for them? */
export declare function textIsLegible(worldSize: number, scale: number): boolean;
/**
 * How big to draw the mark, in SCREEN pixels.
 *
 * It never claims more room than the node itself has. A mark bigger than the
 * thing it stands for would lie about the canvas's shape — and at a zoom
 * where forty nodes are marks, forty oversized glyphs are the same smear
 * again wearing a different hat. So it fills what the node has and stops,
 * capped so it never reads as a letter somebody typed.
 */
export declare const TEXT_MARK_MAX = 14;
export declare function textMarkSize(boxWidth: number, boxHeight: number, scale: number): number;
/**
 * The name this text goes by — its first line, trimmed of markdown's own
 * furniture and capped.
 *
 * A drawing can be called "Sketch" because one drawing looks like another in
 * a list; text cannot, because the whole of what distinguishes two notes is
 * what they say. So the title is the words, which is what makes `isocan ls`
 * and a `#Title` chip worth reading.
 */
export declare function textTitle(body: string): string;
/**
 * A box for this text before anything has measured it.
 *
 * An estimate, and only ever a starting point: the app measures what it
 * actually rendered and corrects the item, and `⇧F` re-fits at any time. It
 * exists so that a node made from the CLI — where there is nothing to measure
 * with — lands at a size somebody can read rather than at a default square.
 */
/**
 * **How wide a column each step wraps in, and why it is not proportional.**
 *
 * The first cut scaled the column with the size, so a title got four times
 * the width and a display eight — a box 2560 units wide holding three words.
 * That is the wrong model, because it assumes every step is used for the same
 * KIND of text. They are not: small text is paragraphs, big text is labels.
 * So the character count per line falls as the size rises — roughly 40
 * characters at body, about 14 at display — and the column grows gently
 * rather than in step with the type.
 *
 * This is only ever the MAXIMUM. What actually commits is the width the words
 * turned out to need, measured, so a three-word title gets a three-word box.
 */
export declare const TEXT_COLUMN: Record<TextStyle, number>;
/**
 * **How far a line may run before it wraps.**
 *
 * `TEXT_COLUMN` is where prose SHOULD wrap; this is where it MUST. The
 * difference exists because the two things people type at these sizes are not
 * the same thing: body text is paragraphs and wants a readable measure, but a
 * title is a label, and wrapping "Design system review" onto three lines
 * because it passed 640 units is not typography, it is a box that was too
 * small. Reported as "the area should expand to the right if you get to the
 * edge".
 *
 * So the composer grows rightward to fit what is being typed and only wraps
 * when it reaches here. Prose still wraps — at body size this is a long line
 * but not an endless one — and a label gets to be one line, which is what a
 * label is.
 *
 * A multiple rather than four more hand-set numbers: the ladder above already
 * decided how these steps relate, and a second table would drift from it.
 */
export declare const TEXT_COLUMN_MAX: Record<TextStyle, number>;
export declare function textBox(body: string, style?: TextStyle, face?: TextFace): {
    width: number;
    height: number;
};
