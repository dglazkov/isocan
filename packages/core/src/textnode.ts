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
 * **The faces, and why there are only three of them — all from the system.**
 *
 * This repo already tried a webfont and threw it out: a display face from
 * `fonts.googleapis.com` on the critical path is exactly what the cached
 * shell exists to avoid, and it does not render offline. A canvas on
 * `127.0.0.1` must not need somebody else's server to look right.
 *
 * There is a second reason that applies only here. Text is a SHARED fact —
 * an item, versioned, in the oplog — and its box was measured on whichever
 * machine typed it. A face that resolves against locally installed fonts
 * makes the canvas render differently for different people, and overflow its
 * own box for the ones missing the font. So the set is closed, and every
 * member of it is a stack that exists everywhere.
 *
 * Three, each meaning something rather than offering a taste:
 * - `sans` — the app's own voice; a note that belongs to the interface.
 * - `mono` — commands, paths, logs. Agent-written notes are full of them,
 *   and a whole node of mono reads as machine output at a glance.
 * - `serif` — prose and quotes. Against a canvas of machine-made screens it
 *   reads as *somebody wrote this*, which nothing else here says.
 */
export const TEXT_FACES = ["sans", "mono", "serif"] as const;
export type TextFace = (typeof TEXT_FACES)[number];

export const TEXT_FACE_STACK: Record<TextFace, string> = {
  sans: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
  serif: 'ui-serif, Georgia, "Times New Roman", serif',
};

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
export function textBox(body: string, style: TextStyle = "body"): { width: number; height: number } {
  const size = TEXT_STYLE_SIZE[style];
  const lines = body.split("\n");
  // The box grows with the step: bigger words need a wider column to hold the
  // same sentence, or a title wraps every three words.
  const width = Math.round(TEXT_WIDTH * (size / TEXT_SIZE));
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
