import type { ActorRegistry, LogEntry, Project, ProjectState, SlashCommand } from "@isocan/core";

export interface BlobMeta {
  file: string;
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
 * complete home. A second backing implements this same set.
 *
 * The durability contract lives here rather than in any one backing: an op is
 * durable BEFORE it is broadcast, so `appendLog` must not resolve until the
 * entry survives a crash. Snapshots are derived; the log is the truth.
 */
export interface Store {
  init(): Promise<void>;

  listProjects(): Promise<Project[]>;

  createProjectDir(id: string): Promise<void>;

  projectExists(id: string): Promise<boolean>;

  load(id: string): Promise<LoadedProject | null>;

  saveProject(project: Project): Promise<void>;

  saveSnapshot(id: string, state: ProjectState, lastSeq: number): Promise<void>;

  appendLog(id: string, entry: LogEntry): Promise<void>;

  /** project.delete is soft: the state is moved aside, recoverable by hand. */
  softDeleteProject(id: string): Promise<void>;

  // ---- slash commands ----

  loadCommands(): Promise<SlashCommand[]>;

  saveCommand(name: string, text: string): Promise<void>;

  /** Removing a shadow gives the built-in back, which is why this says
   * whether one was actually there. */
  deleteCommand(name: string): Promise<boolean>;

  // ---- the actor registry (home-scoped; see core/claims.ts) ----

  loadActors(): Promise<{ registry: ActorRegistry; lastSeq: number }>;

  saveActors(registry: ActorRegistry, lastSeq: number): Promise<void>;

  appendActorsLog(entry: LogEntry): Promise<void>;

  /** One-time fold-in of the CLI-era `agents.json` (#59). File-shaped: only a
   * disk backing has ever had such a file. */
  migrateLegacyAgents(): Promise<void>;

  // ---- blobs ----

  putBlob(
    id: string,
    data: Buffer,
    meta: { mimeType: string; filename: string },
  ): Promise<{ blobHash: string; size: number; mimeType: string }>;

  /** File-shaped: the caller streams from `path`. A backing without a
   * filesystem path will need this reshaped. */
  getBlob(id: string, blobHash: string): Promise<{ path: string; meta: BlobMeta } | null>;

  blobIndex(id: string): Promise<Record<string, BlobMeta>>;

  // ---- garbage collection primitives (composed by Engine.gc) ----

  /** Age of a blob in ms, or null if it is already gone. */
  blobAgeMs(id: string, meta: BlobMeta): Promise<number | null>;

  deleteBlobFile(id: string, meta: BlobMeta): Promise<void>;

  writeBlobIndex(id: string, index: Record<string, BlobMeta>): Promise<void>;

  /** Preserve compacted-away entries for audit before the live log shrinks. */
  archiveOplogEntries(id: string, dropped: LogEntry[]): Promise<void>;

  /** Atomically replace the live oplog with the retained entries. */
  rewriteOplog(id: string, retained: LogEntry[]): Promise<void>;
}
