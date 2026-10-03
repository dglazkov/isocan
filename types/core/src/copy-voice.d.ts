/**
 * **The product's voice, read from DESIGN.md** (copy-edit phase 4 —
 * `docs/projects/copy-edit/phases.md`, design point 5 of
 * `docs/research/2026-10-02-copy-edit.md`, journey scene 4).
 *
 * DESIGN.md had sections for colour, type, layout and shape and none for
 * words (`designmd.ts`'s `DESIGN_SECTIONS`), so "Sign in" on one screen and
 * "Log in" on the next was invisible, and a copy variant had nothing to keep
 * to. A `## Voice` section is that missing half, read the way a person writes
 * it:
 *
 * ```md
 * ## Voice
 *
 * Plain and direct, second person. Say what happens.
 *
 * Use: your canvas, sign in
 * Avoid: seamless, unlock, simply
 *
 * Glossary:
 * - sign in — never log in, login
 * - canvas, not board
 * - Sign up → create an account   (banned → preferred)
 * ```
 *
 * Prose is the TONE. `Use:` / `Avoid:` / `Glossary:` (or `### Use`,
 * `### Avoid`, `### Glossary`) take a comma-separated line or the list under
 * them. A glossary line names the preferred form and the banned ones after
 * `never`, `not`, `instead of` or `rather than` — or, with an arrow, the
 * banned form first. A line it cannot read is reported in `problems`, never
 * guessed at.
 *
 * It is read by everything that writes or judges words: the variants' prompt
 * (`voicePrompt`), the variants' check (`voiceSlips` — an avoided word in a
 * new string is refused, in words), and the copy lint (`copy-lint.ts`). Pure,
 * and it takes the parsed document's sections, so it imports nothing.
 */
/** One glossary entry: the form to use, and the forms that mean the same thing and are not. */
interface GlossaryTerm {
    term: string;
    banned: string[];
}
/** A Voice section, read. */
export interface CopyVoice {
    /** The prose: how the product sounds, in a sentence or two. */
    tone: string;
    use: string[];
    avoid: string[];
    glossary: GlossaryTerm[];
    /** What could not be read, said rather than swallowed. */
    problems: string[];
}
/** One place a string breaks the voice: a banned form of a glossary term, or a word the voice avoids. */
interface VoiceSlip {
    kind: "glossary" | "avoid";
    /** The words as the string says them. */
    said: string;
    /** For a glossary slip, the form the voice uses instead. */
    preferred?: string;
}
/** Read a Voice section's body. */
export declare function parseVoiceSection(body: string): CopyVoice;
/**
 * The Voice section of a DESIGN.md, read — `parseDesign(text).sections` in,
 * null when there is none. Takes the sections, not the text, so a caller that
 * already parsed the document (every design read does) does not parse twice.
 */
export declare function voiceOf(doc: {
    sections: ReadonlyArray<{
        title: string;
        body: string;
    }>;
}): CopyVoice | null;
/** The voice as a model should read it: one block, every part named. Empty for no voice. */
export declare function voicePrompt(voice: CopyVoice | null | undefined): string;
/** Each place `text` says `p`, as it says it — whole words, any case. */
export declare function saysPhrase(text: string, p: string): string[];
/** Every place `text` breaks the voice: each banned glossary form and each avoided word it says, in the order the voice lists them. */
export declare function voiceSlips(voice: CopyVoice | null | undefined, text: string): VoiceSlip[];
/** A slip in words: `says "Log in" — the voice says "sign in"`. */
export declare function voiceSlipText(slip: VoiceSlip): string;
/**
 * The slips a NEW string adds: those in `to` that `from` did not already
 * have. A variant that keeps the source's "Log in" did not write it; one that
 * writes "Log in" over "Continue" did.
 */
export declare function newVoiceSlips(voice: CopyVoice | null | undefined, from: string, to: string): VoiceSlip[];
export {};
