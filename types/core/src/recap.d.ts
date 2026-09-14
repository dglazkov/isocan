import type { LogEntry } from "./ops.js";
import type { CanvasContents } from "./model.js";
import { type RecapWindow } from "./recap-window.js";
/**
 * The canvas's history at decaying resolution.
 *
 * An agent joining a canvas today reads `comment list` and `activity` and
 * forms its own impression, every time, from scratch. A recap is that
 * impression precomputed from the record both clients already hold: the most
 * recent operations verbatim, and everything older rolled up into windows
 * that double in size the further back they reach — so a thousand-op history
 * is a screenful, and every line carries the seq range that flies you to the
 * real entries (`tail`, and the archive behind it).
 *
 * The tiers are an INDEX into the history, not a replacement for it — the
 * same principle that keeps `gc` archiving rather than deleting (see
 * docs/research/2026-08-24-headlong.md). Nothing here summarizes what cannot
 * be re-read at full resolution.
 *
 * Pure over `LogEntry[]`, so it lives in core: the CLI renders it as text
 * today, and any other surface can render the same structure tomorrow.
 */
interface Recap {
    /** Every entry considered, archive included. */
    total: number;
    /** How many of those came from the archive rather than the live log. */
    archived: number;
    /** Oldest first; each window is half the resolution of the one after it. */
    windows: RecapWindow[];
    /** The last `verbatim` entries, untouched — recency deserves full detail. */
    recent: LogEntry[];
}
interface RecapOptions {
    /** How many recent entries stay verbatim (default 10). */
    verbatim?: number;
    /** Count of entries (a prefix of `entries`) that came from the archive. */
    archived?: number;
    /** Current state, for naming items the ops only reference by id. */
    canvas?: CanvasContents | null;
}
/**
 * `entries` is the full history, oldest first — the archive (if any) followed
 * by the live log. The most recent `verbatim` entries pass through untouched;
 * behind them, windows of `verbatim*2`, `verbatim*4`, … entries are each
 * summarized to one `RecapWindow`, so resolution halves with each step back
 * and the whole past fits in O(log n) lines. The oldest window absorbs
 * whatever remains rather than leaving a stub.
 */
export declare function buildRecap(entries: LogEntry[], options?: RecapOptions): Recap;
export {};
