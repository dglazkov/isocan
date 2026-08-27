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
export function textBox(body: string): { width: number; height: number } {
  const lines = body.split("\n");
  // Roughly two characters per em at this size; the wrap is what the app will
  // do, so the guess only has to be close.
  const perLine = Math.max(1, Math.floor(TEXT_WIDTH / (TEXT_SIZE * 0.5)));
  const rows = lines.reduce(
    (total, line) => total + Math.max(1, Math.ceil(line.length / perLine)),
    0,
  );
  return {
    width: TEXT_WIDTH,
    height: Math.max(TEXT_SIZE * 2, Math.round(rows * TEXT_SIZE * 1.5) + TEXT_SIZE),
  };
}
