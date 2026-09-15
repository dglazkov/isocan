import { type CanvasContents, type LogEntry, type Operation } from "../../core/src/index.js";
/** Decoder refusal cannot be repaired by credential retries or silently dropping admission metadata. */
export declare class DesignRequestClientError extends Error {
    readonly code = "design-requests-required";
    constructor();
}
/** Both canonical acts and ordinary inverses carrying new metadata require the new decoder. */
export declare function designRequestOperation(op: Operation): boolean;
/** Checks current state and actual receipts/inverses, including archived retries. */
export declare function requireDesignRequestClient(features: unknown, canvas?: CanvasContents, entries?: readonly LogEntry[]): void;
