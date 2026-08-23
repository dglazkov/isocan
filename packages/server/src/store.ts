import type {
  ActorRegistry,
  LogEntry,
  Project,
  ProjectState,
  SlashCommand,
  UploadTicket,
} from "@isocan/core";
import type { Readable } from "node:stream";

export interface BlobMeta {
  /** The name the bytes are filed under — `<sha256>.<ext>`. A path segment on
   * a disk, an object-name segment in a bucket: the same addressing either
   * way (see `extensionFor` in core), which is what lets a home be moved
   * between backings by copying a directory. */
  file: string;
  mimeType: string;
  filename: string;
  size: number;
}

/** One blob as garbage collection sees it: what it is, and how old. `ageMs`
 * is null when the bytes are already gone — an index row with nothing under
 * it, which is a thing to collect rather than a thing to protect. */
export interface BlobListing {
  hash: string;
  meta: BlobMeta;
  ageMs: number | null;
}

/** Everything a client must know to put bytes somewhere the daemon is not. */
export interface BlobUploadRequest {
  blobHash: string;
  mimeType: string;
  filename: string;
  size: number;
}

export interface LoadedProject {
  state: ProjectState;
  lastSeq: number;
  /** Full log, oldest first — feeds the undo stack. */
  entries: LogEntry[];
  /** Seqs replayed on load because the snapshot lagged the oplog. */
  recoveredSeqs: number[];
}

/**
 * Persistence for one isocan home — the seam the engine mutates through, and
 * the only thing it knows about storage. `FileStore` (see `file-store.ts`) is
 * the default backing and stays so forever: any innkeeper with a disk runs a
 * complete home. `CloudStore` (`@isocan/cloudstore`) is the second, and
 * `daemon.ts` is the ONE place either is named.
 *
 * The durability contract lives here rather than in any one backing: an op is
 * durable BEFORE it is broadcast, so `appendLog` must not resolve until the
 * entry survives a crash. Snapshots are derived; the log is the truth.
 *
 * ## Two rules a second backing made structural
 *
 * **A seq is claimed once, forever.** `appendLog` may refuse — with
 * `OplogFencedError` and nothing else — when the entry's seq is already
 * taken. On a file backing one process owns the directory and this never
 * fires; on the cloud backing the op document's id IS its seq and the write
 * carries a create-only precondition, so two instances overlapping during a
 * deploy cannot interleave a log: the second is refused by the schema. That
 * only means anything if a claimed seq is never released, which is why
 * `compactOplog` is allowed to archive and forget but NEVER to delete. A
 * backing that frees a seq punches a hole in the precondition exactly the
 * width of its compaction horizon.
 *
 * **A refusal must leave nothing applied.** The engine appends BEFORE it
 * touches in-memory state, so a fenced write leaves the runtime untouched and
 * merely stale — which is what makes "re-sync and try again" a complete
 * remedy rather than a hope.
 */
export interface Store {
  init(): Promise<void>;

  /** Release whatever the backing is holding open. A no-op on a disk; on the
   * cloud it flushes the debounced snapshot and closes the gRPC channel —
   * without which the process simply never exits. */
  close(): Promise<void>;

  listProjects(): Promise<Project[]>;

  createProjectDir(id: string): Promise<void>;

  projectExists(id: string): Promise<boolean>;

  load(id: string): Promise<LoadedProject | null>;

  saveProject(project: Project): Promise<void>;

  /**
   * Record the derived state. Called after EVERY op, and a backing is
   * explicitly allowed to debounce it: the log is the truth and this is a
   * fast boot, so the only contract is that `close()` flushes and that a boot
   * which finds a lagging snapshot replays the tail — the crash-recovery path
   * that already exists. A backing that debounces makes `recoveredSeqs`
   * routinely non-empty; that is a difference between backings and not a
   * difference in the engine's behavior.
   */
  saveSnapshot(id: string, state: ProjectState, lastSeq: number): Promise<void>;

  /** Durable before it returns. Throws `OplogFencedError` — and only that —
   * when `entry.seq` was already claimed by another writer. */
  appendLog(id: string, entry: LogEntry): Promise<void>;

  /** project.delete is soft: the state is moved aside, recoverable by hand. */
  softDeleteProject(id: string): Promise<void>;

  // ---- slash commands ----

  loadCommands(): Promise<SlashCommand[]>;

  saveCommand(name: string, text: string): Promise<void>;

  /** Removing a shadow gives the built-in back, which is why this says
   * whether one was actually there. */
  deleteCommand(name: string): Promise<boolean>;

  // ---- the actor registry's PUBLIC face (home-scoped; see core/claims.ts) ----
  //
  // Ids, names, colors — canvas state, replicated. The claims half lives
  // behind the desk (`desk.ts`) and never travels: two ledgers, two seams,
  // and which module a type is imported from is the answer to "does this
  // replicate?".

  loadActors(): Promise<{ registry: ActorRegistry; lastSeq: number }>;

  saveActors(registry: ActorRegistry, lastSeq: number): Promise<void>;

  appendActorsLog(entry: LogEntry): Promise<void>;

  // ---- blobs ----

  putBlob(
    id: string,
    data: Buffer,
    meta: { mimeType: string; filename: string },
  ): Promise<{ blobHash: string; size: number; mimeType: string }>;

  /** What a blob IS — for the response headers and the 404 — without opening
   * it. Separate from `openBlob` because a `HEAD`, a Range check and a 404
   * all want the metadata and none of them want the bytes. */
  blobMeta(id: string, blobHash: string): Promise<BlobMeta | null>;

  /**
   * The bytes, as a stream, optionally a byte range (inclusive on both ends,
   * as HTTP means it). Phase 1 left `getBlob` returning a filesystem path and
   * the route streaming from it; there is no path in a bucket, and range
   * support has to reach the backing or every seek in a video re-reads the
   * whole object.
   */
  openBlob(
    id: string,
    blobHash: string,
    range?: { start: number; end: number },
  ): Promise<Readable | null>;

  /**
   * Ask for somewhere to PUT bytes the daemon must not receive. Null means
   * "this home has no such thing — post the bytes" (every file backing, and
   * the reason the CLI's small path never changes).
   *
   * The ticket is minted only after the caller's badge and admission have
   * been checked, and it is scoped to ONE object name, ONE method and a short
   * expiry, all of them signed. It is not a key to the bucket.
   */
  beginUpload(id: string, request: BlobUploadRequest): Promise<UploadTicket | null>;

  /**
   * Name bytes that arrived without us. The daemon did not see them, so it
   * takes the client's word for the hash — an accepted limit, bounded to one
   * canvas that the same client could have emptied anyway, and the
   * alternative (reading the object back to re-hash it) would defeat the
   * entire point of the direct upload. What is NOT taken on faith is that the
   * object exists: a register naming nothing is refused.
   */
  registerBlob(
    id: string,
    request: BlobUploadRequest,
  ): Promise<{ blobHash: string; size: number; mimeType: string }>;

  // ---- garbage collection (the policy stays in Engine.gc; this is storage) ----

  /**
   * Every blob this canvas holds, with its age. Replaces phase 1's
   * `blobIndex`/`blobAgeMs`/`deleteBlobFile`/`writeBlobIndex` quartet, which
   * made the engine perform a read-modify-write of a single shared index —
   * a document the cloud backing does not have and must not grow. What
   * crosses the seam now is a LISTING and a DELETE; what a listing is (a JSON
   * file, a collection query) and what a batch delete is (unlink then rewrite
   * once, or N deletes in batches) is the backing's own business.
   */
  listBlobs(id: string): Promise<BlobListing[]>;

  deleteBlobs(id: string, hashes: string[]): Promise<void>;

  /**
   * Compact the oplog to an undo horizon: `dropped` leaves the live log,
   * `retained` stays, and the dropped entries are preserved for audit before
   * anything else happens.
   *
   * ONE method rather than phase 1's archive-then-rewrite pair, because the
   * two backings do genuinely different things and each must own its own
   * ordering. A file rewrites the log atomically. The cloud DELETES NOTHING —
   * it archives, marks the dropped documents, and advances a horizon — for
   * the reason in this file's header: a freed seq is a seq a stale writer can
   * claim again, and the create-only precondition is the whole reason the
   * cloud backing is safe under a rolling deploy.
   */
  compactOplog(id: string, retained: LogEntry[], dropped: LogEntry[]): Promise<void>;
}
