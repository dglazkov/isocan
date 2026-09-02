import type { Canvas, CanvasState, GcReport, GcRequest, HomeGcReport, LogEntry } from "../../core/src/index.js";
import type { Engine } from "./engine.js";
/**
 * Garbage collection: the pure pieces of it — choosing the compaction horizon
 * and computing the reachable blob set — and, since phase 13.7, the two
 * enumerating callers that run the same policy over many canvases at once.
 * The engine wires the pure pieces to storage inside its single-writer queue.
 * Wire shapes (GcRequest/GcReport, HomeGcReport) live in @isocan/core's
 * protocol so both CLI and web speak them.
 *
 * The `Engine` import is TYPE-ONLY and must stay that way: `engine.ts` imports
 * the pure pieces below by value, so a value import here would close a cycle.
 * What the sweep actually needs is one method, and it asks for exactly that.
 */
export type GcOptions = GcRequest;
export type { GcReport };
export declare const DEFAULT_KEEP_OPS = 500;
export declare const DEFAULT_GRACE_MS: number;
/**
 * Keep the newest `keepOps` entries, then extend to a pair-complete set so
 * undo/redo never dangle across the cut:
 *  - a retained undo/redo entry pulls in its target (`cause.targetSeq`);
 *  - a retained entry that is currently undone pulls in its undoer, so the
 *    rebuilt stacks still know it is undone (otherwise it would reappear as
 *    an undo candidate whose effect is already reverted).
 * Returns entries in log order.
 */
export declare function chooseRetained(entries: LogEntry[], keepOps: number): LogEntry[];
/** The mark set: live state ∪ trash ∪ retained entries (ops and inverses). */
export declare function reachableHashes(state: CanvasState, retained: LogEntry[]): Set<string>;
/**
 * The interval an innkeeper configured, or the default.
 *
 * `ISOCAN_GC_INTERVAL_MS` — environment and configuration rather than a flag,
 * for the reason `ISOCAN_BIND` and `ISOCAN_STORE` are: how often a home
 * collects itself is innkeeper configuration, and a `--gc-interval` on `isocan
 * serve` would be a surface an agent could reach for to turn a home's
 * housekeeping off. `0` (or any non-positive number) means "do not sweep",
 * which is the only way to say it and is spelled out here rather than
 * discovered.
 *
 * A junk value falls back to the default rather than refusing to boot, for
 * `readConfigFile`'s reason: a typo in configuration must cost the setting it
 * was carrying and nothing else, and a daemon that will not start because of a
 * mistyped housekeeping interval is a worse outcome than one that sweeps
 * hourly when somebody meant every ten minutes.
 */
export declare function gcIntervalFromEnv(env?: NodeJS.ProcessEnv): number;
/**
 * Run one canvas's GC over each of `canvasIds` and add up what happened.
 *
 * **Sequentially, and a failure is a row rather than a throw.** Both are the
 * same decision from two sides: a sweep of a home is a background chore, and a
 * chore that abandons twelve canvases because the third one has an unreadable
 * oplog is a home that stays un-collected forever with nobody the wiser. So
 * the canvas that threw carries its message into the report and the sweep goes
 * on. Parallelism would buy nothing anyway — every `Engine.gc` queues on the
 * one writer chain — and would cost a burst of blob listings against the
 * object store.
 *
 * `keepGoing` is asked before each canvas so a shutdown does not have to wait
 * out a sweep of a large home; the route passes nothing and sweeps its whole
 * list. A halted sweep returns what it managed, which is true and which the
 * only caller that can halt one (the timer) is content to log.
 */
export declare function gcCanvases(engine: Pick<Engine, "gc">, canvasIds: string[], request?: GcRequest, keepGoing?: () => boolean): Promise<HomeGcReport>;
interface GcSweeperOptions {
    engine: Pick<Engine, "gc">;
    /**
     * **Every canvas this home holds** — `store.listCanvases`, not a badge's
     * admissions. The sweeper is not at the door at all: nobody is asking it for
     * anything, so there is nobody to admit. That is precisely why the timer was
     * chosen over a scheduler holding a credential — see the map's GC line.
     */
    canvases: () => Promise<Canvas[]>;
    /** Milliseconds between the end of one sweep and the start of the next;
     * `0` never sweeps at all. */
    intervalMs: number;
    /** When the FIRST sweep happens, in milliseconds after start. Defaults to
     * {@link firstSweepDelay} of the interval; injectable for the reason the
     * interval is — a proof that a short-lived home still collects cannot wait a
     * minute per test. */
    firstSweepMs?: number;
    /** Where the sweeper narrates. Stdout by default, which on a hosted home is
     * the only witness that housekeeping ran at all. */
    log?: (message: string) => void;
}
interface GcSweeper {
    /** Stop sweeping, and settle whatever sweep is already running. Idempotent,
     * and safe before the first sweep has fired. */
    stop(): Promise<void>;
}
/**
 * **How long after boot the first sweep runs: a minute, or the interval if
 * that is shorter.**
 *
 * The original was "one interval", on the argument that a daemon's slowest
 * moment is right after it starts serving and there is no new garbage yet.
 * The first half of that is still true; the second half was **wrong under the
 * deployment this ships to**, and the mechanism would never once have fired in
 * production.
 *
 * `infra/config.sh` sets `MIN_INSTANCES=0` for dev, and Cloud Run reaps an
 * idle instance roughly fifteen minutes after the last request
 * (`infra/70-cloud-run.sh` states the lifetime). An hourly timer whose first
 * tick is an hour away is a timer on a process that is reaped forty-five
 * minutes before it. Nothing would have said so: the code is right, the tests
 * are green, and the silence means "nothing to collect" — this system's
 * default answer to a wrong address, in its quietest form yet.
 *
 * A minute keeps the honest half of the original argument (boot is busy:
 * migrations, snapshot loads, home links dialling — none of which want a
 * compaction beside them) and fits inside the shortest life an instance has.
 * It is deliberately not zero for that reason, and deliberately not derived
 * from the interval, because the interval is about how often garbage is worth
 * collecting and this is about how long an instance lives.
 *
 * `Math.min` is what keeps a fast test interval fast, and it is also the
 * honest reading: a home told to sweep every ten seconds did not ask to wait a
 * minute for the first one.
 */
export declare const BOOT_SWEEP_MS: number;
export declare function firstSweepDelay(intervalMs: number): number;
/**
 * **The home collects its own garbage, on a timer inside the process**
 * (phase 13.7 — the choice the "GC schedule" entry had been leaning toward,
 * now made).
 *
 * A sweep shortly after boot ({@link firstSweepDelay} — a minute, and why it
 * cannot be an hour is the whole of that comment), then one every
 * `intervalMs` after the previous sweep FINISHES.
 *
 * **A self-rescheduling timeout, not `setInterval`, and that is a fix rather
 * than a preference.** With an interval, a tick that arrived while the
 * previous sweep was still running had to be dropped, and dropping it dropped
 * the reference to the sweep actually in flight: `stop()` then awaited an
 * already-settled promise and returned while a sweep was mid-write —
 * precisely the guarantee it exists to give. Re-arming after each sweep makes
 * overlap structurally impossible, so there is no tick to drop, and
 * `inFlight` always names the sweep that is running. It also means the spacing
 * is "an interval after the last one finished" rather than "an interval after
 * the last one started", which is the right meaning for a chore: a sweep that
 * took twenty minutes has earned its full gap.
 *
 * **Nothing here may reach an unhandled rejection.** A timer callback that
 * throws asynchronously takes the process with it under Node's default policy,
 * so a home would die of a corrupt oplog on one canvas — a crashed home in
 * exchange for a chore. Every sweep is wrapped, `gcCanvases` swallows
 * per-canvas failures into rows, and both are re-tested on the next sweep,
 * because the failure that matters most (an object store that is briefly
 * unreachable) is exactly the one that fixes itself.
 */
export declare function startGcSweeper(options: GcSweeperOptions): GcSweeper;
