import type { LogEntry } from "./ops.ts";
import type { CanvasContents } from "./model.ts";
import { itemsTouchedBy } from "./touches.ts";

/** Shared intermediate activity counts; historical fallback names are not safe inherited output. */
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

/** Item ids an operation touches, however the op spells them. */
function touchedItems(entry: LogEntry): string[] {
  if (entry.envelope.op.type === "group.change") return itemsTouchedBy(entry.envelope.op);
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

/** Shared deterministic activity counting for full recaps and safe inherited heads. */
export function summarizeRecapWindow(entries: LogEntry[], canvas: CanvasContents | null | undefined): RecapWindow {
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
