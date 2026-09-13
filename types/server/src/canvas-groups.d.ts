import { type Canvas, type LogEntry, type Operation } from "../../core/src/index.js";
/** A protocol refusal must stop reads and queued writes before group state
 * reaches a reducer which does not understand it. It is not an ACL failure. */
export declare class CanvasGroupsClientError extends Error {
    readonly code = "canvas-groups-required";
    constructor();
}
/** Log reads and socket broadcasts also inspect the record itself: a group
 * creation can be the first event an already-connected legacy client sees. */
export declare function groupOperation(op: Operation): boolean;
/** Snapshot mode and log contents are separate evidence. Check either before
 * serving state, including archived group operations after a mode rollback. */
export declare function requireGroupClient(features: unknown, canvas?: Canvas, entries?: readonly LogEntry[]): void;
