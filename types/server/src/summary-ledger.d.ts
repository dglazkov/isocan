import type { SummaryEntry, SummaryStats } from "../../core/src/semantic-zoom.js";
type Kind = SummaryEntry["kind"];
type Tokens = {
    inputTokens: number;
    outputTokens: number;
};
/** One thing that happened, as the ledger counts it. */
type Happened = {
    what: "call";
    kind: Kind;
    model: string;
    tokens?: Tokens;
    kept: boolean;
} | {
    what: "hit";
    kind: Kind;
    count?: number;
} | {
    what: "stale";
    count: number;
} | {
    what: "over-budget";
};
/**
 * **The cost record and the budget, for every canvas at this home.** One per
 * summaries route; `now` is the route's clock, so a test holds the day and
 * the hour.
 */
export declare class SummaryLedger {
    private readonly root;
    private readonly perHour;
    private readonly now;
    /** The load promise, so two first counts at once share one record instead of the later overwriting the earlier. */
    private readonly days;
    private readonly writing;
    private readonly spent;
    constructor(root: string, perHour: () => number, now: () => number);
    private file;
    private load;
    private read;
    /** The calls this canvas has made in the last hour, oldest first. */
    private hour;
    /** How long until this canvas may call a model again: 0 when it may now. */
    overBudget(canvasId: string): number;
    /** Spend one of the canvas's calls for the hour. Asked only after `overBudget` said 0 and every other guard passed. */
    spend(canvasId: string): void;
    /** Count what happened, in today's row, and write the record. */
    record(canvasId: string, happened: Happened): Promise<void>;
    /** One write at a time per canvas, each of the whole record as it now stands, by rename. */
    private write;
    /** The record as `GET …/summaries/stats` answers it: the last `span` days that had any, newest first, and their total. */
    stats(canvasId: string, span: number, entries: SummaryStats["entries"]): Promise<SummaryStats>;
}
export {};
