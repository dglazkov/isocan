import type { Actor, Canvas } from "./model.ts";
import type { LogEntry } from "./ops.ts";
import { extensionFor } from "./filenames.ts";
import { parseCanvasAddress, parseItemAddress } from "./address.ts";

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
export const EXPORT_FORMAT = "isocan-export/1";

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
export const EXPORT_LAYOUT = {
  manifest: "manifest.json",
  names: "names.json",
  canvases: "projects",
  items: "items",
  record: "project.json",
  snapshot: "canvas.json",
  trash: "trash.json",
  oplog: "oplog.jsonl",
  blobIndex: "blobs.json",
  blobs: "blobs",
  item: "item.json",
  itemOps: "ops.jsonl",
  itemThreads: "threads.json",
  versions: "versions",
} as const;

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
export type ExportTarget =
  | { kind: "home"; origin: string }
  | { kind: "canvas"; origin: string; canvasId: string }
  | { kind: "item"; origin: string; canvasId: string; itemId: string };

/**
 * A URL is a target when it is one of the three addresses this product
 * writes: `origin/p/<id>`, `origin/p/<id>/i/<item>`, or the origin alone.
 * The canvas and item forms come from `address.ts`, the one place their
 * spelling lives. A bare origin is a home — every canvas the caller may see
 * there. A string with no scheme and no dot is not a URL at all; it is a ref.
 */
export function parseExportTarget(raw: string): ExportTarget | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const item = parseItemAddress(trimmed);
  if (item) return { kind: "item", ...item };
  const canvas = parseCanvasAddress(trimmed);
  if (canvas) return { kind: "canvas", origin: canvas.origin, canvasId: canvas.canvasId };
  // A home: an origin with nothing after it. It has to CARRY its scheme (or
  // be loopback, which never has one typed) — a canvas titled "notes.md" is
  // a ref, and a rule that guessed `https://` in front of anything with a
  // dot would export the wrong thing from the wrong place.
  const loopback = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?\/?$/.test(trimmed);
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) && !loopback) return null;
  const schemed = loopback && !/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? `http://${trimmed}` : trimmed;
  let url: URL;
  try {
    url = new URL(schemed);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.pathname.replace(/\/+$/, "") !== "") return null;
  return { kind: "home", origin: url.origin };
}

/**
 * Every blob the log names, keyed by hash. Found by shape rather than by op
 * type — anything carrying `blobHash`, `mimeType` and `filename` together is
 * a version spec, whichever op it rides on — so a new op that names bytes is
 * backed up the day it ships rather than the day somebody remembers this.
 * Inverses are walked too: an undone `item.add`'s bytes are still part of
 * the history, and `redo` will want them.
 */
export function blobsNamedBy(
  entries: readonly LogEntry[],
): Map<string, { mimeType: string; filename: string; size: number }> {
  const found = new Map<string, { mimeType: string; filename: string; size: number }>();
  const visit = (value: unknown): void => {
    if (value === null || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const v of value) visit(v);
      return;
    }
    const record = value as Record<string, unknown>;
    if (
      typeof record.blobHash === "string" &&
      typeof record.mimeType === "string" &&
      typeof record.filename === "string"
    ) {
      if (!found.has(record.blobHash)) {
        found.set(record.blobHash, {
          mimeType: record.mimeType,
          filename: record.filename,
          size: typeof record.size === "number" ? record.size : 0,
        });
      }
      // Visual faces may omit filename/size and inherit the source metadata.
      // Resolve that inheritance while the containing version is still here,
      // including versions embedded in an atomic canvas-group creation.
      const visual = record.visual;
      if (visual !== null && typeof visual === "object" && !Array.isArray(visual)) {
        const face = visual as Record<string, unknown>;
        if (typeof face.blobHash === "string" && typeof face.mimeType === "string" && !found.has(face.blobHash)) {
          found.set(face.blobHash, { mimeType: face.mimeType, filename: typeof face.filename === "string" ? face.filename : record.filename, size: typeof face.size === "number" ? face.size : typeof record.size === "number" ? record.size : 0 });
        }
      }
    }
    for (const v of Object.values(record)) visit(v);
  };
  for (const entry of entries) {
    visit(entry.envelope.op);
    visit(entry.inverse);
  }
  return found;
}

/**
 * The entries that name one item, in log order. A structural walk for the id
 * rather than a list of which ops carry `itemId`, `itemIds` or `items`:
 * the vocabulary grows, and an item's history should not silently lose an
 * op because the walk was written before it. Ids are nanoids, so a match on
 * the whole string is a match on the item.
 */
export function opsTouching(entries: readonly LogEntry[], itemId: string): LogEntry[] {
  const mentions = (value: unknown): boolean => {
    if (value === itemId) return true;
    if (value === null || typeof value !== "object") return false;
    return Object.values(value as Record<string, unknown>).some(mentions);
  };
  return entries.filter((entry) => mentions(entry.envelope.op));
}

/** `<hash>.<ext>` — the name `FileStore.putBlob` files bytes under, so a
 * blob in an export is named exactly as it is under `~/.isocan`. */
export function blobFileName(hash: string, filename: string, mimeType: string): string {
  const ext = extensionFor(filename, mimeType);
  return ext ? `${hash}.${ext}` : hash;
}

/** One line for a manifest row, the way the CLI and a test both say it. */
export function describeExportedCanvas(row: ExportedCanvas): string {
  const ops = `${row.entries} op${row.entries === 1 ? "" : "s"}`;
  const blobs = `${row.blobs} blob${row.blobs === 1 ? "" : "s"}`;
  const missing = row.missing.length > 0 ? `, ${row.missing.length} missing` : "";
  return `${row.title} (${row.id}) — ${ops}, ${blobs}${missing}`;
}

/** The record a restore hands back — `project.json` from the export, with
 * nothing invented: the stamps are the ones the home wrote. */
export function isCanvasRecord(value: unknown): value is Canvas {
  const record = value as Partial<Canvas> | null;
  return (
    typeof record === "object" &&
    record !== null &&
    typeof record.id === "string" &&
    typeof record.title === "string" &&
    typeof record.createdAt === "string"
  );
}
