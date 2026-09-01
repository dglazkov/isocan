import type { Engine } from "./engine.ts";

/**
 * **Are this replica's bytes where the ops that name them went — checked on a
 * clock, rather than when somebody notices.**
 *
 * A blob is not an Operation, so it does not replicate: `Engine.putBlob`
 * pushes it to the home by hand. Anything that stops that push leaves the op
 * replicated and the bytes behind, in silence — a teammate opens the canvas
 * and gets the item, its title and its version number, with "blob not found"
 * where the screen should be. It never repairs itself, because nothing ever
 * notices.
 *
 * `Engine.reconcileBlobs` has been able to answer this since the first time
 * it happened. What it could not do is ASK on its own: it ran only when a
 * person typed `isocan blobs`, which means it ran only after somebody had
 * already been shown a broken screen. That is a repair, not resilience.
 *
 * It happened again the night before a talk — two slides, on two canvases,
 * written in the three minutes before the home restarted for a deploy. The
 * bytes were on the laptop the whole time. Nothing was lost; it simply needed
 * somebody to think to ask.
 *
 * **Safe to run at any time and safe to run twice**, which is what makes a
 * timer the right shape: it changes no Operation and touches no history. It
 * is two copies of the same content-addressed bytes being made to agree.
 *
 * Homes are skipped, not swept: a home IS where the bytes live, so there is
 * nothing for them to be behind.
 */
export interface BlobKeeperOptions {
  engine: Engine;
  /** Canvas id → the home it belongs to, or null when this daemon is it.
   *  Read fresh each sweep so a canvas bound after boot is covered. */
  assignments: () => Record<string, string | null>;
  intervalMs: number;
  /** The first sweep, which is the one that catches whatever was lost while
   *  this daemon was NOT running — the shape that produced the report. */
  firstSweepMs?: number;
  log?: (message: string) => void;
}

export interface BlobKeeper {
  stop: () => Promise<void>;
}

export function startBlobKeeper(options: BlobKeeperOptions): BlobKeeper {
  const log = options.log ?? ((message: string) => console.log(message));
  let stopped = false;
  let timer: NodeJS.Timeout | null = null;
  let inFlight: Promise<void> = Promise.resolve();

  const sweep = async () => {
    try {
      const replicas = Object.entries(options.assignments())
        .filter(([, home]) => home !== null)
        .map(([canvasId]) => canvasId);
      let pushed = 0;
      let behind = 0;
      for (const canvasId of replicas) {
        // Checked between canvases as well as before the loop: a shutdown
        // must not have to wait out a large home, and a canvas is the
        // natural boundary — the same rule the GC sweeper follows.
        if (stopped) return;
        try {
          const report = await options.engine.reconcileBlobs(canvasId, { push: true });
          if (report.pushed.length > 0) {
            pushed += report.pushed.length;
            behind += 1;
          }
        } catch {
          // One canvas failing is not the sweep failing. A home that is down
          // answers `unknown` rather than `missing` anyway, so the next sweep
          // asks again and nothing is pushed at it on the strength of a
          // question nobody could answer.
        }
      }
      // Silent when there was nothing behind, which is almost every sweep. A
      // line per idle pass is a line nobody reads, and a log nobody reads is
      // one that hides the line that matters.
      if (pushed > 0) {
        log(
          `isocan: sent ${pushed} blob${pushed === 1 ? "" : "s"} that had fallen behind ` +
            `on ${behind} canvas${behind === 1 ? "" : "es"}`,
        );
      }
    } catch (err) {
      log(`isocan: blob check failed: ${(err as Error).message}`);
    }
  };

  if (options.intervalMs <= 0) return { stop: async () => {} };

  const arm = (delayMs: number) => {
    timer = setTimeout(() => {
      inFlight = sweep().finally(() => {
        if (!stopped) arm(options.intervalMs);
      });
    }, delayMs);
    // Never the reason this process stays up — only the reason it does a
    // chore while it is up.
    timer.unref();
  };
  arm(options.firstSweepMs ?? Math.min(options.intervalMs, 60_000));

  return {
    stop: async () => {
      // Set first: it stops the re-arm inside a sweep already running and
      // cuts the canvas loop short at the next boundary.
      stopped = true;
      if (timer) clearTimeout(timer);
      timer = null;
      // The sweep in flight uploads bytes, so shutdown must not race past it.
      await inFlight;
    },
  };
}
