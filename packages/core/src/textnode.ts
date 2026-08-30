import type { Item } from "./model.ts";

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

export const TEXT_MIME = "text/markdown";
export const TEXT_FILENAME = "text.md";

/** `properties.kind` on an item born from the Text tool. */
export const TEXT_KIND = "text";
export const TEXT_PROPERTIES: Record<string, string> = { kind: TEXT_KIND };

export function isTextItem(item: Item): boolean {
  return item.properties.kind === TEXT_KIND;
}

/** How wide a text node starts, in world units — and the width its title is
 * measured against. Wide enough for a sentence, narrow enough that a
 * paragraph wraps into a block somebody can place. */
export const TEXT_WIDTH = 320;

/** Point size the canvas draws a text node at, in world units. Shared so the
 * box the app reserves and the box the CLI guesses are the same box. */
export const TEXT_SIZE = 16;

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
export const TEXT_STYLES = ["body", "heading", "title", "display"] as const;
export type TextStyle = (typeof TEXT_STYLES)[number];

export const TEXT_STYLE_SIZE: Record<TextStyle, number> = {
  body: TEXT_SIZE,
  heading: 32,
  title: 64,
  display: 128,
};

/** `properties.textStyle` — absent means `body`, which is what every text
 *  node made before the ladder existed says, and it stays correct. */
export const TEXT_STYLE_PROP = "textStyle";

export function textStyleOf(item: Item): TextStyle {
  const raw = item.properties[TEXT_STYLE_PROP];
  return isTextStyle(raw) ? raw : "body";
}

export function isTextStyle(value: unknown): value is TextStyle {
  return typeof value === "string" && (TEXT_STYLES as readonly string[]).includes(value);
}

/** World-unit size of a node's words. */
export function textSizeOf(item: Item): number {
  return TEXT_STYLE_SIZE[textStyleOf(item)];
}

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
export const TEXT_FACES = ["sans", "mono", "serif", "hand"] as const;
export type TextFace = (typeof TEXT_FACES)[number];

export const TEXT_FACE_STACK: Record<TextFace, string> = {
  sans: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
  serif: 'ui-serif, Georgia, "Times New Roman", serif',
  // The fallbacks are what a reader sees offline, or before the swap lands.
  // They are the split `cursive` argued about above: not the same tone as
  // each other, but both nearer to handwriting than the sans would be.
  hand: 'Caveat, "Bradley Hand", "Segoe Print", cursive',
};

/**
 * How much bigger a face has to be drawn to hold the ladder's promise.
 *
 * The ladder says a step is readable down to a named zoom, and that promise
 * is about the SIZE OF A LETTER, not the number in the CSS. Caveat has a much
 * smaller x-height than a UI sans, so `hand` at 16 reads like sans at 13 and
 * would quietly sit a rung lower than the control claims. Multiplying it back
 * up keeps every step meaning what the tooltip says it means, on every face.
 */
export const TEXT_FACE_SCALE: Record<TextFace, number> = {
  sans: 1,
  mono: 1,
  serif: 1,
  hand: 1.25,
};

/** The world-unit size to actually draw this node's words at. */
export function textDrawSize(item: Item): number {
  return Math.round(textSizeOf(item) * TEXT_FACE_SCALE[textFaceOf(item)]);
}

export const TEXT_FACE_PROP = "textFace";

export function textFaceOf(item: Item): TextFace {
  const raw = item.properties[TEXT_FACE_PROP];
  return isTextFace(raw) ? raw : "sans";
}

export function isTextFace(value: unknown): value is TextFace {
  return typeof value === "string" && (TEXT_FACES as readonly string[]).includes(value);
}

/**
 * **Below this many screen pixels, words stop being words.**
 *
 * Not a rendering nicety: at 10% zoom a body node draws forty shapes of
 * ~1.6px each, which the eye reads as a loud grey smear competing with the
 * screens it was meant to annotate. One glyph in its place is quieter AND
 * says more — that there is text here, and where.
 *
 * 5px is where latin text stops being resolvable as letters at all (8px is
 * where it becomes readable, which is the ladder's business above). The
 * canvas already keeps a rule of exactly this shape for item chrome —
 * `hasRoomForChrome` drops a label and badge when an item is too small on
 * screen — so this is that discipline reaching the words themselves.
 */
export const TEXT_LEGIBLE_PX = 5;

/** Should this node draw its words, or the mark that stands for them? */
export function textIsLegible(worldSize: number, scale: number): boolean {
  return worldSize * scale >= TEXT_LEGIBLE_PX;
}

/**
 * How big to draw the mark, in SCREEN pixels.
 *
 * It never claims more room than the node itself has. A mark bigger than the
 * thing it stands for would lie about the canvas's shape — and at a zoom
 * where forty nodes are marks, forty oversized glyphs are the same smear
 * again wearing a different hat. So it fills what the node has and stops,
 * capped so it never reads as a letter somebody typed.
 */
export const TEXT_MARK_MAX = 14;

export function textMarkSize(
  boxWidth: number,
  boxHeight: number,
  scale: number,
): number {
  const room = Math.min(boxWidth, boxHeight) * scale;
  return Math.max(1, Math.min(TEXT_MARK_MAX, room * 0.8));
}

/**
 * The name this text goes by — its first line, trimmed of markdown's own
 * furniture and capped.
 *
 * A drawing can be called "Sketch" because one drawing looks like another in
 * a list; text cannot, because the whole of what distinguishes two notes is
 * what they say. So the title is the words, which is what makes `isocan ls`
 * and a `#Title` chip worth reading.
 */
export function textTitle(body: string): string {
  // The first line with WORDS in it, not merely the first non-empty one: a
  // node opening with `###` or a rule is opening with furniture, and titling
  // it after the furniture names nothing. A line is words if it has a letter
  // or a digit anywhere.
  const hasWords = (line: string) => /[\p{L}\p{N}]/u.test(line);
  const first = body
    .split("\n")
    .map((line) => line.trim())
    .find(hasWords);
  if (!first) return "Text";
  const bare = first
    .replace(/^#{1,6}\s+/, "") // a heading is still its words
    .replace(/^[-*+]\s+/, "") // so is a bullet
    .replace(/^>\s+/, "")
    // Emphasis and code ticks, but NOT `#`: a line starting `#Roadmap` is an
    // item reference in this product, and stripping the mark would rename
    // the thing it points at.
    .replace(/[*_`]/g, "")
    .trim();
  if (!hasWords(bare)) return "Text";
  return bare.length <= 48 ? bare : `${bare.slice(0, 47).trimEnd()}…`;
}

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
export const TEXT_COLUMN: Record<TextStyle, number> = {
  body: TEXT_WIDTH,
  heading: 480,
  title: 640,
  display: 880,
};

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
export const TEXT_COLUMN_MAX: Record<TextStyle, number> = {
  body: TEXT_COLUMN.body * 2,
  heading: TEXT_COLUMN.heading * 2,
  title: TEXT_COLUMN.title * 2,
  display: TEXT_COLUMN.display * 2,
};

export function textBox(body: string, style: TextStyle = "body"): { width: number; height: number } {
  const size = TEXT_STYLE_SIZE[style];
  const lines = body.split("\n");
  const width = TEXT_COLUMN[style];
  // Roughly two characters per em at this size; the wrap is what the app will
  // do, so the guess only has to be close.
  const perLine = Math.max(1, Math.floor(width / (size * 0.5)));
  const rows = lines.reduce(
    (total, line) => total + Math.max(1, Math.ceil(line.length / perLine)),
    0,
  );
  return {
    width,
    height: Math.max(size * 2, Math.round(rows * size * 1.5) + size),
  };
}
