import type { LogEntry } from "../../core/src/index.js";
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
export declare class UndoStacks {
    private byActor;
    /** targetSeq → seq of the undo entry that reversed it. */
    private undoneBy;
    /**
     * seq → the gesture it was part of, for the entries that named one.
     *
     * A group is what makes one ⌘Z reverse one ACT rather than one operation:
     * a paste of eight items writes eight `item.add`s, and undoing them one at
     * a time is undoing something nobody did. See `LogEntry.group`.
     */
    private groupOf;
    static rebuild(entries: LogEntry[]): UndoStacks;
    private stacksFor;
    /** Track an entry as it is appended (or replayed on load). Undo/redo
     * entries affect the stacks of the actor who performed them — which is
     * always the owner of their target, since stacks are per-actor. */
    record(entry: LogEntry): void;
    /** Seq of the entry this actor's next undo should reverse, or null. */
    nextUndoTarget(actorId: string): number | null;
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
    nextUndoGroup(actorId: string): number[];
    /** The same question for redo: the group at the top of the redo stack,
     *  oldest first — the order they were originally written, which is the
     *  order that re-does them. */
    nextRedoGroup(actorId: string): {
        targetSeq: number;
        undoSeq: number;
    }[];
    /** For this actor's next redo: the original entry to re-do, plus the undo
     * entry whose stored inverse performs it. */
    nextRedoTarget(actorId: string): {
        targetSeq: number;
        undoSeq: number;
    } | null;
    /** Drop an undo candidate whose inverse no longer applies (its objects were
     * removed by another actor). Nothing to redo — the effect is already gone. */
    discardUndoTarget(actorId: string, seq: number): void;
    /** Drop a redo candidate that can no longer be re-applied. */
    discardRedoTarget(actorId: string, seq: number): void;
}
