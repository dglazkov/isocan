import type { CopyDeck, CopyEdit } from "./copy-deck.js";
import { type CopyVoice } from "./copy-voice.js";
import type { JsonSchema } from "./jev.js";
import type { CanvasContents, Item } from "./model.js";
import type { NewVersion, Operation } from "./ops.js";
/**
 * **Copy variants: N voices for one screen's words** (copy-edit phase 2 —
 * `docs/projects/copy-edit/phases.md`, design point 2 of
 * `docs/research/2026-10-02-copy-edit.md`, journey scenes 1 and 6).
 *
 * A variant is a whole-screen set of string edits with a short STANCE ("plain
 * and direct", "warm") and one line of WHY. It lands as an ordinary
 * `/variation` child — an `item.add` carrying `parent=<source>` — whose file is
 * the source with only those strings changed (`applyCopyDeck` for plain HTML,
 * the wireframe module's renderer for a wire screen). So *Choose this
 * variation*, `isocan choose`, `isocan diff --source` and undo all work
 * unchanged, and there is no new op.
 *
 * **One generation call for N voices, not N calls.** Asking once for all N is
 * what keeps the stances distinct (a model asked three times for "a voice"
 * writes the same voice three times), and it spends one of the text route's
 * thirty a minute rather than N. The answer is checked here, purely, before
 * anything lands: every address must be one the deck has, every string must
 * stay the shape its role allows, and the stances must be N different ones.
 * The same check takes an agent's own file (`isocan words vary --from`), so a
 * written voice and a generated one are held to one rule.
 */
/** One voice: what it is trying, why, and the strings it changes. */
interface CopyVariant {
    stance: string;
    why: string;
    edits: CopyEdit[];
}
/** The property a copy variant carries its stance in, and its one line of why. */
export declare const COPY_STANCE_PROP = "copyStance";
/** The property a copy variant carries its one-line reason in. */
export declare const COPY_WHY_PROP = "copyWhy";
/**
 * `lineage.ts`'s `parent` property and `placement.ts`'s `PLACEMENT_GAP`,
 * spelled here rather than imported — and the item ids come from the caller —
 * so this file imports no value from core's barrel. Both clients load it
 * lazily, and a barrel module shared with a lazy file is carved out of the
 * eager code into a chunk of its own: measured 2 Oct 2026, importing `ids`,
 * `lineage` and `placement` here put two more modules on `isocan --version`'s
 * load (`test/cli-bundle.test.ts` holds that under 40). `copy-variants.test.ts`
 * holds both equal to the originals.
 */
export declare const VARIANT_PARENT_PROP = "parent";
/** The space left between a source and the variants stacked under it. */
export declare const VARIANT_GAP = 40;
/** At most this many voices in one ask: past six they stop being different. */
export declare const MAX_COPY_VARIANTS = 6;
/**
 * The one question N voices are: a prompt naming every string with its role
 * and address, and a schema that asks for exactly `n` variants whose edits
 * can only name addresses the deck has. `brief` is what the person asked for
 * ("shorter, for a first-time buyer"); `voice` is the product's own (the
 * governing DESIGN.md's Voice section, `copy-voice.ts`) — both optional.
 */
export declare function copyVariantsRequest(deck: CopyDeck, n: number, brief?: string, voice?: CopyVoice | null, scope?: FlowScope): {
    prompt: string;
    schema: JsonSchema;
};
/**
 * Hold an answer — a model's, or an agent's file — to the variant rules:
 * `{ variants: [{ stance, why, edits: [{ address, to }] }] }`, exactly `n` of
 * them when `n` is given, distinct stances of at most five words, a why, and
 * edits that name strings the deck has, keep each string inside its role's
 * shape, and change at least one word — and, given the product's `voice`,
 * write no banned glossary form or avoided word the string did not already
 * say (phase 4). Refused in words, naming the variant and the string. The edits come back as `CopyEdit`s carrying the deck's
 * current text — the check `applyCopyDeck` refuses a moved screen by.
 */
export declare function checkCopyVariants(deck: CopyDeck, raw: unknown, n?: number, voice?: CopyVoice | null): {
    ok: true;
    variants: CopyVariant[];
} | {
    ok: false;
    reason: string;
};
/** What `copyVariantsRequest` says differently when the deck is a flow's. */
interface FlowScope {
    screens: number;
    titles: string[];
}
/** One screen's share of a flow deck: its id, its title, and its own deck. */
export interface FlowDeckScreen {
    itemId: string;
    title: string;
    deck: CopyDeck;
}
/** The flow's strings as one deck, each address `<itemId>::<address>`, screens in the order given. */
export declare function flowCopyDeck(screens: ReadonlyArray<FlowDeckScreen>): CopyDeck;
/** A flow voice's edits, each screen's own again, keyed by item id; a screen the voice leaves alone has no entry. */
export declare function splitFlowEdits(edits: readonly CopyEdit[]): Map<string, CopyEdit[]>;
/**
 * **Placeholder voices, said as what they are** — what lands when no text
 * model was reachable (no key on this machine, `text-unavailable` from the
 * home). The screen's headings, buttons and links (else its first string)
 * read "Placeholder heading B", under a stance that says "Placeholder": the
 * whole path — variants, compare, choose, undo — can be walked, and nobody
 * mistakes the filler for written copy. In the variant shape, so it passes
 * the same check a model's answer does.
 */
export declare function placeholderCopyVariants(deck: CopyDeck, n: number): {
    variants: Array<{
        stance: string;
        why: string;
        edits: Array<{
            address: string;
            to: string;
        }>;
    }>;
};
/**
 * **The ops that put N variants on the canvas** — one `item.add` each, what
 * `isocan add --prop parent=<source>` sends, so a copy variant is a
 * `/variation` child by the one convention there is (`lineage.ts`). Each is
 * the source's size, titled with its stance, carrying the stance and why as
 * properties, stacked directly under the source and any child already there,
 * in the source's group when it has one; `itemId` is the caller's
 * (`newItemId()`). Both surfaces send exactly these,
 * under one group: one undo takes all N back.
 */
export declare function copyVariantOps(canvas: CanvasContents, source: Item, made: ReadonlyArray<{
    itemId: string;
    variant: CopyVariant;
    version: NewVersion;
    properties?: Record<string, string>;
}>): Array<Extract<Operation, {
    type: "item.add";
}>>;
/**
 * **A source's copy variants**: its `parent=` children that carry a stance —
 * what *Vary the copy…* and `words vary` made — top to bottom, as they stack
 * under it. A layout variation made with `/variation` is a child too, but not
 * a voice, and is left out: the mix is words, so only voices are offered.
 */
export declare function copyVariantsOf(canvas: CanvasContents, sourceId: string): Item[];
/** One variant, read: its item id, its stance, and its deck. */
interface CopyMixVariant {
    itemId: string;
    stance: string;
    deck: CopyDeck;
}
/** One string some voice says differently: the source's words, and each variant's (in the variants' order). */
interface CopyMixRow {
    address: string;
    role: string;
    source: string;
    /** Each variant's words for this string — the source's when it kept them. */
    variants: Array<{
        itemId: string;
        text: string;
    }>;
}
/**
 * **The rows of a mix** — one per string that differs in any variant, in the
 * source's reading order. A variant must still line up with the source string
 * for string (same addresses, same roles, in order): one made from an older
 * file, or edited by hand into a different screen, is refused by name rather
 * than mixed by guesswork — the same rule `applyCopyDeck` holds an address to.
 */
export declare function copyMixRows(source: CopyDeck, variants: readonly CopyMixVariant[]): {
    ok: true;
    rows: CopyMixRow[];
} | {
    ok: false;
    reason: string;
};
/**
 * **A mix, as one edit set on the source.** `picks` maps a string's address to
 * the variant whose words it takes (a variant's item id); a string left out —
 * or picked from the source itself — keeps the source's words. The edits carry
 * the source's current text, so `applyCopyDeck` (or a module's writer) still
 * refuses a screen that moved. Refused in words: an address no row has, a
 * variant that is not one of these, a pick of a voice that kept that string,
 * and a mix that changes nothing.
 */
export declare function copyMixEdits(source: CopyDeck, variants: readonly CopyMixVariant[], picks: Readonly<Record<string, string>>, sourceId?: string): {
    ok: true;
    edits: CopyEdit[];
} | {
    ok: false;
    reason: string;
};
/**
 * **The ops a mix sends, in order** — `convergeOps`'s shape with a new file in
 * place of the winner's: the mixed words as one new version of the source,
 * then every variant to the trash. The caller sends them under ONE group, so
 * one ⌘Z takes the version back and brings the variants out of the trash.
 * Both surfaces send exactly these (`isocan words mix`, *Use this mix*).
 */
export declare function copyMixOps(sourceId: string, version: NewVersion, variantIds: readonly string[]): Operation[];
export {};
