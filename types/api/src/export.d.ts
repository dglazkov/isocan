import type { Actor, Canvas, ExportManifest, ExportedCanvas, ExportedItem, Item, LogEntry } from "../../core/src/index.js";
import { type DaemonRoutes } from "./routes.js";
/**
 * **Reading a canvas out of a home and writing it down; handing it back.**
 *
 * The pure half — what a target means, which blobs a log names, what a file
 * is called — is `@isocan/core`'s `export.ts`. This is the half that needs a
 * client and a disk, and it lives here rather than in the CLI so a script on
 * `connect()` can back a canvas up without parsing argv.
 *
 * Nothing here talks to the daemon's store. Every byte comes through the
 * same routes any client uses — `oplog`, `oplog/archive`, `canvas`, the blob
 * GET — which is what lets `isocan export https://isocan.io/p/<id>` read a
 * canvas at a home this machine has never replicated, on the badge the door
 * hands out. If you may see it, you may back it up.
 */
export interface ExportOptions {
    /** The directory to write into. Created if absent; re-used if present —
     * blobs are content-addressed, so a second run over the same directory
     * fetches only what is new. */
    out: string;
    /** Say what would be written, and write nothing. */
    dryRun?: boolean;
    /** Who ran it, for the manifest. */
    by?: Actor;
    /** Progress, one line at a time. */
    say?: (line: string) => void;
}
export interface ExportReport {
    out: string;
    from: string;
    dryRun: boolean;
    canvases: ExportedCanvas[];
    items: ExportedItem[];
    /** Everything this run wrote, relative to `out` — what a commit adds. */
    written: string[];
}
/** The whole record, archive first, one seq order — `tail --archived`'s
 * contract, deduplicated by seq in case the two ever overlap. */
export declare function wholeLog(client: DaemonRoutes, canvasId: string): Promise<LogEntry[]>;
/**
 * Back up whole canvases. For each: the record, the folded snapshot and
 * trash (derived, but what `cat` and a hand-copy restore want), the whole
 * log verbatim, and every blob the log names — including bytes behind a
 * version that is no longer current, and behind an undone add.
 */
export declare function exportCanvases(client: DaemonRoutes, canvases: readonly Canvas[], options: ExportOptions): Promise<ExportReport>;
/**
 * Back up one item: its record, every version's bytes, the threads pinned to
 * it, and the entries of the log that name it. Not a canvas — it does not
 * restore through `import` — but everything somebody would want back if the
 * item were the thing they cared about.
 */
export declare function exportItem(client: DaemonRoutes, canvas: Canvas, item: Item, options: ExportOptions): Promise<ExportReport>;
export declare function readManifest(out: string): Promise<ExportManifest | null>;
export interface ImportOptions {
    dryRun?: boolean;
    /** Restore only this canvas id from the export. */
    only?: string;
    say?: (line: string) => void;
}
export interface ImportedCanvas {
    id: string;
    title: string;
    entries: number;
    /** Blobs in the export, and how many of them landed. */
    blobs: number;
    uploaded: number;
    /** Blob hashes the home would not take, with its reason. */
    failed: Array<{
        hash: string;
        error: string;
    }>;
}
export interface ImportReport {
    dir: string;
    to: string;
    dryRun: boolean;
    restored: ImportedCanvas[];
    /** Canvases the home refused — most often because it already has one
     * under that id. A restore creates, never merges. */
    refused: Array<{
        id: string;
        title: string;
        error: string;
    }>;
}
/** The canvas directories an export holds — from disk, not the manifest, so
 * a hand-assembled directory (or one whose manifest was lost) still restores. */
export declare function exportedCanvasIds(dir: string): Promise<string[]>;
/**
 * Hand a backup to a home, the way teleport's far end receives one: the log
 * verbatim through `adopt` — same seqs, same timestamps — and then the bytes.
 *
 * **The log first, and the order is forced rather than chosen.** Teleport
 * sends bytes first so an item never exists without its picture; the blob
 * route 404s for a canvas the home has not got, so a restore cannot. The
 * window in which an item is there and its bytes are not is the seconds
 * between the two calls, and the report says which blobs did not land.
 *
 * **Creates, never merges.** `adopt` refuses a canvas the home already holds,
 * and that refusal is reported per canvas rather than thrown, so a home
 * export with one canvas already restored still restores the others.
 */
export declare function importExport(client: DaemonRoutes, dir: string, options?: ImportOptions): Promise<ImportReport>;
