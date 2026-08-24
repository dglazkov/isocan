import type { GcReport, GcRequest, LogEntry, Operation, CanvasState } from "@isocan/core";

/**
 * Pure pieces of blob garbage collection: choosing the compaction horizon and
 * computing the reachable blob set. The engine wires these to storage inside
 * its single-writer queue. Wire shapes (GcRequest/GcReport) live in
 * @isocan/core's protocol so both CLI and web speak them.
 */

export type GcOptions = GcRequest;
export type { GcReport };

export const DEFAULT_KEEP_OPS = 500;
export const DEFAULT_GRACE_MS = 10 * 60 * 1000;

/**
 * Keep the newest `keepOps` entries, then extend to a pair-complete set so
 * undo/redo never dangle across the cut:
 *  - a retained undo/redo entry pulls in its target (`cause.targetSeq`);
 *  - a retained entry that is currently undone pulls in its undoer, so the
 *    rebuilt stacks still know it is undone (otherwise it would reappear as
 *    an undo candidate whose effect is already reverted).
 * Returns entries in log order.
 */
export function chooseRetained(entries: LogEntry[], keepOps: number): LogEntry[] {
  const bySeq = new Map(entries.map((entry) => [entry.seq, entry]));

  // Final undone-state: an undo marks its target undone; a redo clears it.
  const undoneBy = new Map<number, number>();
  for (const entry of entries) {
    if (entry.cause?.kind === "undo") undoneBy.set(entry.cause.targetSeq, entry.seq);
    else if (entry.cause?.kind === "redo") undoneBy.delete(entry.cause.targetSeq);
  }

  // Careful: slice(-0) === slice(0) would keep everything.
  const newest = keepOps <= 0 ? [] : entries.slice(-keepOps);
  const retained = new Set<number>(newest.map((e) => e.seq));
  let grew = true;
  while (grew) {
    grew = false;
    for (const seq of [...retained]) {
      const entry = bySeq.get(seq)!;
      const wants: number[] = [];
      if (entry.cause) wants.push(entry.cause.targetSeq);
      const undoer = undoneBy.get(seq);
      if (undoer !== undefined) wants.push(undoer);
      for (const want of wants) {
        if (!retained.has(want) && bySeq.has(want)) {
          retained.add(want);
          grew = true;
        }
      }
    }
  }
  return entries.filter((entry) => retained.has(entry.seq));
}

/** Every blobHash an operation can (re-)introduce. */
export function hashesInOperation(op: Operation): string[] {
  switch (op.type) {
    case "item.add":
    case "item.addVersion":
    case "item.restoreVersion":
      return [op.version.blobHash];
    default:
      return [];
  }
}

/** The mark set: live state ∪ trash ∪ retained entries (ops and inverses). */
export function reachableHashes(state: CanvasState, retained: LogEntry[]): Set<string> {
  const marked = new Set<string>();
  for (const item of Object.values(state.canvas.items)) {
    for (const version of item.versions) marked.add(version.blobHash);
  }
  for (const entry of state.canvas.trash) {
    for (const version of entry.item.versions) marked.add(version.blobHash);
  }
  for (const entry of retained) {
    for (const hash of hashesInOperation(entry.envelope.op)) marked.add(hash);
    if (entry.inverse) {
      for (const hash of hashesInOperation(entry.inverse)) marked.add(hash);
    }
  }
  return marked;
}
