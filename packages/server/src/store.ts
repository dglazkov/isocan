import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import type { LogEntry, Project, ProjectState } from "@isocan/core";
import { applyOperation, emptyCanvas } from "@isocan/core";
import { appendLineDurable, readJson, readJsonLines, writeFileAtomic } from "./fsutil.ts";
import * as p from "./paths.ts";

/**
 * Persistence for one isocan home. Layout per project:
 *   project.json  — Project metadata
 *   canvas.json   — { lastSeq, items, threads } derived snapshot
 *   trash.json    — TrashEntry[] derived snapshot
 *   oplog.jsonl   — append-only LogEntry per line; the source of truth
 *   blobs/        — content-addressed version content, <sha256>.<ext>
 *   blobs.json    — { [hash]: { file, mimeType, filename, size } }
 *
 * The oplog is appended (with fsync) BEFORE snapshots are rewritten, so a
 * crash between writes is always recoverable by replaying the oplog tail past
 * canvas.json's lastSeq.
 */

interface CanvasSnapshotFile {
  lastSeq: number;
  items: ProjectState["canvas"]["items"];
  threads: ProjectState["canvas"]["threads"];
}

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

export class Store {
  constructor(readonly home: string) {}

  async init(): Promise<void> {
    await fs.mkdir(p.projectsDir(this.home), { recursive: true });
    await fs.mkdir(p.deletedProjectsDir(this.home), { recursive: true });
  }

  async listProjects(): Promise<Project[]> {
    let ids: string[];
    try {
      ids = await fs.readdir(p.projectsDir(this.home));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw err;
    }
    const projects: Project[] = [];
    for (const id of ids) {
      const project = await readJson<Project>(p.projectFile(this.home, id));
      if (project) projects.push(project);
    }
    projects.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return projects;
  }

  async createProjectDir(id: string): Promise<void> {
    await fs.mkdir(p.blobsDir(this.home, id), { recursive: true });
  }

  async projectExists(id: string): Promise<boolean> {
    return (await readJson<Project>(p.projectFile(this.home, id))) !== null;
  }

  async load(id: string): Promise<LoadedProject | null> {
    const project = await readJson<Project>(p.projectFile(this.home, id));
    if (!project) return null;
    const snapshot = await readJson<CanvasSnapshotFile>(p.canvasFile(this.home, id));
    const trash = (await readJson<ProjectState["canvas"]["trash"]>(p.trashFile(this.home, id))) ?? [];
    const entries = await readJsonLines<LogEntry>(p.oplogFile(this.home, id));

    let state: ProjectState = {
      project,
      canvas: snapshot
        ? { items: snapshot.items, threads: snapshot.threads, trash }
        : { ...emptyCanvas(), trash },
    };
    let lastSeq = snapshot?.lastSeq ?? 0;

    // Crash recovery: replay any oplog tail the snapshot doesn't cover.
    const recoveredSeqs: number[] = [];
    for (const entry of entries) {
      if (entry.seq <= lastSeq) continue;
      if (entry.envelope.op.type === "project.create") continue; // project.json already exists
      const next = applyOperation(state, entry.envelope);
      if (next === null) return null; // replayed a project.delete — treat as gone
      state = next;
      lastSeq = entry.seq;
      recoveredSeqs.push(entry.seq);
    }
    if (recoveredSeqs.length > 0) {
      await this.saveSnapshot(id, state, lastSeq);
    }
    return { state, lastSeq, entries, recoveredSeqs };
  }

  async saveProject(project: Project): Promise<void> {
    await writeFileAtomic(p.projectFile(this.home, project.id), pretty(project));
  }

  async saveSnapshot(id: string, state: ProjectState, lastSeq: number): Promise<void> {
    const snapshot: CanvasSnapshotFile = {
      lastSeq,
      items: state.canvas.items,
      threads: state.canvas.threads,
    };
    await writeFileAtomic(p.canvasFile(this.home, id), pretty(snapshot));
    await writeFileAtomic(p.trashFile(this.home, id), pretty(state.canvas.trash));
    await this.saveProject(state.project);
  }

  async appendLog(id: string, entry: LogEntry): Promise<void> {
    await appendLineDurable(p.oplogFile(this.home, id), JSON.stringify(entry));
  }

  /** project.delete is soft: the directory is moved aside, recoverable by hand. */
  async softDeleteProject(id: string): Promise<void> {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    await fs.rename(
      p.projectDir(this.home, id),
      path.join(p.deletedProjectsDir(this.home), `${id}-${stamp}`),
    );
  }

  // ---- blobs ----

  async putBlob(
    id: string,
    data: Buffer,
    meta: { mimeType: string; filename: string },
  ): Promise<{ blobHash: string; size: number; mimeType: string }> {
    const blobHash = createHash("sha256").update(data).digest("hex");
    const index = await this.blobIndex(id);
    const existing = index[blobHash];
    if (existing) {
      return { blobHash, size: existing.size, mimeType: existing.mimeType };
    }
    const ext = extensionFor(meta.filename, meta.mimeType);
    const file = ext ? `${blobHash}.${ext}` : blobHash;
    await writeFileAtomic(path.join(p.blobsDir(this.home, id), file), data);
    index[blobHash] = { file, mimeType: meta.mimeType, filename: meta.filename, size: data.length };
    await writeFileAtomic(p.blobsIndexFile(this.home, id), pretty(index));
    return { blobHash, size: data.length, mimeType: meta.mimeType };
  }

  async getBlob(id: string, blobHash: string): Promise<{ path: string; meta: BlobMeta } | null> {
    const meta = (await this.blobIndex(id))[blobHash];
    if (!meta) return null;
    return { path: path.join(p.blobsDir(this.home, id), meta.file), meta };
  }

  async blobIndex(id: string): Promise<Record<string, BlobMeta>> {
    return (await readJson<Record<string, BlobMeta>>(p.blobsIndexFile(this.home, id))) ?? {};
  }

  // ---- garbage collection primitives (composed by Engine.gc) ----

  /** Age of a blob file in ms, or null if it is already gone. */
  async blobAgeMs(id: string, meta: BlobMeta): Promise<number | null> {
    try {
      const stat = await fs.stat(path.join(p.blobsDir(this.home, id), meta.file));
      return Date.now() - stat.mtimeMs;
    } catch {
      return null;
    }
  }

  async deleteBlobFile(id: string, meta: BlobMeta): Promise<void> {
    await fs.rm(path.join(p.blobsDir(this.home, id), meta.file), { force: true });
  }

  async writeBlobIndex(id: string, index: Record<string, BlobMeta>): Promise<void> {
    await writeFileAtomic(p.blobsIndexFile(this.home, id), pretty(index));
  }

  /** Preserve compacted-away entries for audit before the live log shrinks. */
  async archiveOplogEntries(id: string, dropped: LogEntry[]): Promise<void> {
    if (dropped.length === 0) return;
    const lines = dropped.map((entry) => JSON.stringify(entry)).join("\n") + "\n";
    await fs.appendFile(p.oplogArchiveFile(this.home, id), lines);
  }

  /** Atomically replace the live oplog with the retained entries. */
  async rewriteOplog(id: string, retained: LogEntry[]): Promise<void> {
    const body = retained.map((entry) => JSON.stringify(entry)).join("\n");
    await writeFileAtomic(p.oplogFile(this.home, id), body.length > 0 ? body + "\n" : "");
  }
}

function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

/** Prefer the real file extension; fall back to a small mime map. */
function extensionFor(filename: string, mimeType: string): string {
  const fromName = path.extname(filename).slice(1).toLowerCase();
  if (/^[a-z0-9]{1,8}$/.test(fromName)) return fromName;
  const map: Record<string, string> = {
    "text/markdown": "md",
    "text/html": "html",
    "text/plain": "txt",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/svg+xml": "svg",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
  };
  return map[mimeType] ?? "bin";
}
