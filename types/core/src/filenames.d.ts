/**
 * Item names and the files under them.
 *
 * An item has a title (what people call it) and its version has a filename
 * (what it is called when it leaves the canvas — `isocan get`, a download, the
 * blob on disk). Renaming an item should move both, or the name you gave it on
 * the canvas is not the name you get in your Downloads folder.
 *
 * Blobs are content-addressed, so two files sharing a name collide nowhere on
 * disk — but they collide in every place a person reads them, which is reason
 * enough to keep them apart.
 */
import type { CanvasContents } from "./model.js";
/** The extension, dot included, or "" — the part a rename must not touch. */
export declare function extensionOf(filename: string): string;
/**
 * **A title as the stem of a filename** — "Crème brûlée" → `creme-brulee`,
 * "東京 タワー" → `東京-タワー` — or `""` when nothing in it can name a file,
 * so each caller keeps its own fallback ("document", "deck", the old name).
 *
 * The one rule (cleanup DU-2, 27 Sep 2026). There were six: this function's
 * own, which decomposed accents and never removed the marks, so a mark
 * mid-word became a hyphen (`cre-me-bru-le-e`, and "データ" became `テ-ータ`);
 * and five ASCII copies — a placed Google Doc, a deck download, two wireframe
 * paths, a template agent's directory — that dropped an accented letter
 * outright (`caf`) and made any non-Latin title the fallback.
 *
 * Decompose, take the marks off LATIN letters only, recompose: an accent on
 * a Latin letter is decoration a filename can lose, but a dakuten or a
 * Devanagari vowel sign is part of the letter, and dropping it spells a
 * different word. "Latin" is spelled as everything below U+0250 rather than
 * `\p{Script=Latin}`, and the mark as `[\p{M}]` rather than `\p{M}`: the web
 * build lowers either of those to a `new RegExp`, which the entry chunk pays
 * for. After `NFKD` every accented Latin letter's base is below U+0250, and
 * nothing else there carries a mark worth keeping. `NFKD` also folds compatibility forms (full-width `Ａ`, the `ﬁ`
 * ligature, `№`). `ascii` is for a name whose grammar is ASCII — a fighter
 * pack's id — and folds the same accents before refusing the rest. `max`
 * counts characters, never splits one, and leaves no trailing hyphen.
 */
export declare function titleSlug(title: string, { max, ascii }?: {
    max?: number;
    ascii?: boolean;
}): string;
/**
 * A title as a filename: "Bass tab v2" → "bass-tab-v2.svg". Keeps the old
 * extension, because renaming a drawing does not make it a different kind of
 * file. A title with nothing usable in it (an emoji, say) keeps the old stem
 * rather than becoming a bare extension.
 *
 * Only a rename calls this, so a filename already on the canvas is never
 * re-derived: the DU-2 rule reaches an item the next time it is renamed.
 */
export declare function filenameFromTitle(title: string, previous: string): string;
/**
 * `candidate`, or the next free "<stem>-2.<ext>" if it is taken. Case is not
 * the difference between two names: macOS would agree, and so would a person.
 */
export declare function uniqueFilename(candidate: string, taken: Iterable<string>): string;
/** Every filename in use on this canvas, ignoring one item — the one being
 * renamed does not collide with itself. */
export declare function filenamesInUse(canvas: CanvasContents, exceptItemId?: string): string[];
/** The filename a rename should land on: derived from the title, then moved
 * aside if the canvas is already using it. */
export declare function renamedFilename(canvas: CanvasContents, itemId: string, title: string, previous: string): string;
