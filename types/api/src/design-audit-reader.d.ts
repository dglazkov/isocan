import { type CanvasContents, type SourceClassificationRequest } from "../../core/src/index.js";
import type { ScreenAudit } from "@isocan/core/design-audit";
import { type ContextReadPort } from "./context-reader.js";
/** Both transports enforce automatic-source policy on the actual inherited blob read. */
export interface DesignAuditReadPort extends Pick<ContextReadPort, "classifySource" | "sourceSnapshot"> {
    blobText(canvasId: string, hash: string, signal?: AbortSignal): Promise<string>;
    sourceBlobText(source: SourceClassificationRequest, hash: string, signal?: AbortSignal): Promise<string>;
}
/** Select current HTML sources by exact identity, optionally within one canvas scope. */
export interface DesignAuditOptions {
    /** Exact ids; reference resolution belongs to the caller. Omission selects all screens. */
    itemIds?: string[];
    scopeId?: string;
    signal?: AbortSignal;
}
/** The governing document's immutable source identity, including its original canvas. */
export interface DesignAuditProvenance {
    canvasId: string;
    itemId: string;
    versionId: string;
    blobHash: string;
    title: string;
    name: string;
    inherited: boolean;
}
interface ItemAuditIdentity {
    canvasId: string;
    itemId: string;
    title: string;
    versionId: string;
    blobHash: string | null;
}
/** Unavailable source or policy reads remain explicit instead of yielding a conforming audit. */
export type ItemDesignAudit = ItemAuditIdentity & ((ScreenAudit & {
    status: "audited";
    governing: DesignAuditProvenance;
}) | {
    status: "unavailable";
    reason: string;
    governing: DesignAuditProvenance | null;
});
/** Per-screen findings and read failures, with compatibility totals for existing audit consumers. */
export interface CanvasDesignAudit {
    canvasId: string;
    ruleVersion: string;
    /** Compatibility label: the single effective system's name, else "Multiple design systems". */
    system: string | null;
    screens: number;
    offSystem: number;
    audited: number;
    unavailable: number;
    items: ItemDesignAudit[];
    /** A refused inheritance edge is visible even when another source can supply a system. */
    refusedSources: {
        canvasId: string;
        itemId: string;
        reason: string;
    }[];
}
/** Browser-safe orchestration. Reports are derived from the supplied snapshot and immutable blobs. */
export declare function readCanvasDesignAudit(io: DesignAuditReadPort, options: DesignAuditOptions & {
    canvasId: string;
    home: string;
    canvas: CanvasContents;
}): Promise<CanvasDesignAudit>;
export {};
