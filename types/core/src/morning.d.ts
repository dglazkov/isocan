import type { Actor, CanvasContents } from "./model.js";
import type { ActorJoins } from "./identity.js";
import { type NightNote } from "./goodnight.js";
/**
 * **The morning review** (proactive-agent phase 3, design §5).
 *
 * The person said `/goodnight`; the lead worked; now they are back. What
 * they see is DERIVED from what the night left on the canvas — the note's
 * model (`handoffNote`), the frames and proposals the lead made after it, the
 * brief it posted as a Chat `record` with `goodnight: {step: "brief", note}` —
 * so nothing has to be live at return, and the web panel and `isocan
 * goodnight review` read one answer.
 *
 * **When** (`morningDue`): only after the person's OWN goodnight, and only
 * when their seen mark (`seen.ts`) is older than that note's ready-by — they
 * have not been back since the night's work was due. No goodnight, no morning
 * review; the ordinary "While you were away" digest still shows what others
 * did. Once the review has been seen the note carries `handoffReviewed`, and
 * that closes it: no second review, and it stops holding other people's
 * goodnights off the items it named.
 *
 * **What** (`nightReview`): the brief first — one plain line when the night
 * failed or made nothing, then the lead's own words — then at most
 * `PROPOSAL_CAP` proposals, highest confidence first (sure, hunch, then the
 * promises that did not work, each with its reason), then **Left alone**
 * (what the agent saw and did not act on, with why), then every original it
 * edited because the conversation named it, with the version before.
 */
/** One proposal the night left, as the morning lists it. */
export interface MorningProposal {
    itemId: string;
    title: string;
    /** `failed` is a promise that did not work; its why is the reason. */
    state: "sure" | "hunch" | "promised" | "failed";
    why: string;
    /** A failed promise that still shows the take it would have made. */
    take: boolean;
}
/** One original the night edited because the person named it. */
interface MorningEdit {
    itemId: string;
    title: string;
    /** The version the night made, and the one before it (null when the item had none). */
    after: string | null;
    before: string | null;
    /** The edit line failed: its reason, and nothing changed. */
    failed?: string;
}
/** What the morning shows, for one person's latest goodnight. */
interface MorningReview {
    noteId: string;
    note: NightNote;
    lead: Actor | null;
    /** The lead's brief, when it posted one. */
    brief: {
        threadId: string;
        commentId: string;
        body: string;
    } | null;
    /** One plain line when the night failed or made nothing — with the reason. */
    headline: string | null;
    proposals: MorningProposal[];
    left: {
        what: string;
        why: string;
    }[];
    edited: MorningEdit[];
    reviewed: boolean;
}
/**
 * **The review of one goodnight note**, whatever the seen mark says — what
 * `isocan goodnight review` prints and the panel draws once it is due.
 */
export declare function nightReview(canvas: CanvasContents, noteId: string, now: number, joined?: ActorJoins): MorningReview | null;
/**
 * **Whether this person's morning review is due**, and for which note — or
 * why not, in words. Due when their latest goodnight note exists, has not
 * been reviewed, its night is over (ready-by passed, or the brief is posted),
 * and their seen mark is older than its ready-by: they have not been back
 * since. A missing mark (never recorded) counts as older.
 */
export declare function morningDue(canvas: CanvasContents, personId: string, mark: {
    at: string;
} | null, now: number, joined?: ActorJoins): {
    noteId: string;
} | {
    not: string;
};
/** `isocan goodnight review`'s words: the brief, the proposals, left alone, the edits. */
export declare function morningText(review: MorningReview): string;
export {};
