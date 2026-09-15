import { type CanvasContents, type LogEntry, type Operation } from "../../core/src/index.js";
/** An unsupported paired-decision decoder must upgrade, not retry with different credentials. */
export declare class DesignDecisionClientError extends Error {
    readonly code = "design-decisions-required";
    constructor();
}
/** Actual op and inverse payloads, including archived receipts, establish required decoding support. */
export declare function designDecisionOperation(op: Operation): boolean;
/** Transparent relays use the caller's feature declaration, never their own decoder's capability. */
export declare function requireDesignDecisionClient(features: unknown, canvas?: CanvasContents, entries?: readonly LogEntry[]): void;
