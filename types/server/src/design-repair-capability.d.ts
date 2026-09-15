import { type LogEntry } from "../../core/src/index.js";
/** An old decoder must upgrade before observing the new repair operation or its canonical history. */
export declare class DesignRepairClientError extends Error {
    readonly code = "design-repairs-required";
    constructor();
}
/** Gate actual exposed repair semantics; ordinary restored HTML is still an ordinary snapshot. */
export declare function requireDesignRepairClient(features: unknown, entries: readonly LogEntry[]): void;
