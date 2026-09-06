import type { Actor, Canvas } from "./model.js";
import type { LogEntry } from "./ops.js";
/**
 * **A backup is the log, the bytes, and a note saying where they came from.**
 *
 * `docs/research/2026-09-01-teleport.md` established the fact this file leans
 * on: the log IS the canvas. The snapshot is a fold of it and the reducer is
 * deterministic, so a directory holding a canvas's entries verbatim and the
 * blobs they name holds the canvas — anywhere, with no daemon involved.
 * Teleport sends exactly that to another home; `isocan export` writes exactly
 * that to a directory, and `isocan import` hands it to a home again through
 * the same `adopt` route teleport arrives by.
 *
 * What is here is the part both surfaces would otherwise compute twice: what
 * an export target string means, which blobs a log names, which entries touch
 * one item, and what a blob is called on disk. Reading from a home and
 * writing files is `@isocan/api`'s; the flags are the CLI's.
 */
/** The manifest's `format` — bump when the layout changes shape. */
export declare const EXPORT_FORMAT = "isocan-export/1";
/**
 * **The layout mirrors `~/.isocan` on purpose.**
 *
 * `projects/<id>/` with `project.json`, `canvas.json`, `trash.json`,
 * `oplog.jsonl`, `blobs.json` and `blobs/<hash>.<ext>` is exactly what
 * `FileStore` keeps for a canvas (`packages/server/src/paths.ts`), so the
 * least clever restore of all — stop the daemon, copy the directory in —
 * works, and so does reading a backup with `cat`. The one departure: the
 * export's `oplog.jsonl` is the WHOLE history in seq order, what gc archived
 * included, where the daemon keeps the compacted part in a sibling file.
 */
export declare const EXPORT_LAYOUT: {
    readonly manifest: "manifest.json";
    readonly names: "names.json";
    readonly canvases: "projects";
    readonly items: "items";
    readonly record: "project.json";
    readonly snapshot: "canvas.json";
    readonly trash: "trash.json";
    readonly oplog: "oplog.jsonl";
    readonly blobIndex: "blobs.json";
    readonly blobs: "blobs";
    readonly item: "item.json";
    readonly itemOps: "ops.jsonl";
    readonly itemThreads: "threads.json";
    readonly versions: "versions";
};
/** What `manifest.json` says about one canvas in the export. */
export interface ExportedCanvas {
    id: string;
    title: string;
    /** Entries written to `oplog.jsonl`, archive included. */
    entries: number;
    lastSeq: number;
    /** Blobs the log names that were fetched, and their total size. */
    blobs: number;
    bytes: number;
    /** Blob hashes the log names that the home no longer has (gc swept them,
     * or an upload never landed). Listed rather than dropped: an export that
     * quietly loses bytes is the worst kind of success. */
    missing: string[];
}
/** What `manifest.json` says about one item exported on its own. */
export interface ExportedItem {
    canvasId: string;
    itemId: string;
    title: string;
    versions: number;
    /** Entries in the log that name this item. */
    ops: number;
    missing: string[];
}
export interface ExportManifest {
    format: typeof EXPORT_FORMAT;
    exportedAt: string;
    /** The home the export was read from — an origin. */
    from: string;
    /** Who ran it, when a command had an actor. */
    by?: Actor;
    canvases: ExportedCanvas[];
    items: ExportedItem[];
}
/** The blob index's row — the same shape `FileStore` keeps in `blobs.json`. */
export interface ExportedBlob {
    file: string;
    mimeType: string;
    filename: string;
    size: number;
}
/**
 * What a target string names. A canvas address, an item address, or a bare
 * home origin parse as URLs; anything else is a ref for the local daemon to
 * resolve (an id, a title prefix) and comes back `null` here.
 */
export type ExportTarget = {
    kind: "home";
    origin: string;
} | {
    kind: "canvas";
    origin: string;
    canvasId: string;
} | {
    kind: "item";
    origin: string;
    canvasId: string;
    itemId: string;
};
/**
 * A URL is a target when it is one of the three addresses this product
 * writes: `origin/p/<id>`, `origin/p/<id>/i/<item>`, or the origin alone.
 * The canvas and item forms come from `address.ts`, the one place their
 * spelling lives. A bare origin is a home — every canvas the caller may see
 * there. A string with no scheme and no dot is not a URL at all; it is a ref.
 */
export declare function parseExportTarget(raw: string): ExportTarget | null;
/**
 * Every blob the log names, keyed by hash. Found by shape rather than by op
 * type — anything carrying `blobHash`, `mimeType` and `filename` together is
 * a version spec, whichever op it rides on — so a new op that names bytes is
 * backed up the day it ships rather than the day somebody remembers this.
 * Inverses are walked too: an undone `item.add`'s bytes are still part of
 * the history, and `redo` will want them.
 */
export declare function blobsNamedBy(entries: readonly LogEntry[]): Map<string, {
    mimeType: string;
    filename: string;
    size: number;
}>;
/**
 * The entries that name one item, in log order. A structural walk for the id
 * rather than a list of which ops carry `itemId`, `itemIds` or `items`:
 * the vocabulary grows, and an item's history should not silently lose an
 * op because the walk was written before it. Ids are nanoids, so a match on
 * the whole string is a match on the item.
 */
export declare function opsTouching(entries: readonly LogEntry[], itemId: string): LogEntry[];
/** `<hash>.<ext>` — the name `FileStore.putBlob` files bytes under, so a
 * blob in an export is named exactly as it is under `~/.isocan`. */
export declare function blobFileName(hash: string, filename: string, mimeType: string): string;
/** One line for a manifest row, the way the CLI and a test both say it. */
export declare function describeExportedCanvas(row: ExportedCanvas): string;
/** The record a restore hands back — `project.json` from the export, with
 * nothing invented: the stamps are the ones the home wrote. */
export declare function isCanvasRecord(value: unknown): value is Canvas;
