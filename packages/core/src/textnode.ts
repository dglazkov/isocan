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
export const TEXT_STYLE_LABEL: Record<TextStyle, string> = {
  body: "S",
  heading: "M",
  title: "L",
  display: "XL",
};

/** A step from what somebody typed — its name or its label, either case —
 *  or null, so the caller can refuse with the list rather than guess. */
export function textStyleFrom(value: string): TextStyle | null {
  const wanted = value.trim().toLowerCase();
  return TEXT_STYLES.find((s) => s === wanted || TEXT_STYLE_LABEL[s].toLowerCase() === wanted) ?? null;
}

/** `properties.textStyle` — absent means `body`, which is what every text
 *  node made before the ladder existed says, and it stays correct. */
export const TEXT_STYLE_PROP = "textStyle";

export function textStyleOf(item: Item): TextStyle {
  const raw = item.properties[TEXT_STYLE_PROP];
  return isTextStyle(raw) ? raw : "body";
}

function isTextStyle(value: unknown): value is TextStyle {
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

function isTextFace(value: unknown): value is TextFace {
  return typeof value === "string" && (TEXT_FACES as readonly string[]).includes(value);
}

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
export const PAPERS = ["yellow", "pink", "blue", "green", "grey"] as const;
export type Paper = (typeof PAPERS)[number];

export const PAPER_PROP = "paper";

/** The paper this node is written on, or null for none — a plain text node. */
export function paperOf(item: Item): Paper | null {
  const raw = item.properties[PAPER_PROP];
  return isPaper(raw) ? raw : null;
}

export function isPaper(value: unknown): value is Paper {
  return typeof value === "string" && (PAPERS as readonly string[]).includes(value);
}

/**
 * The patch that puts a note on paper or takes it off — one place, so the app
 * and the CLI cannot spell the property two ways.
 *
 * Clearing uses `removeProperties`, because `properties` MERGES: an unpaper
 * that quietly left the value on would leave the note yellow forever. Same
 * shape, and the same reason, as `slidePatch`.
 */
export function paperPatch(
  paper: Paper | null,
): { properties: Record<string, string> } | { removeProperties: string[] } {
  return paper === null ? { removeProperties: [PAPER_PROP] } : { properties: { [PAPER_PROP]: paper } };
}

/**
 * **How big a note starts, and why it is a square rather than a line.**
 *
 * A physical post-it's constraint is what makes it useful: it will not hold
 * an essay, so it holds an idea. A note that grows to fit its text is a text
 * node with a background — the shape is doing no work. So paper starts square
 * and a drag overrides it, like any other item.
 */
export const PAPER_SIZE = 220;

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
const TEXT_LEGIBLE_PX = 5;

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

/**
 * **The box must err large, never small.** A text node is chromeless, so a
 * box with room to spare is invisible; a box a line short crops the words,
 * because the node's overflow is hidden on purpose (a scrollbar the size of
 * a sentence is worse). The first estimate counted half an em per character
 * and wrapped by character, and at the big steps that is exactly wrong: a
 * title is a few long words, a word does not break, and "Onboarding" at 128
 * is wider than the count said. Agents write titles from the terminal, where
 * nothing measures, so the guess is the box — and it was cropping them.
 *
 * So this wraps the way the browser will: by WORD, with a width per glyph
 * by its class (an `m` is not an `i`, a capital is wider than either),
 * scaled by the face the way the app draws it, with the stylesheet's own
 * line-height and padding, a paragraph's margin, and a tenth on top. The
 * width is what the words need — a three-word title gets a three-word box,
 * which is what the app's composer commits — never narrower than the
 * longest word (up to the step's hard limit) and never wider than the column
 * for prose.
 */
const LINE_HEIGHT = 1.5;
/** `.item.textnode .md-view` padding: 4px top and bottom, 6px each side. */
const PAD_Y = 8;
const PAD_X = 12;
/** `.md-view p` margin, collapsed between paragraphs, in em. */
const PARAGRAPH_GAP = 0.35;
/** The margin of error a guess owes, so it is wrong on the roomy side. */
const SLACK = 1.1;
/** The browser's own `ul` padding: 40px, a fixed number in world units. */
const LIST_INDENT = 40;
/** `.md-view h1`'s fixed size — the largest a heading is drawn at. */
const HEADING_PX = 18;

/** Advance width of one character, in em, for a UI sans — the classes that
 *  matter, not a font table. `mono` is one width; the app scales `hand`. */
function glyphEm(ch: string, face: TextFace): number {
  if (face === "mono") return 0.6;
  // Georgia sets wider than a UI sans, by about a twentieth.
  const wide = face === "serif" ? 1.06 : 1;
  if (ch === " ") return 0.28 * wide;
  if (/[iljtfI!.,;:'|]/.test(ch)) return 0.3 * wide;
  if (/[mwMW@%]/.test(ch)) return 0.9 * wide;
  if (/[A-Z]/.test(ch)) return 0.7 * wide;
  if (/[0-9]/.test(ch)) return 0.56 * wide;
  if (/[a-z]/.test(ch)) return 0.55 * wide;
  return 0.6 * wide;
}

/** Markdown's furniture takes no width on the canvas: the marker of a
 *  heading or a list item, emphasis and code ticks. */
function bareLine(line: string): string {
  return line
    .replace(/^\s{0,3}(#{1,6}\s+|[-*+]\s+|\d+[.)]\s+|>\s?)/, "")
    .replace(/[*_`~]/g, "")
    .trim();
}

export function textBox(
  body: string,
  style: TextStyle = "body",
  face: TextFace = "sans",
): { width: number; height: number } {
  const size = TEXT_STYLE_SIZE[style] * TEXT_FACE_SCALE[face];
  const column = TEXT_COLUMN[style];
  const hardMax = TEXT_COLUMN_MAX[style];

  let rows = 0;
  let widest = 0;
  let gaps = 0;
  let wrapped = false;
  let lastBlank = true;
  // Rows a heading adds beyond a line: the stylesheet sets headings at a
  // fixed 18px with margins, which at body size is more than a line and at
  // the big steps is less — counted as a line and a half either way.
  let extra = 0;
  let listed = false;
  for (const raw of body.replace(/\r/g, "").split("\n")) {
    const line = bareLine(raw);
    if (line === "") {
      // A blank line ends a paragraph; the next one pays a margin.
      if (!lastBlank) gaps += 1;
      lastBlank = true;
      continue;
    }
    // A paragraph after a blank line pays the margin once, however many
    // blank lines sat between them.
    lastBlank = false;
    // A list item is indented by the browser's own 40px, whatever the size,
    // and a list keeps its margins where a first or last paragraph loses
    // them — so the first list line pays a paragraph's gap at both ends.
    const indent = /^\s{0,3}([-*+]|\d+[.)])\s+/.test(raw) ? LIST_INDENT : 0;
    if (indent && !listed) {
      listed = true;
      extra += (PARAGRAPH_GAP * 2) / LINE_HEIGHT;
    }
    // A heading is drawn at the stylesheet's fixed 18px, which at the body
    // step is LARGER than the words around it — so its width is measured at
    // that size, or it wraps a word early and the box is a row short.
    const heading = /^\s{0,3}#{1,6}\s+/.test(raw);
    if (heading) extra += 0.6;
    const lineSize = heading ? Math.max(size, HEADING_PX) : size;
    const em = (text: string) => [...text].reduce((w, ch) => w + glyphEm(ch, face), 0) * lineSize;
    // Wrap by word at the column, the way the browser will; a word longer
    // than the column widens the box, up to the hard limit, past which the
    // stylesheet breaks it (`overflow-wrap: anywhere`).
    let lineRows = 1;
    let run = indent;
    for (const word of line.split(/\s+/)) {
      const w = Math.min(em(word), hardMax - PAD_X - indent);
      const spaced = run === indent ? run + w : run + em(" ") + w;
      if (run > indent && spaced > column - PAD_X) {
        lineRows += 1;
        wrapped = true;
        run = indent + w;
      } else {
        run = spaced;
      }
      widest = Math.max(widest, run, indent + w);
    }
    rows += lineRows;
  }
  // One row of margin for a gap that is followed by nothing would be paid
  // to no paragraph; a trailing blank line costs nothing.
  const paragraphs = Math.max(0, gaps - (lastBlank ? 1 : 0));
  // Prose that wrapped settles at the column, the way the composer's mirror
  // does; a label takes the width its words need.
  const width = wrapped
    ? Math.max(column, Math.min(hardMax, Math.round(widest * SLACK + PAD_X)))
    : Math.round(Math.min(hardMax, Math.max(size * 2, widest * SLACK + PAD_X)));
  const height = Math.round(
    (Math.max(1, rows) + extra) * size * LINE_HEIGHT * SLACK + paragraphs * size * PARAGRAPH_GAP + PAD_Y,
  );
  return { width, height };
}
