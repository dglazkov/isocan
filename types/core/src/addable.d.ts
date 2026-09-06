/**
 * **One door for everything you bring onto a canvas.** The rail had three
 * add buttons and the terminal four verbs for one act — files, a site, a
 * Google Doc, a canvas — and every one of them asked the person to name
 * the kind before showing the thing, when the thing already says what it
 * is. This reads what was given and says what it would become; the person
 * confirms, or picks the row they meant. Both surfaces classify here, so
 * the app's field and `isocan add` cannot disagree about a paste.
 *
 * The order is the order of confidence. A Google Doc address is the most
 * specific shape and cannot be anything else. A canvas address names a
 * canvas at a home. A canvas THIS home knows — by id, or by exactly one
 * title match — is a canvas only when the words could not be a site (no
 * scheme, no dot): "Lake House" is a canvas, "lakehouse.io" is a site. Any
 * other address is a site. Anything else is words to search canvases with.
 */
export type AddKind = "file" | "site" | "doc" | "canvas";
export type Addable = {
    kind: "doc";
    id: string;
    url: string;
} | {
    kind: "canvas";
    canvasId: string;
    origin: string | null;
    title: string | null;
} | {
    kind: "site";
    url: string;
} | {
    kind: "search";
    query: string;
} | {
    kind: "empty";
};
/** Does this read as an address rather than words — a scheme, a localhost,
 *  or a dotted host with no spaces. */
export declare function looksLikeSite(input: string): boolean;
export declare function classifyAddable(input: string, canvases: readonly {
    id: string;
    title: string;
}[], 
/** The canvas being added to — never offered as a card of itself. */
selfId?: string): Addable;
/** The line under the field: what pressing Enter would do. */
/**
 * Which of the four rows a pending add is ABOUT — the pill to light while the
 * field reads the way it currently reads.
 *
 * The row that is lit and the row that is PINNED are deliberately different
 * questions. Pinning narrows the reading (`adding`); this only reports it, so
 * a field left on "any" can still show what Enter would do without giving up
 * the classifier that makes one field able to take anything. `search` lights
 * Canvas because searching your canvases is what Canvas means here, and
 * `empty` lights nothing: the field is not about anything yet, and the
 * preview line says so in words.
 *
 * `file` is never returned. Files arrive by drop or by the picker, never by
 * being typed, so no `Addable` classifies as one — that pill is only ever lit
 * by being chosen.
 */
export declare function addableKind(a: Addable): AddKind | null;
export declare function addableWords(a: Addable): string | null;
