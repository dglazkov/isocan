import type { Item, ItemVersion } from "./model.js";
/** What kind of comparison a pair of versions gets, from its MIME type and — for HTML — whether a wireframe spec rides inside. */
type DiffKind = "text" | "html" | "wire" | "image" | "binary";
/** What happened to one thing between the two sides. */
export type ChangeOp = "added" | "removed" | "changed" | "moved";
/**
 * Where a change sits on one side. `path` is for a reader (`html/body/main[1]/h1[1]`,
 * a wireframe's slot id, or `line 12`); `at` is the source offset where a
 * highlight attribute can be inserted into that element's start tag, which is
 * how a sandboxed frame gets marks nobody outside it could draw (`markSource`).
 */
interface DiffSpot {
    path: string;
    at?: number;
    line?: number;
}
/** One step of a diff: numbered from 1, in reading order, with a sentence and where it sits on each side. */
interface DiffChange {
    step: number;
    op: ChangeOp;
    what: string;
    before?: DiffSpot;
    after?: DiffSpot;
    /**
     * A stylesheet rule's change: the selector it styles, and on which sides
     * the rule exists. A comparison frame marks the elements it matches.
     */
    selector?: {
        selector: string;
        sides: Array<"before" | "after">;
    };
}
/** A run of words in a changed line: `changed` marks the words that differ on that side. */
export interface WordPart {
    text: string;
    changed: boolean;
}
/** One row of a side-by-side text view, aligned — so a surface draws it and never recomputes it. */
export interface TextRow {
    op: "same" | ChangeOp;
    before?: string;
    after?: string;
    beforeLine?: number;
    afterLine?: number;
    /** The change this row belongs to. */
    step?: number;
    /** On a line replaced one-for-one: which words moved. */
    words?: {
        before: WordPart[];
        after: WordPart[];
    };
}
/**
 * **The whole answer.** `summary` is the one sentence both surfaces print;
 * `changes` is the list a person steps through; `counts` are in `unit`s
 * (lines of text, elements of HTML, blocks of a wireframe, fields of a file's
 * metadata). `rows` only for text. `note` says what this comparison cannot
 * see, out loud — an image compared by metadata says so.
 */
export interface VersionDiff {
    kind: DiffKind;
    unit: string;
    identical: boolean;
    summary: string;
    counts: Record<ChangeOp, number>;
    changes: DiffChange[];
    rows?: TextRow[];
    note?: string;
}
/** One side of a comparison: the version's facts, and its text when the kind is textual. */
export interface DiffSide {
    mimeType: string;
    filename: string;
    size: number;
    blobHash?: string;
    text?: string;
}
/**
 * Whether a version's bytes are worth reading as text to compare. Both
 * surfaces ask before they fetch, so an image is never downloaded to be
 * compared by its size.
 */
export declare function isTextualMime(mimeType: string): boolean;
/** `v3` for the third version on the stack — how both surfaces name one to a person. */
export declare function versionLabel(item: Item, versionId: string): string;
/**
 * A version named the way a person or an agent names one: its id, an id
 * prefix, `v3`, or `3` — the same forms `get --rev` and `version promote`
 * take between them.
 */
export declare function versionRef(item: Item, ref: string): ItemVersion | null;
/**
 * **The pair a bare `diff` compares**: the version before the one showing,
 * against the one showing — "what did the last edit do". When the one showing
 * is the first, it is compared with the one after it, since there is nothing
 * before. One version is nothing to compare, and says so.
 */
export declare function defaultVersionPair(item: Item): {
    from: ItemVersion;
    to: ItemVersion;
} | {
    refused: string;
};
/**
 * **A variation against what it was made from** — the pair `choose` is about
 * to decide: the source's current version, then this item's. Refuses with the
 * same sentences `convergePlan` would, so the two doors agree about what a
 * variation is.
 */
export declare function sourcePair(items: Record<string, Item>, item: Item): {
    source: Item;
    from: ItemVersion;
    to: ItemVersion;
} | {
    refused: string;
};
/**
 * **Compare two versions.** Text arrives in `before.text`/`after.text` when
 * the kind is textual (`isTextualMime`); anything else is compared by its
 * facts. Deterministic: the same two inputs give the same steps, the same
 * offsets and the same sentence, on either surface.
 */
export declare function diffVersions(before: DiffSide, after: DiffSide): VersionDiff;
/**
 * **The terminal's rendering**: the heading, the summary, then one numbered
 * line per change. `isocan diff` prints exactly this; the web draws the same
 * `changes` as a list it can step through.
 */
export declare function diffReport(diff: VersionDiff, heading: string): string;
/** The parts of a wireframe spec a diff reads — structurally the module's `WireSpec`. */
interface WireSpecLike {
    title?: string;
    archetype?: string;
    platform?: string;
    slots?: Array<{
        slot: string;
        block: string | null;
        props?: Record<string, unknown>;
        intents?: Record<string, string>;
        fill?: unknown;
    }>;
    style?: unknown;
    content?: {
        title?: string;
        pack?: string;
    } & Record<string, unknown>;
    flip?: {
        slot: string;
        from: string;
        to: string;
    };
}
/** The spec a rendered wireframe screen carries, or null for any other HTML. */
export declare function embeddedWire(html: string): WireSpecLike | null;
/**
 * **One side's source, with the diff written into it** — the only way a
 * highlight reaches inside an `allow-scripts` frame whose origin is opaque.
 *
 * Every changed element on this side gets `data-isocan-change` and
 * `data-isocan-step` in its own start tag, at the offset the diff recorded,
 * and one `<style>` and one `<script>` go in before `</body>`. The result is a
 * string for a comparison frame's `srcdoc` and nothing else: the item and its
 * blob are never touched.
 */
export declare function markSource(html: string, diff: VersionDiff, side: "before" | "after"): string;
export {};
