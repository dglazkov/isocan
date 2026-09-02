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
  /**
   * **A person may hold several stacks** (multi-identity phase 5). After
   * `actor.join` folds `Dimitri 2` into Dimitri, Dimitri's ⌘Z reaches the ops
   * either id wrote, in log order. The stacks stay per actor id — that is what
   * the log records — and every question below accepts the list of ids that
   * resolve to one person (`actorAliases`), walking them as one stack. A
   * caller with a single id gets exactly the behaviour there always was.
   */
  /** targetSeq → seq of the undo entry that reversed it. */
  private undoneBy = new Map<number, number>();
  /**
   * seq → the gesture it was part of, for the entries that named one.
   *
   * A group is what makes one ⌘Z reverse one ACT rather than one operation:
   * a paste of eight items writes eight `item.add`s, and undoing them one at
   * a time is undoing something nobody did. See `LogEntry.group`.
   */
  private groupOf = new Map<number, string>();

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
      // The target is removed from whichever stack holds it: the performer's
      // own, or — after a join — the stack of an id the performer used to
      // write under. For anyone not joined those are the same stack.
      for (const other of this.byActor.values()) {
        other.undo = other.undo.filter((seq) => seq !== target);
      }
      stacks.redo.push(target);
    } else if (entry.cause?.kind === "redo") {
      const target = entry.cause.targetSeq;
      this.undoneBy.delete(target);
      for (const other of this.byActor.values()) {
        other.redo = other.redo.filter((seq) => seq !== target);
      }
      stacks.undo.push(target);
    } else {
      // A fresh op truncates this actor's redo branch — even a non-undoable
      // one (it changed state the redo chain assumed). Other actors' redo
      // branches survive; if theirs became inapplicable, the skip policy
      // handles it at redo time.
      stacks.redo = [];
      if (entry.group !== undefined) this.groupOf.set(entry.seq, entry.group);
      if (entry.inverse !== null) stacks.undo.push(entry.seq);
    }
  }

  /**
   * One person's stack across every id they wrote under. An undo stack is
   * in log order per id, so the merge is a sort by seq. A redo stack is in
   * the order things were UNDONE — the last thing undone is the first thing
   * redone — so the merge sorts by the seq of the undo entry that put each
   * target there, which `undoneBy` remembers.
   */
  private merged(who: string | readonly string[], which: "undo" | "redo"): number[] {
    const ids = typeof who === "string" ? [who] : who;
    if (ids.length === 1) return this.stacksFor(ids[0]!)[which];
    const all: number[] = [];
    for (const id of ids) all.push(...this.stacksFor(id)[which]);
    const key = (seq: number) => (which === "undo" ? seq : (this.undoneBy.get(seq) ?? 0));
    return all.sort((a, b) => key(a) - key(b));
  }

  /** Seq of the entry this actor's next undo should reverse, or null. */
  nextUndoTarget(who: string | readonly string[]): number | null {
    const undo = this.merged(who, "undo");
    return undo.length > 0 ? undo[undo.length - 1]! : null;
  }

  /**
   * **Every seq one ⌘Z should reverse** — newest first, which is the order
   * they must be undone in.
   *
   * One entry unless the top of the stack named a gesture, in which case it
   * is the run of entries at the top that share it. A RUN, deliberately, and
   * not every member found anywhere: taking the contiguous top is what stops
   * an undo reaching past an unrelated op that happens to sit between two
   * members. Nothing writes such a sequence today — a gesture's ops are
   * written together — but a rule that cannot reach past its neighbour needs
   * nobody to keep that true.
   *
   * Another actor's ops are not in this stack at all, so their interleaving
   * cannot break a group. That falls out of the stacks being per-actor and is
   * the reason this stays simple.
   */
  nextUndoGroup(who: string | readonly string[]): number[] {
    const undo = this.merged(who, "undo");
    if (undo.length === 0) return [];
    const top = undo[undo.length - 1]!;
    const group = this.groupOf.get(top);
    if (group === undefined) return [top];
    const members: number[] = [];
    for (let i = undo.length - 1; i >= 0; i--) {
      if (this.groupOf.get(undo[i]!) !== group) break;
      members.push(undo[i]!);
    }
    return members;
  }

  /** The same question for redo: the group at the top of the redo stack,
   *  oldest first — the order they were originally written, which is the
   *  order that re-does them. */
  nextRedoGroup(who: string | readonly string[]): { targetSeq: number; undoSeq: number }[] {
    const redo = this.merged(who, "redo");
    if (redo.length === 0) return [];
    const top = redo[redo.length - 1]!;
    const group = this.groupOf.get(top);
    const seqs: number[] = [];
    if (group === undefined) {
      seqs.push(top);
    } else {
      for (let i = redo.length - 1; i >= 0; i--) {
        if (this.groupOf.get(redo[i]!) !== group) break;
        seqs.push(redo[i]!);
      }
      // Undone newest-first, so the redo stack holds them newest-last; put
      // them back in the order they were written.
      seqs.reverse();
    }
    const out: { targetSeq: number; undoSeq: number }[] = [];
    for (const targetSeq of seqs) {
      const undoSeq = this.undoneBy.get(targetSeq);
      if (undoSeq === undefined) return out;
      out.push({ targetSeq, undoSeq });
    }
    return out;
  }

  /** For this actor's next redo: the original entry to re-do, plus the undo
   * entry whose stored inverse performs it. */
  nextRedoTarget(who: string | readonly string[]): { targetSeq: number; undoSeq: number } | null {
    const redo = this.merged(who, "redo");
    if (redo.length === 0) return null;
    const targetSeq = redo[redo.length - 1]!;
    const undoSeq = this.undoneBy.get(targetSeq);
    if (undoSeq === undefined) return null;
    return { targetSeq, undoSeq };
  }

  /** Drop an undo candidate whose inverse no longer applies (its objects were
   * removed by another actor). Nothing to redo — the effect is already gone. */
  discardUndoTarget(who: string | readonly string[], seq: number): void {
    for (const id of typeof who === "string" ? [who] : who) {
      const stacks = this.stacksFor(id);
      stacks.undo = stacks.undo.filter((s) => s !== seq);
    }
  }

  /** Drop a redo candidate that can no longer be re-applied. */
  discardRedoTarget(who: string | readonly string[], seq: number): void {
    for (const id of typeof who === "string" ? [who] : who) {
      const stacks = this.stacksFor(id);
      stacks.redo = stacks.redo.filter((s) => s !== seq);
    }
  }
}
