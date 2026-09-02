import type {
  Canvas,
  CanvasState,
  GcReport,
  GcRequest,
  HomeGcCanvas,
  HomeGcReport,
  LogEntry,
  Operation,
} from "@isocan/core";
import { undoneSeqs } from "@isocan/core";
import type { Engine } from "./engine.ts";

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

export const DEFAULT_KEEP_OPS = 500;
export const DEFAULT_GRACE_MS = 10 * 60 * 1000;

/**
 * Keep the newest `keepOps` entries, then extend to a pair-complete set so
 * undo/redo never dangle across the cut:
 *  - a retained undo/redo entry pulls in its target (`cause.targetSeq`);
 *  - a retained entry that is currently undone pulls in its undoer, so the
 *    rebuilt stacks still know it is undone (otherwise it would reappear as
 *    an undo candidate whose effect is already reverted).
 * Returns entries in log order.
 */
export function chooseRetained(entries: LogEntry[], keepOps: number): LogEntry[] {
  const bySeq = new Map(entries.map((entry) => [entry.seq, entry]));

  // Final undone-state, from core: an undo marks its target undone, a redo
  // clears it. Shared with `buildCorpus` rather than spelled twice — see
  // `undoneSeqs` for why the `undoneBy` FIELD cannot be used for this.
  const undoneBy = undoneSeqs(entries);

  // Careful: slice(-0) === slice(0) would keep everything.
  const newest = keepOps <= 0 ? [] : entries.slice(-keepOps);
  const retained = new Set<number>(newest.map((e) => e.seq));
  let grew = true;
  while (grew) {
    grew = false;
    for (const seq of [...retained]) {
      const entry = bySeq.get(seq)!;
      const wants: number[] = [];
      if (entry.cause) wants.push(entry.cause.targetSeq);
      const undoer = undoneBy.get(seq);
      if (undoer !== undefined) wants.push(undoer);
      for (const want of wants) {
        if (!retained.has(want) && bySeq.has(want)) {
          retained.add(want);
          grew = true;
        }
      }
    }
  }
  return entries.filter((entry) => retained.has(entry.seq));
}

/** Every blobHash an operation can (re-)introduce. */
function hashesInOperation(op: Operation): string[] {
  switch (op.type) {
    case "item.add":
    case "item.addVersion":
    case "item.restoreVersion":
      return [op.version.blobHash];
    default:
      return [];
  }
}

/** The mark set: live state ∪ trash ∪ retained entries (ops and inverses). */
export function reachableHashes(state: CanvasState, retained: LogEntry[]): Set<string> {
  const marked = new Set<string>();
  for (const item of Object.values(state.canvas.items)) {
    for (const version of item.versions) marked.add(version.blobHash);
  }
  for (const entry of state.canvas.trash) {
    for (const version of entry.item.versions) marked.add(version.blobHash);
  }
  for (const entry of retained) {
    for (const hash of hashesInOperation(entry.envelope.op)) marked.add(hash);
    if (entry.inverse) {
      for (const hash of hashesInOperation(entry.inverse)) marked.add(hash);
    }
  }
  return marked;
}

// ---------- sweeping a whole home (phase 13.7) ----------
//
// Two callers, one policy. `POST /api/gc` is a person or an agent saying
// "collect everything I can reach"; the sweeper below is the home collecting
// its own garbage on a timer with nobody at the keyboard. Both hand a list of
// canvas ids to `gcCanvases` and both get `Engine.gc` per canvas, exactly
// as `POST /api/projects/:id/gc` has always run it. Where the two differ is
// only in where the LIST comes from, and that difference is the security
// question — it is answered at the route, not here.
//
// `gcCanvases` and not `sweepCanvases`: `sweep.ts` next door already owns that
// word for the provenance sweep, which expels a badge from a canvas. Two
// sweeps one letter apart, meaning "reclaim bytes" and "revoke a person",
// would be read wrong exactly once.

/**
 * How often a home collects itself, absent configuration: **an hour**.
 *
 * Garbage accrues only while a home is in USE — an upload that never became an
 * item, an emptied trash whose blobs have fallen past the undo horizon — so
 * the clock that matters is the instance's own uptime, not the wall calendar.
 * An hour is the honest middle of that: short enough that a busy home is never
 * carrying more than an hour of orphans, long enough that a home nobody is
 * touching spends its day doing one cheap listing per canvas and finding
 * nothing. Nothing depends on the number being exactly right — a sweep that
 * runs late collects the same bytes it would have collected on time, which is
 * the property that made the timer the right mechanism in the first place.
 *
 * This is the RHYTHM, not the first sweep — an hour after boot is longer than
 * some homes live. See {@link firstSweepDelay}.
 */
const DEFAULT_GC_INTERVAL_MS = 60 * 60 * 1000;

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
export function gcIntervalFromEnv(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.ISOCAN_GC_INTERVAL_MS?.trim();
  if (raw === undefined || raw === "") return DEFAULT_GC_INTERVAL_MS;
  const ms = Number(raw);
  return Number.isFinite(ms) && ms >= 0 ? ms : DEFAULT_GC_INTERVAL_MS;
}

function emptyTotals(dryRun: boolean): GcReport {
  return {
    dryRun,
    retainedEntries: 0,
    droppedEntries: 0,
    reachableBlobs: 0,
    reachableBytes: 0,
    sweptBlobs: 0,
    sweptBytes: 0,
    skippedRecentBlobs: 0,
  };
}

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
export async function gcCanvases(
  engine: Pick<Engine, "gc">,
  canvasIds: string[],
  request: GcRequest = {},
  keepGoing: () => boolean = () => true,
): Promise<HomeGcReport> {
  const totals = emptyTotals(request.dryRun ?? false);
  const canvases: HomeGcCanvas[] = [];
  for (const canvasId of canvasIds) {
    if (!keepGoing()) break;
    try {
      const report = await engine.gc(canvasId, request);
      canvases.push({ canvasId, report });
      totals.retainedEntries += report.retainedEntries;
      totals.droppedEntries += report.droppedEntries;
      totals.reachableBlobs += report.reachableBlobs;
      totals.reachableBytes += report.reachableBytes;
      totals.sweptBlobs += report.sweptBlobs;
      totals.sweptBytes += report.sweptBytes;
      totals.skippedRecentBlobs += report.skippedRecentBlobs;
    } catch (err) {
      canvases.push({ canvasId, report: null, error: (err as Error).message });
    }
  }
  return { canvases, totals };
}

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
export const BOOT_SWEEP_MS = 60 * 1000;

export function firstSweepDelay(intervalMs: number): number {
  return Math.min(intervalMs, BOOT_SWEEP_MS);
}

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
export function startGcSweeper(options: GcSweeperOptions): GcSweeper {
  const log = options.log ?? ((message: string) => console.log(message));
  let stopped = false;
  let timer: NodeJS.Timeout | null = null;
  let inFlight: Promise<void> = Promise.resolve();

  const sweep = async () => {
    try {
      const held = await options.canvases();
      const report = await gcCanvases(
        options.engine,
        held.map((canvas) => canvas.id),
        {},
        () => !stopped,
      );
      for (const row of report.canvases) {
        if (row.error) log(`isocan: GC failed on ${row.canvasId}: ${row.error}`);
      }
      // Silent when there was nothing to collect, which is most hours. A log
      // line per idle sweep would be an hourly line saying "0" forever, and a
      // log nobody reads is a log that hides the line that matters.
      const { sweptBlobs, sweptBytes, droppedEntries } = report.totals;
      if (sweptBlobs > 0 || droppedEntries > 0) {
        log(
          `isocan: GC swept ${sweptBlobs} blobs (${sweptBytes} bytes) and archived ${droppedEntries} oplog entries across ${report.canvases.length} canvases`,
        );
      }
    } catch (err) {
      // Listing the home failed, or something else outside any one canvas.
      // The next sweep asks again.
      log(`isocan: GC sweep failed: ${(err as Error).message}`);
    }
  };

  if (options.intervalMs <= 0) return { stop: async () => {} };

  const arm = (delayMs: number) => {
    timer = setTimeout(() => {
      inFlight = sweep().finally(() => {
        if (!stopped) arm(options.intervalMs);
      });
    }, delayMs);
    // Never the reason this process stays up — only ever the reason it does a
    // chore while it is up. Same rule as the daemon guard's watch, and the same
    // failure it avoids: a handle that outlives the thing it was serving.
    timer.unref();
  };
  arm(options.firstSweepMs ?? firstSweepDelay(options.intervalMs));

  return {
    stop: async () => {
      // Set first: it is what stops the re-arm inside a sweep that is already
      // running, and what cuts `gcCanvases` short at the next canvas boundary
      // instead of making a shutdown wait out a large home.
      stopped = true;
      if (timer) clearTimeout(timer);
      timer = null;
      // The sweep in flight is a WRITER (compaction rewrites the oplog, the
      // sweep deletes blob bytes), so `close()` must not race past it —
      // `engine.settled()` covers the work already enqueued, and this covers
      // the loop that would have enqueued more. Awaiting a settled promise is
      // the whole cost of calling this twice, or before anything has fired.
      await inFlight;
    },
  };
}
