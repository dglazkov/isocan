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
    /** Where the agent's sessions run. The agent verb takes no --dir: this is
     * always where the enrolling caller already stood. */
    cwd: string;
    /** The ACP resume handle, once phase 3 mints one. Null until then. */
    sessionId: string | null;
    /** Private compare-and-restore token while enrolment is being published. */
    preparationId?: string;
}
