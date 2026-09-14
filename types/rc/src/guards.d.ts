/**
 * The dispatch guards (agents-on-demand phase 5), moved out of
 * `packages/cli/src/rc.ts` unchanged when the room became a module
 * (docs/projects/room/design.md). `rc.ts` re-exports them, so
 * `packages/cli/test/guards.test.ts` tests this code through its old path.
 */
/**
 * **The dispatch guards, as arithmetic** (phase 5). This function is the
 * whole decision — the ceiling, the cycle guard, the announce-once rule —
 * pulled out of the rc's loop so it can be tested as what it is: pure
 * bookkeeping over timestamps and a counter. The loop's job is only to
 * gather the inputs and obey the verdict. (The first version lived inline
 * and was "tested" by a four-process cascade that flaked on every loaded
 * CI box — an end-to-end pretending to be a unit test, as the first person
 * to watch it fail put it.)
 *
 * State is mutated in place the way the loop already owned it:
 * - `dispatch`: push `now` to turnTimes, set the chain (person word resets
 *   it), clear any hold.
 * - `hold-cycle`: no timer — only a person's word lifts it (the caller
 *   dispatches again when `hasPersonWord` makes the verdict change).
 * - `hold-ceiling`: `retryAfter` says when the sliding window frees.
 * - `announce` is true exactly once per hold: the refusal is said where
 *   people look, not once per lap.
 */
export interface GuardState {
    /** Turn-start times inside the sliding hour. */
    turnTimes: number[];
    /** Consecutive turns whose batch held no person's word. */
    agentChain: number;
    /** The limit currently holding this agent's batch, if any. */
    held: "ceiling" | "cycle" | null;
}
export interface GuardLimits {
    turnsPerHour: number;
    agentChain: number;
}
export type GuardVerdict = {
    verdict: "dispatch";
} | {
    verdict: "hold-cycle";
    announce: boolean;
} | {
    verdict: "hold-ceiling";
    announce: boolean;
    retryAfter: number;
    freesAt: number;
};
export declare function gateTurn(state: GuardState, hasPersonWord: boolean, limits: GuardLimits, now: number): GuardVerdict;
