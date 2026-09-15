import { type CanvasContents, type CanvasSnapshotResponse, type Operation, type SourceClassificationRequest } from "../../core/src/index.js";
import type { ScreenAudit } from "../../core/src/designaudit.js";
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
    /** The editor supplies its actual base; a fresh current version must never replace that identity. */
    draft?: {
        itemId: string;
        text: string;
        baseVersionId: string;
        label?: string;
    };
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
/** A digest of the decoded UTF-8 source actually supplied to the analyzer, independent of storage. */
export interface DesignAuditInput {
    kind: "stored" | "draft" | "file";
    sha256: string;
    size: number;
    label: string;
    baseVersionId?: string;
}
interface ItemAuditIdentity {
    canvasId: string;
    itemId: string;
    title: string;
    /** Stored current version, or the explicitly captured editor base when input.kind is draft. */
    versionId: string;
    blobHash: string | null;
    input: DesignAuditInput | null;
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
/** Hash exact source text so a changed editor buffer cannot reuse earlier source selections or repairs. */
export declare function designAuditInput(text: string, options: Pick<DesignAuditInput, "kind" | "label" | "baseVersionId">): Promise<DesignAuditInput>;
/** A saved write's subsequent audit is advisory; an unavailable read cannot reverse its receipt. */
export type DesignAuditEvidence = {
    status: "available";
    report: CanvasDesignAudit;
} | {
    status: "unavailable";
    reason: string;
};
/** Convert a later analysis/read failure into evidence without misreporting an already stored write. */
export declare function readDesignAuditAdvisory(read: () => Promise<CanvasDesignAudit>): Promise<DesignAuditEvidence>;
/** A local or contextual file is analyzed as its own input, without invented stored item identity. */
export type SourceDesignAudit = {
    input: DesignAuditInput;
    governing: DesignAuditProvenance | {
        kind: "file";
        input: DesignAuditInput;
    } | null;
} & ((ScreenAudit & {
    status: "audited";
}) | {
    status: "unavailable";
    reason: string;
    ruleVersion: string;
});
/** Analyze supplied HTML and DESIGN.md bytes without a canvas or any transport reads. */
export declare function auditDesignSource(text: string, designText: string, options: {
    label: string;
    designLabel: string;
}): Promise<SourceDesignAudit>;
/** Read a file against an item's/group's effective context without pretending the file is stored there. */
export declare function readDesignSourceAudit(io: DesignAuditReadPort, options: {
    canvasId: string;
    canvas: CanvasContents;
    home: string;
    text: string;
    label: string;
    atId?: string;
    signal?: AbortSignal;
}): Promise<SourceDesignAudit>;
/** Opt-in automation failure includes unknown/empty coverage; it is never a visual approval signal. */
export declare function designAuditFails(report: CanvasDesignAudit | SourceDesignAudit): boolean;
/** Explicit repair transport distinguishes an accepted edit from an offline queue or refused write. */
export interface DesignRepairPort extends DesignAuditReadPort {
    snapshot(canvasId: string, signal?: AbortSignal): Promise<CanvasSnapshotResponse>;
    home(canvasId: string, signal?: AbortSignal): Promise<string>;
    upload(canvasId: string, text: string, filename: string, signal?: AbortSignal): Promise<{
        blobHash: string;
        size: number;
    }>;
    edit(canvasId: string, operation: Extract<Operation, {
        type: "item.edit";
    }>, signal?: AbortSignal): Promise<{
        accepted: true;
    } | {
        accepted: false;
        status: "refused" | "pending";
        reason: string;
    }>;
}
/** Captured policy and source versions accompany an authored replacement; no token policy edit is implicit. */
export interface DesignRepairRequest {
    canvasId: string;
    itemId: string;
    text: string;
    expectedVersionId: string;
    expectedGoverning: DesignAuditProvenance;
    expectedRuleVersion: string;
    filename?: string;
    signal?: AbortSignal;
}
/** Accepted content remains saved even when its post-save audit is unavailable or superseded. */
export type DesignRepairResult = {
    status: "saved";
    itemId: string;
    versionId: string;
    blobHash: string;
    before: ItemDesignAudit;
    proposed: ItemDesignAudit;
    after: DesignAuditEvidence;
    governingChanged: boolean | null;
    superseded: boolean | null;
} | {
    status: "pending";
    itemId: string;
    versionId: string;
    blobHash: string;
    reason: string;
    before: ItemDesignAudit;
    proposed: ItemDesignAudit;
} | {
    status: "refused";
    code: "stale-version" | "governing-changed" | "rule-version-changed" | "audit-unavailable" | "write-refused";
    reason: string;
    before?: ItemDesignAudit;
};
/** Refresh policy before conditional item.edit, then report current evidence without claiming a cross-canvas lock. */
export declare function repairDesignScreen(io: DesignRepairPort, request: DesignRepairRequest): Promise<DesignRepairResult>;
export {};
