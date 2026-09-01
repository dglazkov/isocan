import type { CanvasContents } from "./model.js";
/**
 * #item-references — comments pointing at items on the canvas. Like
 * @-mentions, a reference is resolved at AUTHORING time against the items the
 * author can see and stored structurally on the comment as item ids; renderers
 * re-derive spans from the same candidate matching to draw them as chips that
 * fly the reader to the item.
 *
 * Titles are free-form, so matching is candidate-driven like mentions: at
 * each "#" every live item is tried — by full title (case-insensitive) or by
 * exact id, longest first. Unlike names, titles get no first-token shorthand:
 * "#Design" should not swallow half of "Design notes". The "#" must start a
 * word, and a markdown heading's "# " never matches because titles are
 * offered trimmed. An item deleted after being referenced simply stops
 * matching — the text degrades to plain prose, the same way a renamed
 * @-mention does.
 */
/** A referable item. Offer one entry per live item; trashed items are not
 * destinations. */
export interface ItemRefCandidate {
    id: string;
    title: string;
}
/** Where a reference sits in the body — what renderers turn into a chip. */
export interface ItemRefSpan {
    /** Index of the "#". */
    start: number;
    /** Index just past the matched title (or id). */
    end: number;
    /** The referenced item. */
    itemId: string;
    /** The title (or id) as written, without the "#". */
    text: string;
}
/**
 * Every item reference in `body`, in text order, non-overlapping. At each "#"
 * the longest matching candidate wins, so "#Design notes" is one span rather
 * than a bare "#Design" over a shorter-titled item.
 */
export declare function findItemRefSpans(body: string, candidates: ItemRefCandidate[]): ItemRefSpan[];
/** Item ids referenced in `body`, in candidate order, deduped. */
export declare function extractItemRefs(body: string, candidates: ItemRefCandidate[]): string[];
/** One candidate per live item, under its title and its id. */
export declare function collectItemRefCandidates(canvas: CanvasContents): ItemRefCandidate[];
