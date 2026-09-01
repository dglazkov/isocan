import type { Readable } from "node:stream";
import type { ActorRegistry, LogEntry, Canvas, CanvasState, SlashCommand } from "../../core/src/index.js";
import type { BlobListing, BlobMeta, BlobUploadRequest, LoadedCanvas, Store } from "./store.js";
export declare class FileStore implements Store {
    readonly home: string;
    constructor(home: string);
    init(): Promise<void>;
    /** Nothing is held open: every write here closes its own handle. The method
     * exists for the backing that does hold something open. */
    close(): Promise<void>;
    listCanvases(): Promise<Canvas[]>;
    createCanvasDir(id: string): Promise<void>;
    canvasExists(id: string): Promise<boolean>;
    load(id: string): Promise<LoadedCanvas | null>;
    /**
     * **Canvases whose metadata predates the stamp, repaired once.**
     *
     * `updatedAt`/`updatedBy` used to move only on a rename, and `lastOp` did
     * not exist. So every canvas made before this reports the day it was last
     * retitled and has nothing to say about what happened — which would make a
     * home screen sorted by "recent activity" order the list by something nobody
     * was thinking about, and quietly, which is the worst way to be wrong.
     *
     * Fixing it needs the log's last entry, and reading a log per canvas is
     * exactly the cost the `lastOp` field exists to avoid on the request path.
     * So it happens ONCE: only for canvases that are missing the field, off the
     * request path, and never again for one it has repaired. A home that has
     * been through it does no reads at all.
     *
     * Returns how many it fixed, so the caller can say so rather than doing
     * unexplained work at boot.
     */
    backfillLastOp(keepGoing?: () => boolean): Promise<number>;
    saveCanvas(canvas: Canvas): Promise<void>;
    saveSnapshot(id: string, state: CanvasState, lastSeq: number): Promise<void>;
    appendLog(id: string, entry: LogEntry): Promise<void>;
    /** project.delete is soft: the directory is moved aside, recoverable by hand. */
    softDeleteCanvas(id: string): Promise<void>;
    /**
     * Load the registry: snapshot plus any oplog tail the snapshot doesn't
     * cover. Replay is trivial — the envelope carries the RESOLVED actor, so a
     * logged claim re-applies without re-validation — which is what makes the
     * jsonl the source of truth and actors.json derived, same as a canvas.
     */
    /**
     * The slash commands this home has written. Read from disk every time
     * rather than cached: these are files a person edits in a text editor, and
     * an editor save should show up in the next menu they open, not the next
     * time they restart the daemon.
     *
     * A file that does not parse is skipped, not fatal. One malformed command
     * must not take the menu down with it.
     */
    loadCommands(): Promise<SlashCommand[]>;
    /** Write one, atomically — the menu reads this directory unsynchronised. */
    saveCommand(name: string, text: string): Promise<void>;
    /** Remove one. Removing a shadow gives the built-in back, which is why this
     * says whether a file was actually there. */
    deleteCommand(name: string): Promise<boolean>;
    loadActors(): Promise<{
        registry: ActorRegistry;
        lastSeq: number;
    }>;
    saveActors(registry: ActorRegistry, lastSeq: number): Promise<void>;
    appendActorsLog(entry: LogEntry): Promise<void>;
    /**
     * Store bytes and name them in the index. Read-modify-write over the whole
     * of `blobs.json`, so like every other writer here it must be called from
     * the engine's single-writer chain — `Engine.putBlob`, never directly.
     */
    putBlob(id: string, data: Buffer, meta: {
        mimeType: string;
        filename: string;
    }): Promise<{
        blobHash: string;
        size: number;
        mimeType: string;
    }>;
    blobMeta(id: string, blobHash: string): Promise<BlobMeta | null>;
    openBlob(id: string, blobHash: string, range?: {
        start: number;
        end: number;
    }): Promise<Readable | null>;
    /**
     * No ticket: on a disk the daemon IS the place the bytes go, at any size.
     * Null rather than a throw because the answer is "there is nothing to hand
     * you", not "you asked wrongly" — the client branches on it and posts.
     */
    beginUpload(_id: string, _request: BlobUploadRequest): Promise<null>;
    /** Unreachable in practice — a client only registers after `beginUpload`
     * gave it somewhere to upload to, and this backing never does. It refuses
     * in the vocabulary the route already speaks rather than throwing something
     * that would reach a person as a 500. */
    registerBlob(_id: string, _request: BlobUploadRequest): Promise<never>;
    /** The index, plus an mtime per row. Two calls per blob, exactly as before
     * — what moved is which side of the seam they happen on. */
    listBlobs(id: string): Promise<BlobListing[]>;
    /** Unlink the bytes, then rewrite the index ONCE — the same file semantics
     * as before, including one index rewrite per GC pass. */
    deleteBlobs(id: string, hashes: string[]): Promise<void>;
    /**
     * Archive first, then replace the live log atomically. Crash-safe in that
     * order: a crash between the two leaves extra history, which is harmless
     * and re-collectable. On a disk a compacted entry really does leave the
     * live log — one process owns this directory, so no reader can be surprised
     * by a seq becoming free again.
     */
    compactOplog(id: string, retained: LogEntry[], dropped: LogEntry[]): Promise<void>;
    /** The archive is appended in compaction order and compaction always drops
     * the oldest entries, so the file is already oldest-first. */
    readArchivedLog(id: string): Promise<LogEntry[]>;
    private readIndex;
    /** Age of a blob file in ms, or null if it is already gone. */
    private ageMs;
}
