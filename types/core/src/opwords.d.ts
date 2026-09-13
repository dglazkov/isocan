import type { Operation, OperationType } from "./ops.js";
/**
 * The act behind a canonical write, for activity summaries on both surfaces.
 * Group-mode insertion is still adding an item; the writer wraps it so its
 * placement and ancestor repairs are atomic. Explicit group creation stays a
 * group change. Undo keeps the original intent, so only actual creation
 * effects count as adding — an inverse insertion must not claim it added.
 */
export declare function activityOpType(op: Operation): OperationType;
/**
 * The phrase for an operation type, or `undefined` when there is not one.
 *
 * **The fallback belongs to the caller, and deliberately so.** A track drawn
 * for somebody reading history falls back to the raw op type, because naming
 * an unknown thing precisely is more useful there than a vague phrase —
 * `timeline.ts` decided that and a test holds it. A card on a home screen
 * cannot do the same: `item.setCurrentVersion` under a canvas shows a person
 * the vocabulary instead of telling them what happened, so it says "did
 * something" instead.
 *
 * That is not two surfaces disagreeing. Every op the system HAS is in the
 * table and both read the same words from it; they differ only on an op that
 * does not exist yet, where their audiences genuinely want different things.
 */
export declare function opWords(type: string | undefined): string | undefined;
