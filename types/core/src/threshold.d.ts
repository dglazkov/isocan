/**
 * **The house rule for turning a judge's probability into "act" or "don't"**
 * — measured, never chosen. Two callers, so it lives here: the voice fast
 * path's shadow report (`talk/src/fastpath-report.ts`, voice-agent phase 6,
 * where it was born) and the local judge's route comparison (local-judge
 * phase 1, `scripts/local-judge/harness.mjs`).
 *
 * The rule is the fast path's (`fast-path.md`, *The threshold is measured*):
 * the lowest cut at which what is kept agrees with the truth at least
 * `target` of the time on at least `minN` cases. Cuts are tried only at
 * observed values, so a threshold is always a number that occurred. No cut
 * qualifies → null, and the act stays with the slower path.
 *
 * Pure, no Node: a browser may import it.
 */
/** One bin of a reliability curve: its p range, how many fell in it, their mean p and how often they were right. */
export interface Bin {
    lo: number;
    hi: number;
    n: number;
    meanP: number;
    accuracy: number;
}
/** Ten equal-width bins of `p` against how often it was right, and the count-weighted gap (ECE). */
export declare function reliability(points: Array<{
    p: number;
    right: boolean;
}>, bins?: number): {
    bins: Bin[];
    ece: number;
};
/**
 * **The lowest cut at which what is kept agrees ≥ `target` of the time on
 * ≥ `minN` cases.** Cuts are tried at every observed p, so the answer is a p
 * that occurred; null when no cut qualifies.
 */
export declare function thresholdFor(points: Array<{
    p: number;
    right: boolean;
}>, target?: number, minN?: number): {
    cut: number;
    n: number;
    accuracy: number;
} | null;
/** A two-part cut: the winning probability AND its margin over the runner-up must both clear it. */
export interface MarginCut {
    /** Winning probability at or above this. */
    p: number;
    /** Winner minus runner-up at or above this. */
    margin: number;
    /** Cases kept at this cut, and how often they were right. */
    n: number;
    accuracy: number;
}
/**
 * **The same rule over two numbers** — the winning probability and its
 * margin over the runner-up (local-judge `design.md`, *The policy layer*).
 * Every observed margin is tried as the margin cut, and under each the
 * lowest qualifying p cut is found exactly as `thresholdFor` finds it; of
 * the pairs that qualify, the one that keeps the most cases wins (ties: the
 * lower p cut, then the lower margin cut — the least strict). Null when no
 * pair qualifies.
 */
export declare function thresholdWithMargin(points: Array<{
    p: number;
    margin: number;
    right: boolean;
}>, target?: number, minN?: number): MarginCut | null;
/** Does a case clear the cut? Null cut: nothing is accepted. */
export declare function accepts(cut: Pick<MarginCut, "p" | "margin"> | null, x: {
    p: number;
    margin: number;
}): boolean;
/**
 * **Wilson's 95% interval for k right out of n** — the interval a proportion
 * from a few dozen cases needs, because the normal one runs past 0 and 1
 * exactly where these numbers live. `[0, 1]` for n = 0.
 */
export declare function wilson(k: number, n: number, z?: number): {
    lo: number;
    hi: number;
};
