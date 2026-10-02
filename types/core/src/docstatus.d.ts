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
type DocState = (typeof DOC_STATES)[number];
interface DocStatus {
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
    /**
     * The GitHub issue that follows this doc's work, by number. The doc is the
     * argument and the plan; the issue is where the work is followed and where
     * it is closed. One number, here, so the roadmap can link it and a test can
     * find a doc that owes work and has nowhere it is being followed.
     */
    issue?: number;
}
/**
 * The `key: value` lines of a front matter block, quotes stripped. ONE reader:
 * status, and the Loop findings beside it, both go through this, so two files
 * that say the same thing in the same way are read the same way.
 */
export declare function frontMatterFields(front: string): Map<string, string>;
/**
 * Read the front matter, or say there is none. A doc without it is not
 * malformed — it is untriaged, which is `open`, and the roadmap counts it.
 */
export declare function docStatus(text: string): DocStatus;
/**
 * **What needs a person, said in the walk that needs one.**
 *
 * `docs/verify/` is the queue of things built and shipped that no human being
 * has exercised. Its table used to be hand-kept in the README — a copy of what
 * each walk's own `**Status:**` line already said — and the roadmap did not
 * show it at all, so "what do we need people to test" had no answer anywhere a
 * reader would look first. Each walk now carries this in front matter, read by
 * the same reader as `docStatus`, and the roadmap opens with the result.
 */
declare const VERIFY_STATES: readonly ["unverified", "works", "broken"];
type VerifyState = (typeof VERIFY_STATES)[number];
interface VerifyStatus {
    /** No front matter, or an unrecognised word, is `unverified` — a typo must
     *  never take a walk off the list of things nobody has run. */
    status: VerifyState;
    /** When the status was last true. */
    since?: string;
    /** What the person needs in hand: a microphone, a phone, three people. */
    needs?: string;
    /** What has never been exercised, in one line. */
    never?: string;
    /** For `broken`, the bug; otherwise the work the walk belongs to. */
    issue?: number;
}
/** Read a walk's front matter — through the same reader as `docStatus`. */
export declare function verifyStatus(text: string): VerifyStatus;
/** The ways a walk's front matter can fail the person about to run it. */
export declare function verifyProblems(walk: VerifyStatus): string[];
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
export {};
