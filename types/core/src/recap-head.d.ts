import type { LogEntry } from "./ops.js";
import type { CanvasContents } from "./model.js";
/** Current, bounded activity facts; no raw entries or historical item names. */
interface RecapHead {
    fromSeq: number;
    toSeq: number;
    fromTs: string;
    toTs: string;
    count: number;
    comments: number;
    actors: Array<{
        name: string;
        ops: number;
    }>;
    items: Array<{
        id: string;
        title: string;
        ops: number;
    }>;
    omitted: {
        /** Available older entries, without claiming the older history is complete. */
        earlierAvailableOps: number;
        actors: number;
        /** Eligible current rows beyond the displayed item budget. */
        items: number;
        /** Distinct touched items now absent or excluded, including excluded descendants. */
        hiddenItems: number;
        /** Displayed names/titles clipped to the shared Unicode code-point bound. */
        clippedLabels: number;
    };
}
/** The authority identifies the exact source and captured revision beside its facts. */
export interface RecapHeadResponse {
    canvasId: string;
    home: string;
    title: string;
    revision: number;
    head: RecapHead;
}
/** Recap display labels share one code-point bound, including the source title. */
export declare function clipRecapLabel(value: string): {
    text: string;
    clipped: boolean;
};
/** Assemble a contiguous recent range from live/archive entries. A missing or
 * conflicting required sequence is unavailable, never an empty success. The
 * caller captures revision/state/history together under its writer boundary. */
export declare function buildRecapHead(entries: LogEntry[], canvas: CanvasContents, revision: number): RecapHead | null;
/** CLI, web and MCP render the same bounded facts and explicit omissions. */
export declare function formatRecapHead(head: RecapHead): string;
/** Automatic inheritance reads this metadata route instead of the raw oplog. */
export declare function recapHeadRoute(canvasId: string): string;
export {};
