import type { RcAgentRow } from "./rows.js";
/**
 * **A run's budget, as arithmetic** (critique phase 1). An agent whose row
 * carries a `budget` — a critic, today — is bounded per **run**: the turns
 * one thread summons, or in the Chat (where every conversation shares one
 * thread) the turns one message summons. The room counts the turns itself,
 * because a turn is the unit it already counts (`gateTurn`'s ceiling), and
 * reads dollars from the one place a harness reports them: ACP's
 * `usage_update`, whose `cost` the adapter may or may not send. A harness
 * that sends none is bounded by turns alone, and the room says so.
 *
 * Pure: the room gathers, this decides, and the words are here so the
 * thread and the narration say the same thing.
 */
type Budget = NonNullable<RcAgentRow["budget"]>;
/** What one run has spent so far, kept under the room's state. */
export interface RunSpend {
    turns: number;
    /** Dollars the harness reported, summed over the run's turns; null while
     *  no turn has reported any. */
    usd: number | null;
    /** The run's own session — a run starts fresh, and resumes only itself. */
    session: string | null;
    /** The cap was met and the thread was told, so it is not told twice. */
    said: boolean;
}
export declare const freshRun: () => RunSpend;
/** Which run a summons belongs to: its thread, or in the Chat its message. */
export declare function runKeyOf(thread: {
    id: string;
    main?: boolean;
} | null | undefined, commentId: string | null): string;
/** Which cap a run has met, or null while it may take another turn. */
export declare function capMet(spend: RunSpend, budget: Budget): "turns" | "usd" | null;
/** "2 of 6 turns, $0.12 of $0.40" — or, with no dollars reported, the turns
 *  and the sentence that says why there is no second number. */
export declare function spendWords(spend: RunSpend, budget: Budget, harness: string): string;
/** The one line the thread reads when a run stops at its cap. */
export declare function capLine(name: string, cap: "turns" | "usd", spend: RunSpend, budget: Budget): string;
export {};
