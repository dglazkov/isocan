/**
 * **Fit: does a string have the room its role allows?** (copy-edit phase 4 —
 * `docs/projects/copy-edit/phases.md`, design point 4 of
 * `docs/research/2026-10-02-copy-edit.md`, journey scene 3.)
 *
 * A copy variant can be good words and still not fit: *Warm*'s button reads
 * "Let's get you all set up and ready", and in the real screen that is two
 * lines in a one-line button. A model cannot see that from the source; only
 * the renderer can. So the check is split the way the rest of the copy work
 * is: the MEASUREMENT happens where screens render (the web's compare frames
 * count each string's line boxes and whether its box overflows), and the RULE
 * — given what was measured and the string's role, does it fit, and if not,
 * why, in words — is here, pure, so every surface says the same sentence.
 *
 * A role's budget has two halves. `lines` is the most line boxes the role may
 * take when rendered (a button gets one; body copy is unbounded). `chars` is
 * the most characters a string of that role may be before anything is
 * rendered — the bound a copy variant is held to when it is written
 * (`checkCopyVariants`), and the only fit a surface with no renderer can
 * honestly report (`isocan words lint`, said as a character count).
 *
 * The mark is a fact, not a refusal: a person can still take the string that
 * does not fit (journey scene 3).
 */
/** The room a role gives its words: line boxes when rendered (null: unbounded), and characters before. */
export interface CopyBudget {
    lines: number | null;
    chars: number;
    /** The role is one line of source text: no line breaks in the words themselves. */
    oneLine: boolean;
}
/** The budget a role gives — body copy's for a role this file does not know. */
export declare function copyBudget(role: string): CopyBudget;
/** What the renderer measured for one string: its line boxes, and whether its box overflows (or clips) it. */
interface CopyMeasure {
    lines: number;
    overflow: boolean;
}
/** Whether one string fits, and when it does not, why — in words. */
type CopyFit = {
    fits: true;
} | {
    fits: false;
    why: string;
};
/**
 * **The fit rule.** A string does not fit when its box overflows it (the
 * words spill past, or are clipped at, the edge the layout gave them), or
 * when it wraps past the lines its role allows. Said the way the journey says
 * it: "two lines in a one-line button".
 */
export declare function copyFit(role: string, measured: CopyMeasure): CopyFit;
/**
 * The fit a surface without a renderer can report: characters against the
 * role's `chars`. Never called a measurement — the sentence says it is a count.
 */
export declare function copyFitByCount(role: string, text: string): CopyFit;
export {};
