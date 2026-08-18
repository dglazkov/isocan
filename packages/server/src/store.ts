import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import type { ActorRegistry, LogEntry, OpEnvelope, Project, ProjectState } from "@isocan/core";
import { applyOperation, bindClaim, emptyCanvas, newOpId } from "@isocan/core";
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

  // ---- the actor registry (home-scoped; see core/claims.ts) ----

  /**
   * Load the registry: snapshot plus any oplog tail the snapshot doesn't
   * cover. Replay is trivial — the envelope carries the RESOLVED actor, so a
   * logged claim re-applies without re-validation — which is what makes the
   * jsonl the source of truth and actors.json derived, same as a project.
   */
  async loadActors(): Promise<{ registry: ActorRegistry; lastSeq: number }> {
    const snapshot = await readJson<{ lastSeq: number; claims: ActorRegistry["claims"] }>(
      p.actorsFile(this.home),
    );
    let registry: ActorRegistry = { claims: snapshot?.claims ?? {} };
    let lastSeq = snapshot?.lastSeq ?? 0;
    const entries = await readJsonLines<LogEntry>(p.actorsLogFile(this.home));
    let recovered = false;
    for (const entry of entries) {
      if (entry.seq <= lastSeq) continue;
      const op = entry.envelope.op;
      if (op.type !== "actor.claim") continue;
      registry = bindClaim(registry, { actor: entry.envelope.actor, ts: entry.envelope.ts, op });
      lastSeq = entry.seq;
      recovered = true;
    }
    if (recovered) await this.saveActors(registry, lastSeq);
    return { registry, lastSeq };
  }

  async saveActors(registry: ActorRegistry, lastSeq: number): Promise<void> {
    await writeFileAtomic(
      p.actorsFile(this.home),
      pretty({ lastSeq, claims: registry.claims }),
    );
  }

  async appendActorsLog(entry: LogEntry): Promise<void> {
    await appendLineDurable(p.actorsLogFile(this.home), JSON.stringify(entry));
  }

  /**
   * Fold the CLI-era session registry (`agents.json`, pre-#57) into the
   * actor registry, then move the file aside so this runs once (#59). Actor
   * ids must survive — they are what the canvases remember — so each binding
   * becomes a logged reincarnation claim (`as` + name), stamped with its
   * original boundAt: recency semantics carry over, and a lost snapshot
   * recovers the imported rows from the jsonl like any other claim. Runs at
   * daemon startup, before the engine reads the registry.
   */
  async migrateLegacyAgents(): Promise<void> {
    interface LegacyBinding {
      id?: string;
      name?: string;
      boundAt?: string;
    }
    const file = p.agentsFile(this.home);
    let legacy: { sessions?: Record<string, LegacyBinding> };
    try {
      legacy = JSON.parse(await fs.readFile(file, "utf8")) as typeof legacy;
    } catch {
      return; // no file, or unreadable — nothing to fold in
    }
    const { registry, lastSeq } = await this.loadActors();
    let current = registry;
    let seq = lastSeq;
    // Oldest first, so when several keys held one actor (nested sessions),
    // the newest binding is the one that survives bindClaim's eviction.
    const sessions = Object.entries(legacy?.sessions ?? {}).sort(([, a], [, b]) =>
      (a?.boundAt ?? "").localeCompare(b?.boundAt ?? ""),
    );
    for (const [key, binding] of sessions) {
      if (!binding?.id || !binding.name) continue;
      // The new registry wins: a key or actor already claimed post-#57 is
      // living its own life, and the legacy row is history.
      if (current.claims[key]) continue;
      if (Object.values(current.claims).some((claim) => claim.id === binding.id)) continue;
      const ts = binding.boundAt ?? new Date().toISOString();
      const op = {
        type: "actor.claim",
        sessionKey: key,
        name: binding.name,
        as: binding.id,
      } as const;
      const envelope: OpEnvelope = {
        id: newOpId(),
        projectId: null,
        actor: { id: binding.id, name: binding.name },
        ts,
        op,
      };
      seq += 1;
      await this.appendActorsLog({ seq, envelope, inverse: null });
      current = bindClaim(current, { actor: envelope.actor, ts, op });
    }
    if (seq !== lastSeq) await this.saveActors(current, seq);
    await fs.rename(file, `${file}.migrated`).catch(() => {});
  }

  // ---- blobs ----

  /**
   * Store bytes and name them in the index. Read-modify-write over the whole
   * of `blobs.json`, so like every other writer here it must be called from
   * the engine's single-writer chain — `Engine.putBlob`, never directly.
   */
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
    "text/uri-list": "uri",
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
