import type { Item, ItemVersion, CanvasState } from "./model.js";
import type { OpEnvelope } from "./ops.js";
/**
 * The shared pure reducer. The daemon runs it authoritatively; the web client
 * runs the identical function against its replica for every broadcast op.
 *
 * - `project.create` requires `state === null` and returns a fresh CanvasState.
 * - `project.delete` returns null (the engine moves the directory aside; the
 *   replica handles the separate "canvas-deleted" message).
 * - Every mutation stamps `updatedAt`/`updatedBy` from the envelope. Undo
 *   restores content, not these stamps — the undoer did mutate the item.
 */
export declare function applyOperation(state: CanvasState | null, envelope: OpEnvelope): CanvasState | null;
/** Primitive existing effects also compile a bounded content write before group-frame repair. */
export declare function reduceOperation(state: CanvasState | null, envelope: OpEnvelope): CanvasState | null;
/**
 * **The stack `item.pruneVersions` leaves behind** — exported so a surface
 * can say what a prune WOULD drop before anybody confirms it, from the same
 * rule the reducer applies (lessons.md #5: a rule with one home).
 *
 * The newest `keep` by stack order, plus the current version wherever it
 * sits. Order is preserved, so `v3` still means the third that was made.
 */
export declare function pruneVersions(item: Item, keep: number): ItemVersion[];
/** What `item.pruneVersions` would remove, in stack order. */
export declare function prunedVersions(item: Item, keep: number): ItemVersion[];
