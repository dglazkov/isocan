import { createReadStream, promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import type { Readable } from "node:stream";
import type { ActorRegistry, LogEntry, Canvas, CanvasState, SlashCommand } from "@isocan/core";
import {
  applyActorColor,
  applyOperation,
  bindName,
  COMMAND_NAME,
  emptyCanvas,
  extensionFor,
  OpValidationError,
  parseCommandFile,
  sortCanvases,
} from "@isocan/core";
import { appendLineDurable, readJson, readJsonLines, writeFileAtomic } from "./fsutil.ts";
import * as p from "./paths.ts";
import type {
  BlobListing,
  BlobMeta,
  BlobUploadRequest,
  LoadedCanvas,
  Store,
} from "./store.ts";

/**
 * Persistence for one isocan home. Layout per canvas:
 *   project.json  — Canvas metadata
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
  items: CanvasState["canvas"]["items"];
  threads: CanvasState["canvas"]["threads"];
  /** Standing agents (agents-on-demand phase 2). Absent in snapshots written
   * before the field — those predate any `agent.enroll` op, so absent means
   * empty, never lost. */
  agents?: CanvasState["canvas"]["agents"];
}

export class FileStore implements Store {
  constructor(readonly home: string) {}

  async init(): Promise<void> {
    await fs.mkdir(p.canvasesDir(this.home), { recursive: true });
    await fs.mkdir(p.deletedCanvasesDir(this.home), { recursive: true });
  }

  /** Nothing is held open: every write here closes its own handle. The method
   * exists for the backing that does hold something open. */
  async close(): Promise<void> {}

  async listCanvases(): Promise<Canvas[]> {
    let ids: string[];
    try {
      ids = await fs.readdir(p.canvasesDir(this.home));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw err;
    }
    const canvases: Canvas[] = [];
    for (const id of ids) {
      const canvas = await readJson<Canvas>(p.canvasMetaFile(this.home, id));
      if (canvas) canvases.push(canvas);
    }
    /**
     * **Most recently touched first**, which is both the useful default and
     * the end of a reported bug: this sorted `createdAt` ASCENDING, so every
     * new canvas landed at the far end of a list somebody was standing at the
     * top of, and `Create` read as a button that did nothing.
     *
     * The ordering itself is `sortCanvases` from core, so this and the app's
     * own re-sorting cannot disagree about which canvas is most recent — and
     * a client that wants a different order re-sorts with the same function.
     */
    return sortCanvases(canvases, "recent");
  }

  async createCanvasDir(id: string): Promise<void> {
    await fs.mkdir(p.blobsDir(this.home, id), { recursive: true });
  }

  async canvasExists(id: string): Promise<boolean> {
    return (await readJson<Canvas>(p.canvasMetaFile(this.home, id))) !== null;
  }

  async load(id: string): Promise<LoadedCanvas | null> {
    const record = await readJson<Canvas>(p.canvasMetaFile(this.home, id));
    if (!record) return null;
    const snapshot = await readJson<CanvasSnapshotFile>(p.canvasFile(this.home, id));
    const trash = (await readJson<CanvasState["canvas"]["trash"]>(p.trashFile(this.home, id))) ?? [];
    const entries = await readJsonLines<LogEntry>(p.oplogFile(this.home, id));

    let state: CanvasState = {
      project: record,
      canvas: snapshot
        ? { items: snapshot.items, threads: snapshot.threads, trash, agents: snapshot.agents ?? {} }
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
  async backfillLastOp(): Promise<number> {
    let fixed = 0;
    for (const canvas of await this.listCanvases()) {
      if (canvas.lastOp !== undefined) continue;
      const entries = await readJsonLines<LogEntry>(p.oplogFile(this.home, canvas.id));
      const last = entries[entries.length - 1];
      // No live log — compacted away, or a canvas that has only ever been
      // created. Its existing stamp is the best thing known about it.
      if (!last) continue;
      await this.saveCanvas({
        ...canvas,
        updatedAt: last.envelope.ts,
        updatedBy: last.envelope.actor,
        lastOp: last.envelope.op.type,
      });
      fixed += 1;
    }
    return fixed;
  }

  async saveCanvas(canvas: Canvas): Promise<void> {
    await writeFileAtomic(p.canvasMetaFile(this.home, canvas.id), pretty(canvas));
  }

  async saveSnapshot(id: string, state: CanvasState, lastSeq: number): Promise<void> {
    const snapshot: CanvasSnapshotFile = {
      lastSeq,
      items: state.canvas.items,
      threads: state.canvas.threads,
      agents: state.canvas.agents ?? {},
    };
    await writeFileAtomic(p.canvasFile(this.home, id), pretty(snapshot));
    await writeFileAtomic(p.trashFile(this.home, id), pretty(state.canvas.trash));
    await this.saveCanvas(state.project);
  }

  async appendLog(id: string, entry: LogEntry): Promise<void> {
    await appendLineDurable(p.oplogFile(this.home, id), JSON.stringify(entry));
  }

  /** project.delete is soft: the directory is moved aside, recoverable by hand. */
  async softDeleteCanvas(id: string): Promise<void> {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    await fs.rename(
      p.canvasDir(this.home, id),
      path.join(p.deletedCanvasesDir(this.home), `${id}-${stamp}`),
    );
  }

  // ---- the actor registry (home-scoped; see core/claims.ts) ----

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
  async loadCommands(): Promise<SlashCommand[]> {
    let names: string[];
    try {
      names = await fs.readdir(p.commandsDir(this.home));
    } catch {
      return []; // no commands directory yet: the built-ins are the whole set
    }
    const commands: SlashCommand[] = [];
    for (const file of names.sort()) {
      if (!file.endsWith(".md")) continue;
      const name = file.slice(0, -3);
      if (!COMMAND_NAME.test(name)) continue;
      try {
        const parsed = parseCommandFile(name, await fs.readFile(p.commandFile(this.home, name), "utf8"));
        if (parsed) commands.push(parsed);
      } catch {
        // Unreadable mid-write, or not a file at all. Skip it.
      }
    }
    return commands;
  }

  /** Write one, atomically — the menu reads this directory unsynchronised. */
  async saveCommand(name: string, text: string): Promise<void> {
    if (!COMMAND_NAME.test(name)) throw new Error(`not a command name: ${name}`);
    await fs.mkdir(p.commandsDir(this.home), { recursive: true });
    await writeFileAtomic(p.commandFile(this.home, name), text);
  }

  /** Remove one. Removing a shadow gives the built-in back, which is why this
   * says whether a file was actually there. */
  async deleteCommand(name: string): Promise<boolean> {
    if (!COMMAND_NAME.test(name)) throw new Error(`not a command name: ${name}`);
    try {
      await fs.unlink(p.commandFile(this.home, name));
      return true;
    } catch {
      return false;
    }
  }

  async loadActors(): Promise<{ registry: ActorRegistry; lastSeq: number }> {
    const snapshot = await readJson<{
      lastSeq: number;
      names?: ActorRegistry["names"];
      colors?: ActorRegistry["colors"];
    }>(p.actorsFile(this.home));
    // `colors` is absent in files written before identity colors existed —
    // an old home simply has nobody who has chosen one yet. `names` is absent
    // in files written before the badge; `migrations.ts` rewrites those at
    // startup, and a file that somehow reached here unmigrated rebuilds its
    // names from the log below rather than refusing to boot.
    let registry: ActorRegistry = { names: snapshot?.names ?? {}, colors: snapshot?.colors ?? {} };
    let lastSeq = snapshot?.names === undefined ? 0 : (snapshot?.lastSeq ?? 0);
    const entries = await readJsonLines<LogEntry>(p.actorsLogFile(this.home));
    let recovered = false;
    for (const entry of entries) {
      if (entry.seq <= lastSeq) continue;
      const op = entry.envelope.op;
      if (op.type === "actor.claim") {
        // Only the PUBLIC half replays. The claims table keys on badge ids
        // and badge ids stay out of the oplog (mechanism 5), so it is not
        // reconstructible from here at all — it is desk state, written
        // directly, and `file-desk.ts` has its own log for it.
        registry = bindName(registry, { actor: entry.envelope.actor, ts: entry.envelope.ts });
      } else if (op.type === "actor.setColor") {
        registry = applyActorColor(registry, op);
      } else {
        continue;
      }
      lastSeq = entry.seq;
      recovered = true;
    }
    if (recovered) await this.saveActors(registry, lastSeq);
    return { registry, lastSeq };
  }

  async saveActors(registry: ActorRegistry, lastSeq: number): Promise<void> {
    await writeFileAtomic(
      p.actorsFile(this.home),
      pretty({ lastSeq, names: registry.names, colors: registry.colors }),
    );
  }

  async appendActorsLog(entry: LogEntry): Promise<void> {
    await appendLineDurable(p.actorsLogFile(this.home), JSON.stringify(entry));
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
    const index = await this.readIndex(id);
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

  async blobMeta(id: string, blobHash: string): Promise<BlobMeta | null> {
    return (await this.readIndex(id))[blobHash] ?? null;
  }

  async openBlob(
    id: string,
    blobHash: string,
    range?: { start: number; end: number },
  ): Promise<Readable | null> {
    const meta = await this.blobMeta(id, blobHash);
    if (!meta) return null;
    const file = path.join(p.blobsDir(this.home, id), meta.file);
    // `createReadStream` does not stat first, so a missing file surfaces as an
    // "error" event on the stream rather than a throw here. That is the same
    // shape the route already handled, and it is the honest one: the index
    // said the blob is there.
    return range ? createReadStream(file, { start: range.start, end: range.end }) : createReadStream(file);
  }

  /**
   * No ticket: on a disk the daemon IS the place the bytes go, at any size.
   * Null rather than a throw because the answer is "there is nothing to hand
   * you", not "you asked wrongly" — the client branches on it and posts.
   */
  async beginUpload(_id: string, _request: BlobUploadRequest): Promise<null> {
    return null;
  }

  /** Unreachable in practice — a client only registers after `beginUpload`
   * gave it somewhere to upload to, and this backing never does. It refuses
   * in the vocabulary the route already speaks rather than throwing something
   * that would reach a person as a 500. */
  async registerBlob(_id: string, _request: BlobUploadRequest): Promise<never> {
    throw new OpValidationError("bad-op", "this home takes blob bytes directly; there is nothing to register");
  }

  // ---- garbage collection (the policy lives in Engine.gc) ----

  /** The index, plus an mtime per row. Two calls per blob, exactly as before
   * — what moved is which side of the seam they happen on. */
  async listBlobs(id: string): Promise<BlobListing[]> {
    const index = await this.readIndex(id);
    const listing: BlobListing[] = [];
    for (const [hash, meta] of Object.entries(index)) {
      listing.push({ hash, meta, ageMs: await this.ageMs(id, meta) });
    }
    return listing;
  }

  /** Unlink the bytes, then rewrite the index ONCE — the same file semantics
   * as before, including one index rewrite per GC pass. */
  async deleteBlobs(id: string, hashes: string[]): Promise<void> {
    if (hashes.length === 0) return;
    const index = await this.readIndex(id);
    for (const hash of hashes) {
      const meta = index[hash];
      if (!meta) continue;
      await fs.rm(path.join(p.blobsDir(this.home, id), meta.file), { force: true });
      delete index[hash];
    }
    await writeFileAtomic(p.blobsIndexFile(this.home, id), pretty(index));
  }

  /**
   * Archive first, then replace the live log atomically. Crash-safe in that
   * order: a crash between the two leaves extra history, which is harmless
   * and re-collectable. On a disk a compacted entry really does leave the
   * live log — one process owns this directory, so no reader can be surprised
   * by a seq becoming free again.
   */
  async compactOplog(id: string, retained: LogEntry[], dropped: LogEntry[]): Promise<void> {
    if (dropped.length > 0) {
      const lines = dropped.map((entry) => JSON.stringify(entry)).join("\n") + "\n";
      await fs.appendFile(p.oplogArchiveFile(this.home, id), lines);
    }
    const body = retained.map((entry) => JSON.stringify(entry)).join("\n");
    await writeFileAtomic(p.oplogFile(this.home, id), body.length > 0 ? body + "\n" : "");
  }

  /** The archive is appended in compaction order and compaction always drops
   * the oldest entries, so the file is already oldest-first. */
  async readArchivedLog(id: string): Promise<LogEntry[]> {
    return readJsonLines<LogEntry>(p.oplogArchiveFile(this.home, id));
  }

  // ---- internals ----

  private async readIndex(id: string): Promise<Record<string, BlobMeta>> {
    return (await readJson<Record<string, BlobMeta>>(p.blobsIndexFile(this.home, id))) ?? {};
  }

  /** Age of a blob file in ms, or null if it is already gone. */
  private async ageMs(id: string, meta: BlobMeta): Promise<number | null> {
    try {
      const stat = await fs.stat(path.join(p.blobsDir(this.home, id), meta.file));
      return Date.now() - stat.mtimeMs;
    } catch {
      return null;
    }
  }
}

function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
