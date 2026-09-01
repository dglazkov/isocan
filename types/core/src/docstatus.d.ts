/**
 * **Where a document stands, said once, in the document.**
 *
 * The roadmap was a hand-kept fourth copy of something the repo already knew:
 * `docs/projects/README.md` carries a "where it stands" column, research docs
 * carry a `**Where this stands, …**` paragraph, and an artifact outside the
 * repo restated both. Keeping three copies in step is work somebody does badly
 * or not at all, and the third copy is the one that goes stale silently
 * because nothing reads it.
 *
 * So status lives WITH the doc — it cannot drift from the thing it describes —
 * and the roadmap becomes a derivation, the same shape as every other number
 * this project trusts.
 *
 * Front matter, the shape personas already use, so there is one reader.
 */
/**
 * One vocabulary for research and for projects, because "what is left to do"
 * is one question and two lists answering it differently is how the answer
 * gets lost.
 */
export declare const DOC_STATES: readonly ["open", "designed", "noted", "partial", "built", "blocked", "superseded"];
export type DocState = (typeof DOC_STATES)[number];
export interface DocStatus {
    status: DocState;
    /** When the status was last true, as a date. A verdict with no date is a
     *  verdict nobody can age. */
    since?: string;
    /** Other docs this one belongs with — project directory names or research
     *  filenames. What makes the roadmap a graph rather than two lists. */
    see: string[];
    /** For `blocked`: what it is waiting on, in words. */
    blockedBy?: string;
    /** For `superseded`: what replaced it. */
    supersededBy?: string;
    /** One line for the roadmap, when the title is not enough. */
    note?: string;
}
/**
 * Read the front matter, or say there is none. A doc without it is not
 * malformed — it is untriaged, which is `open`, and the roadmap counts it.
 */
export declare function docStatus(text: string): DocStatus;
/** What is left, and what is done — the only two numbers a burn-down needs. */
export declare function burnDown(all: readonly DocStatus[]): {
    done: number;
    left: number;
    byState: Record<DocState, number>;
};
/**
 * **A status that says nothing is worse than no status**, so these are the
 * ways a front matter block can be wrong on its own terms. Returned rather
 * than thrown: the roadmap should be able to print a doc AND its complaint.
 */
export declare function statusProblems(doc: DocStatus): string[];
