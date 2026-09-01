import type { CanvasState } from "./model.js";
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
