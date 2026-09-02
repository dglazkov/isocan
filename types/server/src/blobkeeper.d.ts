import type { Engine } from "./engine.js";
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
interface BlobKeeperOptions {
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
interface BlobKeeper {
    stop: () => Promise<void>;
}
export declare function startBlobKeeper(options: BlobKeeperOptions): BlobKeeper;
export {};
