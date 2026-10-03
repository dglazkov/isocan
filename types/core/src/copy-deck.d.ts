import { type CopyBudget } from "./copy-fit.js";
/**
 * **The copy deck: a screen's words as data** (copy-edit phase 1 —
 * `docs/projects/copy-edit/phases.md`, design `docs/research/2026-10-02-copy-edit.md`
 * §"The upgrade" point 1).
 *
 * An agent had no verb for "replace this text": `isocan edit` uploads a whole
 * new file, so a copy pass could and did drift layout, classes and markup.
 * The deck is the missing primitive. `copyDeck(html)` reads a screen and
 * returns its strings in reading order, each with a ROLE (what kind of words
 * these are), a stable ADDRESS, and a BUDGET (the room its role gives it —
 * lines when rendered, characters before; `copy-fit.ts`, phase 4 — measured
 * against where screens render). `applyCopyDeck`
 * writes edited strings back and touches nothing else: every byte outside the
 * addressed text is the byte that was there.
 *
 * **Two kinds of screen, two kinds of address.**
 *
 * - **Any HTML** (`kind: "html"`). A text node is `t<n>` — the nth text node
 *   in document order, the SAME count the WYSIWYG splice uses
 *   (`packages/web/src/lib/textPatch.ts`, `TextEdit.ordinal`), so the two
 *   address one node identically (`packages/web/test/textpatch.test.ts`
 *   holds them equal). An attribute string is `a<n>@<name>` — the nth element
 *   (textPatch's `AttrEdit.ordinal`) and the attribute. An address is never
 *   trusted alone: an edit carries the `text` it read, and if the node at that
 *   address no longer says it, the edit is REFUSED by name — a deck made from
 *   an older file is refused, never guessed.
 * - **A wireframe** (`kind: "wire"`). Its rendered text is not its words:
 *   one row reads "Shared with 2 people · Archived · 5 h ago", which is three
 *   words (`sub`, `status`, `meta`) joined by the renderer; the avatar's "CA"
 *   is derived from a person's name; and a re-render from the embedded spec
 *   would undo any splice of the HTML. So a wire screen's address is the
 *   `wire copy` word path — `title`, `bar`, or `<slot>/<path>` such as
 *   `main.3/items.0.title` — read from the spec the screen carries, exactly
 *   the paths `blockContentSchema` and `wire copy --apply` take. That is the
 *   ONE canonical address for wire screens; `wf` beside it names the
 *   `data-wf` element the words draw in, for a person or a highlighter. The
 *   wire deck is written by the wireframe module (it re-renders), never
 *   spliced here.
 *
 * Core cannot import the wireframe module, so the word walk is repeated (in
 * `wire-words.ts`) the way `diff.ts` repeats the marker; `packages/modules/wireframe/test/copy-deck.test.ts`
 * holds this deck's paths equal to `wordsOf` on rendered screens.
 */
type CopyRole = "heading" | "body" | "button" | "link" | "label" | "placeholder" | "alt" | "error" | "empty" | "nav";
interface CopyString {
    /** Where the string lives: `t14`, `a3@placeholder` (HTML) or
     *  `main.3/items.0.title`, `title`, `bar` (wire). */
    address: string;
    role: CopyRole;
    /** What it says now — leading and trailing whitespace trimmed (and kept
     *  in place on apply). This is also the check an edit carries back. */
    text: string;
    /** The room its role gives it: line boxes when rendered, characters before
     *  (`copy-fit.ts`). The renderer measures against it (copy-edit phase 4). */
    budget: CopyBudget;
    /** The nearest `data-wf` element the string draws in, when the screen has one. */
    wf?: string;
}
/** A screen's words as data: every string in reading order with its role and
 *  stable address, and whether the screen is plain HTML or a wireframe. */
export interface CopyDeck {
    kind: "html" | "wire";
    strings: CopyString[];
    /** A wireframe still drawing bars has no words yet: `wire flesh` fills it. */
    unfleshed?: true;
}
/** One edited string: its address, what it said when read (the check), and what it should say. */
export interface CopyEdit {
    address: string;
    text: string;
    to: string;
}
type CopyApplyOutcome = {
    ok: true;
    html: string;
    changed: string[];
} | {
    ok: false;
    reason: string;
};
/** A screen's strings in reading order, each with a role, an address and a budget. */
export declare function copyDeck(html: string): CopyDeck;
/**
 * Check a set of edits against a deck: every address exists, every `text`
 * is what the string says now, no address twice. Returns the edits that
 * change something, or the refusal — naming WHICH string, in words.
 */
export declare function checkCopyEdits(deck: CopyDeck, edits: readonly CopyEdit[]): {
    ok: true;
    edits: CopyEdit[];
} | {
    ok: false;
    reason: string;
};
/**
 * Write edited strings into a plain-HTML screen: each addressed text node or
 * attribute value is replaced, its surrounding whitespace kept, and every
 * other byte of the file is the byte that was there. All or nothing — one
 * stale address refuses the whole set. A wireframe is refused: its words are
 * its spec's, and the wireframe module writes them (`wireCopyFile`).
 */
export declare function applyCopyDeck(html: string, edits: readonly CopyEdit[]): CopyApplyOutcome;
/**
 * **The same edits on an item's visual face** — the inlined-assets HTML some
 * versions carry beside their source. It must hold the same words in the same
 * order (same text, same role, string by string), and then each edit lands on
 * the face's string at the same place in the deck; otherwise it is refused
 * rather than guessed. `isocan words --apply`, `words vary` and *Vary the
 * copy…* all reword a face through here.
 */
export declare function applyCopyDeckToFace(deck: CopyDeck, faceHtml: string, edits: readonly CopyEdit[]): CopyApplyOutcome;
/** The `wire copy --apply` file a set of wire edits is: `{ title?, bar?, slots: { slot: { path: words } } }`. */
interface WireCopyFile {
    title?: string;
    bar?: string;
    slots: Record<string, Record<string, string>>;
}
/**
 * Turn checked wire edits into the file `wire copy --apply` takes — the
 * one writer of a wireframe's words. Checked against the screen's deck first,
 * so a stale string is refused here exactly as it is on plain HTML.
 */
export declare function wireCopyFile(html: string, edits: readonly CopyEdit[]): {
    ok: true;
    file: WireCopyFile;
    changed: string[];
} | {
    ok: false;
    reason: string;
};
/**
 * Read an apply file: the deck as `isocan words <item> --json` printed it, with a
 * `to` beside each string that should change — or a bare array of
 * `{ address, text, to }`. Strings without a `to` are left alone.
 */
export declare function parseCopyEdits(raw: unknown): CopyEdit[];
export {};
