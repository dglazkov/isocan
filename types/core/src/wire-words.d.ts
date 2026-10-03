/**
 * **A wireframe's words, read from its spec alone** — no HTML parser, so the
 * browser can carry it inside the wireframe module's lazy half without a
 * parser chunk riding along (copy-edit phase 1's open bug: the stage's
 * in-place text edit on a wire screen, 2 Oct 2026).
 *
 * `copy-deck.ts` builds a wire screen's deck on these (adding reading order
 * and roles, which need the rendered markup); the wireframe module's web
 * writer (`packages/modules/wireframe/src/web-copy.ts`) uses them to name the
 * word a clicked node draws and to check an edit against the screen as it is
 * now. Core cannot import a module, so the word walk repeats the module's
 * `wordsOf`; `packages/modules/wireframe/test/copy-deck.test.ts` holds the
 * two equal.
 */
/** The parts of a `WireSpec` that carry words (core cannot import the module's type). */
export interface WireSpecWords {
    title?: string;
    slots?: Array<{
        slot: string;
        block: string | null;
        fill?: unknown;
    }>;
    content?: {
        title?: string;
        bar?: string;
    } & Record<string, unknown>;
}
/** One word on a wire screen: its `wire copy` path, what it says, and the `data-wf` element it draws in. */
interface WireWord {
    address: string;
    text: string;
    wf?: string;
}
/** The words a wire slot's fill holds, by path — the wireframe module's
 *  `wordsOf` (`content/flesh-spec.ts`), repeated because core cannot import a
 *  module; its test holds the two equal. */
export declare function wireWordsOf(fill: unknown): Array<[string, string]>;
/** Every word a fleshed wire screen has, in spec order: the title, the bar when it has one, then each slot's — the copy deck's strings without their order or roles. */
export declare function wireWords(spec: WireSpecWords): WireWord[];
/** Where a rendered text node sits on a wire screen: its section's `data-sec`, its nearest `data-wf`, and what it says. */
interface WirePlace {
    slot?: string;
    wf?: string;
    text: string;
}
/**
 * **Which word a rendered text node draws**, or why it is not one word of
 * its own — the stage's in-place text edit on a wireframe.
 *
 * The node's section names the slot, and the node must say exactly one of
 * that slot's words; its nearest `data-wf` breaks a tie (an action's label
 * against a body word). Text that is none of its slot's words is the
 * screen's title or bar. Anything else is refused in a sentence rather than
 * guessed: a node that joins several words ("sub · status · meta"), the same
 * words twice in one place, initials drawn from a name, an icon.
 */
export declare function wireWordAt(spec: WireSpecWords, place: WirePlace): {
    ok: true;
    address: string;
    text: string;
} | {
    ok: false;
    reason: string;
};
/**
 * Turn word edits into the copy file `wire copy --apply` takes, checked
 * against the spec as it is NOW: every address must be a word the screen
 * has and still say what the edit read — a screen that moved under the edit
 * is refused by name, as the copy deck refuses it.
 */
export declare function wireCopyFor(spec: WireSpecWords, edits: ReadonlyArray<{
    address: string;
    text: string;
    to: string;
}>): {
    ok: true;
    file: {
        title?: string;
        bar?: string;
        slots: Record<string, Record<string, string>>;
    };
    changed: string[];
} | {
    ok: false;
    reason: string;
};
export {};
