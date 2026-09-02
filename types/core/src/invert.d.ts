import type { CanvasState } from "./model.js";
import type { Operation } from "./ops.js";
/**
 * Compute the inverse of an operation against the state it is ABOUT to be
 * applied to. The daemon runs this before applying and stores the result in
 * the LogEntry — inverses are never re-derived later.
 *
 * Returns null for operations that are not undoable (trash.empty,
 * project.delete). Both are confirmation-gated at the client.
 */
export declare function invertOperation(stateBefore: CanvasState | null, op: Operation): Operation | null;
