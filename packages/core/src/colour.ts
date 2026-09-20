/**
 * **The colours a person says out loud, and when the canvas is allowed to
 * claim one.**
 *
 * "Move the red one next to the blue one" is the sentence
 * `docs/research/2026-09-19-move-the-red-one.md` is named for, and it is
 * unanswerable today for a reason that is data, not modelling: **`Item` has no
 * colour field.** Colour exists in exactly two honest places — a stroke's
 * `Stroke.color`, which is a hex string, and a paper/tint property, which is
 * already a word — plus one dishonest one, a card's rendered face, which is
 * pixels and nothing else.
 *
 * So this file does two separable jobs and refuses a third:
 *
 * 1. **A hex becomes a spoken word** (`spokenColour`), over a CLOSED set.
 * 2. **An item answers for itself** (`itemColour`), and answers `null`
 *    whenever the data does not actually say — which is most items.
 * 3. It does **not** look at pixels. A dominant colour derived from a
 *    screenshot needs a decoder the standing harness does not have and the
 *    browser does, and a colour that exists on one surface and not the other
 *    forks the one wording `canvasSnapshotText` exists to keep. Half of "red"
 *    is worse than none.
 *
 * ## Why the set is closed
 *
 * The same argument `EXTENSION_ICONS` makes about icons, applied to words.
 * CSS has 148 named colours and one of them is `darkslategrey`, which nobody
 * has ever said to another person. A spoken referent is drawn from a handful
 * of words, and a closed set is the only one a test can enumerate and a model
 * can be told the whole of. Eleven words: the English basic colour terms
 * minus the ones this canvas has no way to distinguish.
 */

import { parseHex } from "./contrast.ts";
import type { InkStroke } from "./drawing.ts";
import { PAPER_PROP, isPaper } from "./textnode.ts";
import { AREA_TINT_PROP } from "./area.ts";

/**
 * **The whole vocabulary.** Every colour word this canvas will ever put in
 * front of a model or take from a person's mouth. If a hex does not land in
 * one of these, it has no spoken name here and gets `null`.
 */
export const SPOKEN_COLOURS = [
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "brown",
  "black",
  "grey",
  "white",
] as const;

export type SpokenColour = (typeof SPOKEN_COLOURS)[number];

/**
 * **Where the hue wheel is cut, and why each cut is where it is.**
 *
 * Degrees, each entry claiming `[from, to)` going clockwise from red. The
 * boundaries are not evenly spaced because the colour words are not: yellow
 * is a narrow band people are fussy about (45–70 — past 70 a person says
 * "green", and 40 is already "orange"), while green and blue are wide
 * because English has one word each for a third of the wheel. Cyan and teal
 * fall to blue and lime to green deliberately: there is no word for them in
 * the set, and inventing one for the model to hear is how a closed set stops
 * being closed.
 *
 * Red wraps, so it is written as two arcs.
 */
const HUE_BUCKETS: { from: number; to: number; colour: SpokenColour }[] = [
  { from: 345, to: 360, colour: "red" },
  { from: 0, to: 15, colour: "red" },
  { from: 15, to: 45, colour: "orange" },
  { from: 45, to: 70, colour: "yellow" },
  { from: 70, to: 165, colour: "green" },
  { from: 165, to: 255, colour: "blue" },
  { from: 255, to: 320, colour: "purple" },
  { from: 320, to: 345, colour: "pink" },
];

/**
 * **Below this saturation there is no hue worth naming** — the colour is
 * black, grey or white, and which one is a question of lightness alone. 0.15
 * rather than 0 because a near-grey with a 2° tint is a grey to every eye in
 * the room, and calling `#4a4b52` "blue" is the kind of answer that makes a
 * model pick the wrong item confidently.
 */
const ACHROMATIC_SATURATION = 0.15;

/**
 * **Lightness at which hue stops being visible at all.** A saturated colour
 * this dark reads as black and this light reads as white however the maths
 * feels about its hue — `#001100` is not "green" to anybody looking at it.
 * Applied before the saturation test, because it is the stronger fact.
 */
const BLACK_LIGHTNESS = 0.07;
const WHITE_LIGHTNESS = 0.95;

/**
 * **Where grey ends.** Within the achromatic band, darker than this is black
 * and lighter than the white cut is white; the middle is grey. Deliberately
 * asymmetric: dark greys read as "black" much sooner than light greys read as
 * "white", which is why `#2b2b2b` is ink and `#dddddd` is still a grey.
 */
const NEAR_BLACK_LIGHTNESS = 0.18;
const NEAR_WHITE_LIGHTNESS = 0.85;

/**
 * **Brown is a dark orange; there is no brown hue.** This is the one bucket
 * that cannot be a wedge of the wheel, and leaving it out is why naive
 * classifiers call a wooden desk "orange". Restricted to the orange/yellow
 * arc and to the bottom of the lightness range, so a dark red stays red.
 */
const BROWN_MAX_LIGHTNESS = 0.4;

/**
 * **Pink is a light red**, the other word in the set that is a lightness of
 * another one rather than a place on the wheel. `#ffc0cb` sits at hue 350 —
 * squarely red — and is pink to everyone.
 */
const PINK_MIN_LIGHTNESS = 0.75;

/** Hue in degrees, saturation and lightness in 0..1, from 0..255 channels. */
function toHsl(rgb: { r: number; g: number; b: number }): {
  h: number;
  s: number;
  l: number;
} {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = 60 * (((g - b) / d) % 6);
  else if (max === g) h = 60 * ((b - r) / d + 2);
  else h = 60 * ((r - g) / d + 4);
  if (h < 0) h += 360;
  return { h, s, l };
}

/**
 * **A hex colour as the word somebody would say**, or `null` when the string
 * is not a hex colour at all.
 *
 * `parseHex` is `contrast.ts`'s and is reused rather than rewritten: it
 * already answers `null` for named colours and `oklch()`, which are legal in
 * `DESIGN.md` and not resolvable without a browser — an honest null rather
 * than a guess, and the same honest null wanted here.
 */
export function spokenColour(hex: string): SpokenColour | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const { h, s, l } = toHsl(rgb);
  if (l <= BLACK_LIGHTNESS) return "black";
  if (l >= WHITE_LIGHTNESS) return "white";
  if (s < ACHROMATIC_SATURATION) {
    if (l < NEAR_BLACK_LIGHTNESS) return "black";
    if (l > NEAR_WHITE_LIGHTNESS) return "white";
    return "grey";
  }
  const bucket = HUE_BUCKETS.find((b) => h >= b.from && h < b.to)?.colour ?? "red";
  if (bucket === "orange" && l < BROWN_MAX_LIGHTNESS) return "brown";
  if (bucket === "red" && l >= PINK_MIN_LIGHTNESS) return "pink";
  return bucket;
}

/**
 * **What colour a drawing is: the one its ink spends the most LENGTH in.**
 *
 * "Dominant" has to be defined or it is an opinion, and there were two
 * defensible definitions. *Most strokes* counts a dot and a scribble the
 * same, so a picture drawn in one long red line and annotated with four black
 * ticks comes out black — which is not what anybody would say about it.
 * *Most total length* is what the eye actually sees more of, and it is a pure
 * function of the points already stored, so both surfaces reach it with no
 * new data. Weighting by stroke width as well (length × width ≈ area of ink)
 * is arguably truer still and was left out on purpose: it makes a highlighter
 * pass beat the drawing under it, and it is one more thing to explain.
 *
 * Grouped by the spoken WORD rather than by the hex, because the question
 * being answered is "which one is the red one" — `#fe0201` and `#ff0000` are
 * one answer, not two. Ties break in `SPOKEN_COLOURS` order so the same
 * drawing always answers the same way.
 */
export function inkColour(strokes: readonly InkStroke[]): SpokenColour | null {
  const length = new Map<SpokenColour, number>();
  for (const stroke of strokes) {
    const word = spokenColour(stroke.color);
    if (!word) continue;
    let run = 0;
    for (let i = 1; i < stroke.points.length; i++) {
      const a = stroke.points[i - 1]!;
      const b = stroke.points[i]!;
      run += Math.hypot(b.x - a.x, b.y - a.y);
    }
    // A single-point stroke is a dot, and a dot is still ink somebody laid
    // down; zero length would make a canvas of dots answer null.
    if (stroke.points.length === 1) run = stroke.width;
    length.set(word, (length.get(word) ?? 0) + run);
  }
  let best: SpokenColour | null = null;
  let most = 0;
  for (const word of SPOKEN_COLOURS) {
    const run = length.get(word);
    if (run !== undefined && run > most) {
      best = word;
      most = run;
    }
  }
  return best;
}

/**
 * **What the canvas knows about an item's colour** — the shape of what a
 * caller can honestly hand over, and nothing wider.
 *
 * `properties` is the item's own bag, which both surfaces hold: the harness
 * lists `ListedItem` (an `Item`) and the browser holds `Item`s. `ink` is the
 * strokes of a drawing, which neither projection caller has today — the SVG
 * is a blob behind a hash on both sides — so it is optional and the answer
 * without it is `null` rather than a guess.
 */
export interface ColouredItem {
  properties?: Record<string, string> | undefined;
  ink?: readonly InkStroke[] | undefined;
}

/**
 * **An item's colour, ONLY when the data says so.**
 *
 * Three sources, in the order of how directly they mean "this item is that
 * colour":
 *
 * 1. **Ink**, when the caller has it — a drawing's dominant stroke colour is
 *    a computable fact about the picture itself.
 * 2. **A note's paper** (`textnode.ts`) — `PAPERS` is already a closed set of
 *    spoken words, and it is deliberately a background that *means nothing*,
 *    which is exactly what makes it safe to read as a colour rather than as a
 *    status.
 * 3. **An area's tint** (`area.ts`) — the same paper palette, reused there on
 *    purpose, so it costs nothing to honour here too.
 *
 * And otherwise **`null`. Never from the title** — "Red team retro" is not a
 * red item, and an item called "Blue" that is a screenshot of a spreadsheet
 * would make a model move the wrong thing and be sure it was right. A title
 * is what somebody typed; a colour is what something looks like, and the two
 * are unrelated often enough that guessing is worse than admitting.
 */
export function itemColour(item: ColouredItem): SpokenColour | null {
  if (item.ink && item.ink.length > 0) {
    const inked = inkColour(item.ink);
    if (inked) return inked;
  }
  const properties = item.properties ?? {};
  for (const key of [PAPER_PROP, AREA_TINT_PROP]) {
    const raw = properties[key];
    // `isPaper` is the palette's own guard, so a hand-written property that
    // is not a paper is not silently believed.
    if (isPaper(raw) && (SPOKEN_COLOURS as readonly string[]).includes(raw)) {
      return raw as SpokenColour;
    }
  }
  return null;
}
