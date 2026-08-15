import type { LogEntry } from "@isocan/core";

/**
 * Per-project linear undo/redo stacks over the oplog, standard visual-editor
 * semantics: undo walks user ops backwards, redo walks undos backwards, any
 * new user op truncates the redo branch.
 *
 * The stacks hold seqs. An undo entry's own `inverse` (computed pre-apply,
 * like every inverse) IS the redo op for its target. `undoneBy` is derived
 * bookkeeping — rebuilt from `cause` on load, never written to the log file.
 */
export class UndoStack {
  private undoStack: number[] = [];
  private redoStack: number[] = [];
  /** targetSeq → seq of the undo entry that reversed it. */
  private undoneBy = new Map<number, number>();

  static rebuild(entries: LogEntry[]): UndoStack {
    const stack = new UndoStack();
    for (const entry of entries) stack.record(entry);
    return stack;
  }

  /** Track an entry as it is appended (or replayed on load). */
  record(entry: LogEntry): void {
    if (entry.cause?.kind === "undo") {
      const target = entry.cause.targetSeq;
      this.undoneBy.set(target, entry.seq);
      this.undoStack = this.undoStack.filter((seq) => seq !== target);
      this.redoStack.push(target);
    } else if (entry.cause?.kind === "redo") {
      const target = entry.cause.targetSeq;
      this.undoneBy.delete(target);
      this.redoStack = this.redoStack.filter((seq) => seq !== target);
      this.undoStack.push(target);
    } else {
      // A fresh user op truncates the redo branch — even a non-undoable one
      // (it changed state the redo chain assumed).
      this.redoStack = [];
      if (entry.inverse !== null) this.undoStack.push(entry.seq);
    }
  }

  /** Seq of the entry the next undo should reverse, or null. */
  nextUndoTarget(): number | null {
    return this.undoStack.length > 0 ? this.undoStack[this.undoStack.length - 1]! : null;
  }

  /**
   * For the next redo: the seq of the original entry to re-do, plus the seq
   * of the undo entry whose stored inverse performs it.
   */
  nextRedoTarget(): { targetSeq: number; undoSeq: number } | null {
    if (this.redoStack.length === 0) return null;
    const targetSeq = this.redoStack[this.redoStack.length - 1]!;
    const undoSeq = this.undoneBy.get(targetSeq);
    if (undoSeq === undefined) return null;
    return { targetSeq, undoSeq };
  }
}
