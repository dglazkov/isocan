import type { LogEntry } from "@isocan/core";

interface ActorStacks {
  undo: number[];
  redo: number[];
}

/**
 * Per-canvas, per-actor undo/redo stacks over the oplog — actor-scoped,
 * Figma-style: your undo walks YOUR ops backwards, another actor's ops are
 * invisible to it, and only your own fresh op truncates your redo branch.
 *
 * The stacks hold seqs. An undo entry's own `inverse` (computed pre-apply,
 * like every inverse) IS the redo op for its target. Because actors interleave,
 * a stored inverse can go stale (its values overwrite later edits — accepted:
 * undo restores what YOU changed) or invalid (its target was deleted by
 * someone else — the engine skips it via discard*Target). `undoneBy` is
 * derived bookkeeping, rebuilt from `cause` on load, never written to the log.
 */
export class UndoStacks {
  private byActor = new Map<string, ActorStacks>();
  /** targetSeq → seq of the undo entry that reversed it. */
  private undoneBy = new Map<number, number>();

  static rebuild(entries: LogEntry[]): UndoStacks {
    const stacks = new UndoStacks();
    for (const entry of entries) stacks.record(entry);
    return stacks;
  }

  private stacksFor(actorId: string): ActorStacks {
    let stacks = this.byActor.get(actorId);
    if (!stacks) {
      stacks = { undo: [], redo: [] };
      this.byActor.set(actorId, stacks);
    }
    return stacks;
  }

  /** Track an entry as it is appended (or replayed on load). Undo/redo
   * entries affect the stacks of the actor who performed them — which is
   * always the owner of their target, since stacks are per-actor. */
  record(entry: LogEntry): void {
    const stacks = this.stacksFor(entry.envelope.actor.id);
    if (entry.cause?.kind === "undo") {
      const target = entry.cause.targetSeq;
      this.undoneBy.set(target, entry.seq);
      stacks.undo = stacks.undo.filter((seq) => seq !== target);
      stacks.redo.push(target);
    } else if (entry.cause?.kind === "redo") {
      const target = entry.cause.targetSeq;
      this.undoneBy.delete(target);
      stacks.redo = stacks.redo.filter((seq) => seq !== target);
      stacks.undo.push(target);
    } else {
      // A fresh op truncates this actor's redo branch — even a non-undoable
      // one (it changed state the redo chain assumed). Other actors' redo
      // branches survive; if theirs became inapplicable, the skip policy
      // handles it at redo time.
      stacks.redo = [];
      if (entry.inverse !== null) stacks.undo.push(entry.seq);
    }
  }

  /** Seq of the entry this actor's next undo should reverse, or null. */
  nextUndoTarget(actorId: string): number | null {
    const { undo } = this.stacksFor(actorId);
    return undo.length > 0 ? undo[undo.length - 1]! : null;
  }

  /** For this actor's next redo: the original entry to re-do, plus the undo
   * entry whose stored inverse performs it. */
  nextRedoTarget(actorId: string): { targetSeq: number; undoSeq: number } | null {
    const { redo } = this.stacksFor(actorId);
    if (redo.length === 0) return null;
    const targetSeq = redo[redo.length - 1]!;
    const undoSeq = this.undoneBy.get(targetSeq);
    if (undoSeq === undefined) return null;
    return { targetSeq, undoSeq };
  }

  /** Drop an undo candidate whose inverse no longer applies (its objects were
   * removed by another actor). Nothing to redo — the effect is already gone. */
  discardUndoTarget(actorId: string, seq: number): void {
    const stacks = this.stacksFor(actorId);
    stacks.undo = stacks.undo.filter((s) => s !== seq);
  }

  /** Drop a redo candidate that can no longer be re-applied. */
  discardRedoTarget(actorId: string, seq: number): void {
    const stacks = this.stacksFor(actorId);
    stacks.redo = stacks.redo.filter((s) => s !== seq);
  }
}
