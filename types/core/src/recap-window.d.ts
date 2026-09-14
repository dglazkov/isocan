import type { LogEntry } from "./ops.js";
import type { CanvasContents } from "./model.js";
/** Shared intermediate activity counts; historical fallback names are not safe inherited output. */
export interface RecapWindow {
    /** Inclusive seq span — the address of the full-resolution entries. */
    fromSeq: number;
    toSeq: number;
    /** Timestamps of the span's first and last entries. */
    fromTs: string;
    toTs: string;
    count: number;
    /** Most active first, by op count. */
    actors: Array<{
        name: string;
        ops: number;
    }>;
    /** thread.create + thread.reply — conversation is worth its own number. */
    comments: number;
    /** Items touched in this span, most touched first. Title is the item's
     * current one when it still exists, the op's own when the op carried one,
     * and null for an item that is gone and was never named in the span. */
    items: Array<{
        id: string;
        title: string | null;
        ops: number;
    }>;
}
/** Shared deterministic activity counting for full recaps and safe inherited heads. */
export declare function summarizeRecapWindow(entries: LogEntry[], canvas: CanvasContents | null | undefined): RecapWindow;
