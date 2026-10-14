/**
 * **The rc half of the enrolment record, as types** (docs/projects/room/design.md).
 *
 * The row is what the room reads to run an agent; where the rows are kept is
 * the host's. On the laptop that is `~/.isocan/rc-agents.json`, written by
 * `packages/cli/src/rc.ts`, which re-exports these types so its importers keep
 * their paths.
 */
export interface RcAgentRow {
    canvasId: string;
    actorId: string;
    /** The name at enrolment, for saying so without a registry round trip.
     * The registry stays the authority on names. */
    name: string;
    /** How to start a session — the enrolling caller's harness, a flag, or
     * null for "not yet said"; phase 3 reads it. */
    harness: string | null;
    /** The model this agent is pinned to (`--model`, e.g. claude-opus-5-5),
     * handed to its harness by `adapterFor`; absent or null runs the harness's
     * own default. */
    model?: string | null | undefined;
    /** Where the agent's sessions run. The agent verb takes no --dir: this is
     * always where the enrolling caller already stood. */
    cwd: string;
    /** The ACP resume handle, once phase 3 mints one. Null until then. */
    sessionId: string | null;
    /**
     * **What one run of this agent may spend** (critique phase 1) — the
     * persona's `PersonaBudget`, written at enrolment by whoever enrolled it
     * (a critic's card, today). A row with a budget is run-scoped: a **run** is
     * the turns one thread summons (in the Chat, one person's message), each
     * run starts a fresh session, and the room stops it at either cap and says
     * so in the thread. Absent: the agent is bounded only by the room's limits.
     */
    budget?: {
        turnsPerRun?: number;
        usdPerRun?: number;
    } | undefined;
    /** Private compare-and-restore token while enrolment is being published. */
    preparationId?: string;
}
