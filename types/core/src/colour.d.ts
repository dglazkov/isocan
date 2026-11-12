/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import type { InkStroke } from "./drawing.js";
/**
 * **The whole vocabulary.** Every colour word this canvas will ever put in
 * front of a model or take from a person's mouth. If a hex does not land in
 * one of these, it has no spoken name here and gets `null`.
 */
export declare const SPOKEN_COLOURS: readonly ["red", "orange", "yellow", "green", "blue", "purple", "pink", "brown", "black", "grey", "white"];
export type SpokenColour = (typeof SPOKEN_COLOURS)[number];
/**
 * **A hex colour as the word somebody would say**, or `null` when the string
 * is not a hex colour at all.
 *
 * `parseHex` is `contrast.ts`'s and is reused rather than rewritten: it
 * already answers `null` for named colours and `oklch()`, which are legal in
 * `DESIGN.md` and not resolvable without a browser — an honest null rather
 * than a guess, and the same honest null wanted here.
 */
export declare function spokenColour(hex: string): SpokenColour | null;
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
export declare function inkColour(strokes: readonly InkStroke[]): SpokenColour | null;
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
 * **The properties a new drawing is born with, including the colour it was
 * drawn in** — the writing half of `INK_PROP`, kept beside the reading half
 * on purpose.
 *
 * `itemColour` below can only answer "red" because something wrote the word
 * down while it still had the strokes. Two callers do: the browser's Pen and
 * the live session's `drawing_add`. They had the same three lines each, which
 * is the one-string-two-spellings bug the live provider's own header warns
 * about — and the spelling that matters is a rule ("only a word in the spoken
 * vocabulary, never a hex"), not a constant.
 *
 * The CLI's two drawing paths reach it the long way round, through
 * `inkFromSvg`: they are handed an SVG rather than strokes, so the strokes are
 * read back out of the markup first. Same function, same rule, one spelling.
 */
export declare function drawingProperties(strokes: readonly InkStroke[]): Record<string, string>;
/**
 * **An item's colour, ONLY when the data says so.**
 *
 * Four sources, in the order of how directly they mean "this item is that
 * colour":
 *
 * 1. **Ink strokes**, when the caller has them — a drawing's dominant stroke
 *    colour is a computable fact about the picture itself. Reachable only by
 *    something that has already decoded an SVG, which is why 2 exists.
 * 2. **The ink colour a drawing recorded when it was made** (`INK_PROP`,
 *    written by `drawingProperties` above) — the same fact, put somewhere an
 *    ordinary `Item` can carry it. This is the ONLY route to "red": red is
 *    not a paper.
 * 3. **A note's paper** (`textnode.ts`) — `PAPERS` is already a closed set of
 *    spoken words, and it is deliberately a background that *means nothing*,
 *    which is exactly what makes it safe to read as a colour rather than as a
 *    status.
 * 4. **An area's tint** (`area.ts`) — the same paper palette, reused there on
 *    purpose, so it costs nothing to honour here too.
 *
 * And otherwise **`null`. Never from the title** — "Red team retro" is not a
 * red item, and an item called "Blue" that is a screenshot of a spreadsheet
 * would make a model move the wrong thing and be sure it was right. A title
 * is what somebody typed; a colour is what something looks like, and the two
 * are unrelated often enough that guessing is worse than admitting.
 */
export declare function itemColour(item: ColouredItem): SpokenColour | null;
