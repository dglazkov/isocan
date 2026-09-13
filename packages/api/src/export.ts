import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  Actor,
  Canvas,
  CanvasSnapshotResponse,
  ExportManifest,
  ExportedBlob,
  ExportedCanvas,
  ExportedItem,
  Item,
  LogEntry,
} from "@isocan/core";
import {
  EXPORT_FORMAT,
  EXPORT_LAYOUT as L,
  blobFileName,
  blobsNamedBy,
  isCanvasRecord,
  opsTouching,
} from "@isocan/core";
import { ApiError, type DaemonRoutes } from "./routes.ts";

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
export async function wholeLog(client: DaemonRoutes, canvasId: string): Promise<LogEntry[]> {
  const archived = await client.getArchivedLog(canvasId);
  const live = await client.getLog(canvasId, 0);
  const bySeq = new Map<number, LogEntry>();
  for (const entry of [...archived, ...live]) bySeq.set(entry.seq, entry);
  return [...bySeq.values()].sort((a, b) => a.seq - b.seq);
}

const pretty = (value: unknown) => JSON.stringify(value, null, 2) + "\n";
const lines = (entries: readonly unknown[]) =>
  entries.length === 0 ? "" : entries.map((e) => JSON.stringify(e)).join("\n") + "\n";

async function writeInto(out: string, rel: string, data: string | Buffer, written: string[]) {
  const file = path.join(out, rel);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, data);
  written.push(rel);
}

async function present(file: string, size: number): Promise<boolean> {
  try {
    const stat = await fs.stat(file);
    return stat.size === size || size === 0;
  } catch {
    return false;
  }
}

/**
 * Fetch one blob, or say it is gone. Only a 404 is "missing" — a home that
 * refuses, or is not answering, is an error the caller should see, because
 * a backup that shrugs at a refusal is a backup with holes nobody knows about.
 */
async function fetchBlob(
  client: DaemonRoutes,
  canvasId: string,
  hash: string,
): Promise<Buffer | null> {
  try {
    return await client.downloadBlob(canvasId, hash);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

/**
 * Back up whole canvases. For each: the record, the folded snapshot and
 * trash (derived, but what `cat` and a hand-copy restore want), the whole
 * log verbatim, and every blob the log names — including bytes behind a
 * version that is no longer current, and behind an undone add.
 */
export async function exportCanvases(
  client: DaemonRoutes,
  canvases: readonly Canvas[],
  options: ExportOptions,
): Promise<ExportReport> {
  const out = path.resolve(options.out);
  const say = options.say ?? (() => {});
  const written: string[] = [];
  const rows: ExportedCanvas[] = [];
  let names: Pick<CanvasSnapshotResponse, "names" | "colors"> | null = null;

  for (const canvas of canvases) {
    const entries = await wholeLog(client, canvas.id);
    const snapshot = await client.snapshot(canvas.id);
    names = { names: snapshot.names, colors: snapshot.colors };
    const named = blobsNamedBy(entries);
    const dir = path.join(L.canvases, canvas.id);
    const index: Record<string, ExportedBlob> = {};
    const missing: string[] = [];
    let bytes = 0;

    if (!options.dryRun) {
      await writeInto(out, path.join(dir, L.record), pretty(snapshot.project), written);
      await writeInto(
        out,
        path.join(dir, L.snapshot),
        pretty({
          lastSeq: snapshot.lastSeq,
          items: snapshot.canvas.items,
          threads: snapshot.canvas.threads,
          agents: snapshot.canvas.agents ?? {},
          ...(snapshot.canvas.groupCohorts ? { groupCohorts: snapshot.canvas.groupCohorts } : {}),
        }),
        written,
      );
      await writeInto(out, path.join(dir, L.trash), pretty(snapshot.canvas.trash), written);
      await writeInto(out, path.join(dir, L.oplog), lines(entries), written);
    }

    for (const [hash, meta] of named) {
      const file = blobFileName(hash, meta.filename, meta.mimeType);
      const rel = path.join(dir, L.blobs, file);
      if (options.dryRun) {
        bytes += meta.size;
        index[hash] = { file, ...meta };
        continue;
      }
      // Content-addressed: a blob already on disk under its hash is the blob.
      if (await present(path.join(out, rel), meta.size)) {
        const stat = await fs.stat(path.join(out, rel));
        index[hash] = { file, mimeType: meta.mimeType, filename: meta.filename, size: stat.size };
        bytes += stat.size;
        continue;
      }
      const data = await fetchBlob(client, canvas.id, hash);
      if (data === null) {
        missing.push(hash);
        continue;
      }
      await writeInto(out, rel, data, written);
      index[hash] = { file, mimeType: meta.mimeType, filename: meta.filename, size: data.length };
      bytes += data.length;
    }
    if (!options.dryRun) {
      await writeInto(out, path.join(dir, L.blobIndex), pretty(index), written);
    }

    const row: ExportedCanvas = {
      id: canvas.id,
      title: snapshot.project.title,
      entries: entries.length,
      lastSeq: entries.length > 0 ? entries[entries.length - 1]!.seq : 0,
      blobs: Object.keys(index).length,
      bytes,
      missing,
    };
    rows.push(row);
    say(`${options.dryRun ? "would write" : "wrote"} ${row.title} (${row.id}): ${row.entries} ops, ${row.blobs} blobs`);
  }

  if (!options.dryRun) {
    if (names) await writeInto(out, L.names, pretty(names), written);
    await writeManifest(out, client.base, options.by, rows, [], written);
  }
  return { out, from: client.base, dryRun: options.dryRun === true, canvases: rows, items: [], written };
}

/**
 * Back up one item: its record, every version's bytes, the threads pinned to
 * it, and the entries of the log that name it. Not a canvas — it does not
 * restore through `import` — but everything somebody would want back if the
 * item were the thing they cared about.
 */
export async function exportItem(
  client: DaemonRoutes,
  canvas: Canvas,
  item: Item,
  options: ExportOptions,
): Promise<ExportReport> {
  const out = path.resolve(options.out);
  const say = options.say ?? (() => {});
  const written: string[] = [];
  const entries = await wholeLog(client, canvas.id);
  const snapshot = await client.snapshot(canvas.id);
  const ops = opsTouching(entries, item.id);
  const threads = Object.values(snapshot.canvas.threads).filter((t) => t.anchorItemId === item.id);
  const dir = path.join(L.items, canvas.id, item.id);
  const missing: string[] = [];

  if (!options.dryRun) {
    await writeInto(out, path.join(dir, L.item), pretty(item), written);
    await writeInto(out, path.join(dir, L.itemOps), lines(ops), written);
    await writeInto(out, path.join(dir, L.itemThreads), pretty(threads), written);
    for (const [i, version] of item.versions.entries()) {
      const data = await fetchBlob(client, canvas.id, version.blobHash);
      if (data === null) {
        missing.push(version.blobHash);
        continue;
      }
      const name = `${String(i + 1).padStart(2, "0")}-${path.basename(version.filename)}`;
      await writeInto(out, path.join(dir, L.versions, name), data, written);
    }
  }

  const row: ExportedItem = {
    canvasId: canvas.id,
    itemId: item.id,
    title: item.title,
    versions: item.versions.length,
    ops: ops.length,
    missing,
  };
  say(`${options.dryRun ? "would write" : "wrote"} ${row.title} (${row.itemId}): ${row.versions} versions, ${row.ops} ops`);
  if (!options.dryRun) await writeManifest(out, client.base, options.by, [], [row], written);
  return { out, from: client.base, dryRun: options.dryRun === true, canvases: [], items: [row], written };
}

/**
 * The manifest merges rather than replaces: a directory that backs up three
 * canvases on three different days still lists all three. Rows are keyed by
 * id (and item id), so re-exporting one refreshes its row.
 */
async function writeManifest(
  out: string,
  from: string,
  by: Actor | undefined,
  canvases: ExportedCanvas[],
  items: ExportedItem[],
  written: string[],
): Promise<void> {
  const existing = await readManifest(out);
  const canvasRows = new Map((existing?.canvases ?? []).map((r) => [r.id, r]));
  for (const row of canvases) canvasRows.set(row.id, row);
  const itemRows = new Map((existing?.items ?? []).map((r) => [`${r.canvasId}/${r.itemId}`, r]));
  for (const row of items) itemRows.set(`${row.canvasId}/${row.itemId}`, row);
  const manifest: ExportManifest = {
    format: EXPORT_FORMAT,
    exportedAt: new Date().toISOString(),
    from,
    ...(by ? { by } : {}),
    canvases: [...canvasRows.values()],
    items: [...itemRows.values()],
  };
  /**
   * **Byte-stable when nothing changed.** `exportedAt` is when the manifest
   * last had something new to say, not when the command last ran: a nightly
   * `--git` over an idle canvas must produce no commit, and a timestamp that
   * moved on its own would make one every night — a history of the backup
   * running rather than of the canvas changing.
   */
  if (existing && pretty({ ...manifest, exportedAt: existing.exportedAt }) === pretty(existing)) return;
  await writeInto(out, L.manifest, pretty(manifest), written);
}

export async function readManifest(out: string): Promise<ExportManifest | null> {
  try {
    const parsed = JSON.parse(await fs.readFile(path.join(out, L.manifest), "utf8")) as ExportManifest;
    return parsed.format === EXPORT_FORMAT ? parsed : null;
  } catch {
    return null;
  }
}

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
  failed: Array<{ hash: string; error: string }>;
}

export interface ImportReport {
  dir: string;
  to: string;
  dryRun: boolean;
  restored: ImportedCanvas[];
  /** Canvases the home refused — most often because it already has one
   * under that id. A restore creates, never merges. */
  refused: Array<{ id: string; title: string; error: string }>;
}

/** The canvas directories an export holds — from disk, not the manifest, so
 * a hand-assembled directory (or one whose manifest was lost) still restores. */
export async function exportedCanvasIds(dir: string): Promise<string[]> {
  try {
    const names = await fs.readdir(path.join(dir, L.canvases), { withFileTypes: true });
    return names.filter((d) => d.isDirectory() && !d.name.startsWith(".")).map((d) => d.name).sort();
  } catch {
    return [];
  }
}

async function readLines<T>(file: string): Promise<T[]> {
  const text = await fs.readFile(file, "utf8");
  return text
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as T);
}

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
export async function importExport(
  client: DaemonRoutes,
  dir: string,
  options: ImportOptions = {},
): Promise<ImportReport> {
  const root = path.resolve(dir);
  const say = options.say ?? (() => {});
  const ids = (await exportedCanvasIds(root)).filter((id) => !options.only || id === options.only);
  if (ids.length === 0) {
    throw new Error(
      options.only
        ? `${root} holds no canvas ${options.only} — \`ls ${path.join(root, L.canvases)}\` lists what it has`
        : `${root} is not an isocan export: no ${L.canvases}/ directory with a canvas in it`,
    );
  }
  const restored: ImportedCanvas[] = [];
  const refused: ImportReport["refused"] = [];

  for (const id of ids) {
    const canvasDir = path.join(root, L.canvases, id);
    const recordRaw: unknown = JSON.parse(await fs.readFile(path.join(canvasDir, L.record), "utf8"));
    const title = isCanvasRecord(recordRaw) ? recordRaw.title : id;
    const entries = (await readLines<LogEntry>(path.join(canvasDir, L.oplog))).sort((a, b) => a.seq - b.seq);
    let index: Record<string, ExportedBlob> = {};
    try {
      index = JSON.parse(await fs.readFile(path.join(canvasDir, L.blobIndex), "utf8")) as Record<string, ExportedBlob>;
    } catch {
      index = {};
    }
    const row: ImportedCanvas = {
      id,
      title,
      entries: entries.length,
      blobs: Object.keys(index).length,
      uploaded: 0,
      failed: [],
    };
    if (options.dryRun) {
      restored.push(row);
      say(`would restore ${title} (${id}): ${row.entries} ops, ${row.blobs} blobs`);
      continue;
    }
    try {
      await client.adopt(id, entries);
    } catch (err) {
      refused.push({ id, title, error: (err as Error).message });
      say(`refused ${title} (${id}): ${(err as Error).message}`);
      continue;
    }
    for (const [hash, meta] of Object.entries(index)) {
      try {
        const data = await fs.readFile(path.join(canvasDir, L.blobs, meta.file));
        await client.uploadBlob(id, data, meta.mimeType, meta.filename);
        row.uploaded += 1;
      } catch (err) {
        row.failed.push({ hash, error: (err as Error).message });
      }
    }
    restored.push(row);
    say(`restored ${title} (${id}): ${row.entries} ops, ${row.uploaded}/${row.blobs} blobs`);
  }
  return { dir: root, to: client.base, dryRun: options.dryRun === true, restored, refused };
}
