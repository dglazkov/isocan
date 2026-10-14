import type { Desk } from "./desk.js";
export { parkCursorsFile } from "./paths.js";
/**
 * **The park's cursor, out of the parked process** (on-demand phase 1).
 *
 * `isocan wait` used to keep its cursor in a `let` inside the blocked
 * process: kill the process and the cursor died with it, so the next park
 * started from *now* and silently missed everything in the gap — `--since`
 * existed as the manual repair. This store is the fix: one durable row per
 * actor per canvas, held by the daemon the park polls.
 *
 * **Custody is deliberately daemon-local** (phase 1 door, decided
 * 2026-08-30). For a locally-homed canvas this daemon IS the home; for a
 * remote one it is the replica the park actually talks to — and the seqs in
 * a row are the home's seqs either way, because a replica writes them
 * verbatim (`home-link.ts`). The row is never replicated: it is reachable
 * exactly when a park can poll (the CLI's one address is 127.0.0.1, link up
 * or down), and a replacement `rc` is same-machine anyway — `cwd` and
 * harness are machine facts. Moving custody to the true home later is a
 * data move, not a semantic change.
 *
 * **One reader per row, newest adopts** (the second door). Every claim
 * mints a fresh `parkId` lease; a delivery or advance carrying a stale one
 * is refused, so a displaced park stands down at the moment it would have
 * double-delivered — never after.
 *
 * **At-least-once, never twice as new** (the third door). The row is three
 * watermarks, `cursor ≤ rehanded ≤ delivered`:
 *
 * - `cursor` — settled: handled by a turn, or noise that matched nobody.
 * - `delivered` — handed to a park at least once.
 * - `rehanded` — handed at least twice.
 *
 * A wake records `delivered` without touching `cursor`; the cursor advances
 * only when a later claim finds evidence the turn completed. The evidence,
 * in order: the actor authored an op after the delivery (the reply is the
 * proof — machine-checked, not agent-trusted), or the actor came back to
 * park after the batch was already re-handed once (a full turn with the
 * batch in hand, marked, is a turn that saw it). Absent both, the batch is
 * handed again with `redeliverUpTo` set so the park presents it marked
 * redelivered, never as new. Journey 3's acceptance is both halves at once:
 * nothing in a gap is missed, and the same comment is never new twice.
 *
 * Persisted behind `Desk` (`park-cursors.json` on `FileDesk`, Firestore
 * `parks/` on `CloudDesk`): it is not canvas state so it never goes through
 * the `Store` seam or replicates, while still surviving container restarts
 * when an agent parks directly against a hosted home.
 */
interface ParkClaim {
    parkId: string;
    cursor: number;
    redeliverUpTo: number | null;
}
export declare class ParkCursors {
    private readonly desk;
    private readonly locks;
    constructor(desk: Desk);
    private enqueue;
    /**
     * Open (and adopt) the row. `seed` supplies "now" for a first-ever park;
     * `actorSpoke` answers whether the actor authored anything after the given
     * seq — the completion evidence for an outstanding delivery.
     */
    claim(canvasId: string, actorId: string, opts: {
        since?: number | undefined;
        /** Floor for a row being CREATED — an enrolled agent's standing began
         * at its enrolment op, not at its first claim (journey 3). Ignored
         * when the row exists: it is a birth fact, never a rewind. */
        seedAt?: number | undefined;
        seed: () => Promise<number>;
        actorSpoke: (afterSeq: number) => Promise<boolean>;
    }): Promise<ParkClaim>;
    /** A wake handed entries out, up to `tip`. Records the high-water; the
     * cursor stays put until a claim finds completion. False = lease lost. */
    delivered(canvasId: string, actorId: string, parkId: string, tip: number): Promise<boolean>;
    /** A lap matched nothing: settle up to `to` without a turn. False = lease
     * lost — the one other moment a displaced park finds out. */
    advance(canvasId: string, actorId: string, parkId: string, to: number): Promise<boolean>;
}
