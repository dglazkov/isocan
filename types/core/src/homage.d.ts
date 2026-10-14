/**
 * **An agent named after somebody's work, and the two rules that keep it
 * from being named after somebody** — one copy, for every module that names
 * one.
 *
 * Written first as half of design-competition's `packProblems` (11 Sep
 * 2026), where the nine fighter packs are homages to living designers. When
 * critics arrived (`docs/projects/critique/design.md` §1, 14 Oct 2026) the
 * same names had to pass the same check as canvas items, from a module that
 * must not depend on the competition. So the rule moved here, pure, and both
 * import it: a refusal worded one way for a pack and another for a critic is
 * a rule two people would argue about.
 *
 * - **The principle leads.** The agent's name is words — letters, digits and
 *   spaces — because its first word is how a mention finds it.
 * - **Never the person.** No word of three letters or more is shared with
 *   the person it is after, unless the person made it of themselves (`self`).
 * - **Not affiliated.** The line that names the person says so, in those
 *   words, unless it is `self`.
 */
/** What one homage is checked on — read off a pack record or a critic item. */
interface HomageName {
    agentName: string;
    /** Who it is after: "Jony Ive & Apple". */
    person: string;
    /** The line that must say "not affiliated" — a pack's homage, a critic's credit. */
    affiliation: string;
    /** Somebody made it of themselves, so their own name is theirs to carry. */
    self?: boolean;
}
/** How a refusal names what it is about — "fighter" and "the homage line",
 *  or "critic" and "the credit line". */
interface HomageWords {
    noun: string;
    subject: string;
    line: string;
}
/**
 * **What is wrong with an homage's name**, in sentences — empty when it may
 * stand. The sentences are the competition's own, with the noun swapped.
 */
export declare function homageNameProblems(h: HomageName, words: HomageWords): string[];
/**
 * **Two agents whose names begin with the same word.** Mentions resolve by
 * first word, so `@Road` must mean one agent: the second in the list is the
 * one refused, and says whose word it took.
 */
export declare function firstWordClashes(list: readonly {
    id: string;
    agentName: string;
}[]): {
    id: string;
    problem: string;
}[];
export {};
