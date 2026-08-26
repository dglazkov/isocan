import type { LogEntry } from "./ops.ts";
import type { CanvasContents } from "./model.ts";

/**
 * The canvas's history at decaying resolution.
 *
 * An agent joining a canvas today reads `comment list` and `activity` and
 * forms its own impression, every time, from scratch. A recap is that
 * impression precomputed from the record both clients already hold: the most
 * recent operations verbatim, and everything older rolled up into windows
 * that double in size the further back they reach — so a thousand-op history
 * is a screenful, and every line carries the seq range that flies you to the
 * real entries (`tail`, and the archive behind it).
 *
 * The tiers are an INDEX into the history, not a replacement for it — the
 * same principle that keeps `gc` archiving rather than deleting (see
 * docs/research/2026-08-24-headlong.md). Nothing here summarizes what cannot
 * be re-read at full resolution.
 *
 * Pure over `LogEntry[]`, so it lives in core: the CLI renders it as text
 * today, and any other surface can render the same structure tomorrow.
 */

export interface RecapWindow {
  /** Inclusive seq span — the address of the full-resolution entries. */
  fromSeq: number;
  toSeq: number;
  /** Timestamps of the span's first and last entries. */
  fromTs: string;
  toTs: string;
  count: number;
  /** Most active first, by op count. */
  actors: Array<{ name: string; ops: number }>;
  /** thread.create + thread.reply — conversation is worth its own number. */
  comments: number;
  /** Items touched in this span, most touched first. Title is the item's
   * current one when it still exists, the op's own when the op carried one,
   * and null for an item that is gone and was never named in the span. */
  items: Array<{ id: string; title: string | null; ops: number }>;
}

export interface Recap {
  /** Every entry considered, archive included. */
  total: number;
  /** How many of those came from the archive rather than the live log. */
  archived: number;
  /** Oldest first; each window is half the resolution of the one after it. */
  windows: RecapWindow[];
  /** The last `verbatim` entries, untouched — recency deserves full detail. */
  recent: LogEntry[];
}

export interface RecapOptions {
  /** How many recent entries stay verbatim (default 10). */
  verbatim?: number;
  /** Count of entries (a prefix of `entries`) that came from the archive. */
  archived?: number;
  /** Current state, for naming items the ops only reference by id. */
  canvas?: CanvasContents | null;
}

/** Item ids an operation touches, however the op spells them. */
function touchedItems(entry: LogEntry): string[] {
  const op = entry.envelope.op as {
    itemId?: string;
    itemIds?: string[];
    moves?: Array<{ itemId: string }>;
    anchorItemId?: string;
  };
  if (op.itemId) return [op.itemId];
  if (op.itemIds) return op.itemIds;
  if (op.moves) return op.moves.map((move) => move.itemId);
  return [];
}

function summarize(entries: LogEntry[], canvas: CanvasContents | null | undefined): RecapWindow {
  const first = entries[0]!;
  const last = entries[entries.length - 1]!;
  const actors = new Map<string, number>();
  const items = new Map<string, { title: string | null; ops: number }>();
  let comments = 0;
  for (const entry of entries) {
    const op = entry.envelope.op;
    const who = entry.envelope.actor.name;
    actors.set(who, (actors.get(who) ?? 0) + 1);
    if (op.type === "thread.create" || op.type === "thread.reply") comments++;
    for (const id of touchedItems(entry)) {
      const row = items.get(id) ?? { title: null, ops: 0 };
      row.ops++;
      // The op's own title is a fallback for items that no longer exist; the
      // live state, checked below, wins because it is what a reader will see.
      const carried = (op as { title?: string }).title;
      if (carried && !row.title) row.title = carried;
      items.set(id, row);
    }
  }
  for (const [id, row] of items) {
    const live = canvas?.items[id];
    if (live) row.title = live.title;
  }
  return {
    fromSeq: first.seq,
    toSeq: last.seq,
    fromTs: first.envelope.ts,
    toTs: last.envelope.ts,
    count: entries.length,
    actors: [...actors.entries()]
      .map(([name, ops]) => ({ name, ops }))
      .sort((a, b) => b.ops - a.ops || a.name.localeCompare(b.name)),
    comments,
    items: [...items.entries()]
      .map(([id, row]) => ({ id, ...row }))
      .sort((a, b) => b.ops - a.ops || a.id.localeCompare(b.id)),
  };
}

/**
 * `entries` is the full history, oldest first — the archive (if any) followed
 * by the live log. The most recent `verbatim` entries pass through untouched;
 * behind them, windows of `verbatim*2`, `verbatim*4`, … entries are each
 * summarized to one `RecapWindow`, so resolution halves with each step back
 * and the whole past fits in O(log n) lines. The oldest window absorbs
 * whatever remains rather than leaving a stub.
 */
export function buildRecap(entries: LogEntry[], options: RecapOptions = {}): Recap {
  const verbatim = Math.max(0, options.verbatim ?? 10);
  const recent = verbatim > 0 ? entries.slice(-verbatim) : [];
  let older = entries.slice(0, entries.length - recent.length);

  const windows: RecapWindow[] = [];
  let size = Math.max(1, verbatim) * 2;
  while (older.length > 0) {
    // The final cut takes everything left: a lone window of 3 entries behind
    // a window of 40 would be noise pretending to be a tier.
    const take = older.length <= size * 2 ? older.length : size;
    windows.unshift(summarize(older.slice(-take), options.canvas));
    older = older.slice(0, -take);
    size *= 2;
  }

  return {
    total: entries.length,
    archived: options.archived ?? 0,
    windows,
    recent,
  };
}
