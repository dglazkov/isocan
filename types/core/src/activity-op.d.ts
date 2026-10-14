import type { Operation, OperationType } from "./ops.js";
/**
 * The act behind a canonical write, for activity summaries on both surfaces.
 * Group-mode insertion is still adding an item; the writer wraps it so its
 * placement and ancestor repairs are atomic. Explicit group creation stays a
 * group change. Undo keeps the original intent, so only actual creation
 * effects count as adding — an inverse insertion must not claim it added.
 */
export declare function activityOpType(op: Operation): OperationType;
