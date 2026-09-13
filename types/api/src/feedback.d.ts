import { type Actor, type WatchedLogEntry } from "../../core/src/index.js";
import type { DaemonRoutes } from "./routes.js";
/** A caller-owned read cursor; polling never acknowledges an inbox or starts presence. */
export interface FeedbackOptions {
    since?: number;
    timeoutMs?: number;
    signal?: AbortSignal;
}
/** Quiet timeout and cancellation retain the position through every inspected entry. */
export interface FeedbackResult {
    status: "feedback" | "timeout" | "cancelled";
    cursor: number;
    entries: WatchedLogEntry[];
}
/** The CLI's addressed-comment rule over a bounded, cancellable read poll. */
export declare function waitForFeedback(client: DaemonRoutes, canvasId: string, actor: Actor, options?: FeedbackOptions): Promise<FeedbackResult>;
/** One deadline from identity/admission through the final poll. A resolver
 * passes this signal into its per-call client and checks it between stages. */
export declare function waitForResolvedFeedback(resolve: (signal: AbortSignal) => Promise<{
    client: DaemonRoutes;
    canvasId: string;
    actor: Actor;
}>, options?: FeedbackOptions): Promise<FeedbackResult>;
