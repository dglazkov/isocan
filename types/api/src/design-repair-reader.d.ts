import { type CanvasSnapshotResponse, type PostOpResponse } from "../../core/src/index.js";
import { type DesignRepairInput, type DesignRepairOperation, type DesignRepairsResponse } from "../../core/src/design-repair.js";
import { type DesignAuditReadPort, type CanvasDesignAudit } from "./design-audit-reader.js";
/** Capture precedes editing and includes metadata/scope; preparing source never silently refreshes it. */
export interface DesignRepairBasis {
    canvasId: string;
    repair: Omit<DesignRepairInput, "id" | "version">;
    filename: string;
}
/** The exact actor, bytes and stable operation/version identities form the immutable retry journal. */
export interface PreparedDesignRepair {
    schemaVersion: 1;
    canvasId: string;
    actorId: string;
    opId: string;
    text: string;
    filename: string;
    operation: DesignRepairOperation;
}
/** Existing authenticated transports provide canonical repair history, not optimistic version-presence proof. */
export interface PreparedDesignRepairPort extends DesignAuditReadPort {
    actorId?: string | undefined;
    snapshot(canvasId: string, signal?: AbortSignal): Promise<CanvasSnapshotResponse>;
    home(canvasId: string, signal?: AbortSignal): Promise<string>;
    repairs(canvasId: string, signal?: AbortSignal): Promise<DesignRepairsResponse>;
    upload(canvasId: string, text: string, filename: string, signal?: AbortSignal): Promise<{
        blobHash: string;
        size: number;
    }>;
    sendRepair(canvasId: string, operation: DesignRepairOperation, options: {
        opId: string;
        signal?: AbortSignal;
    }): Promise<{
        status: "accepted";
        receipt: PostOpResponse;
    } | {
        status: "pending" | "refused";
        reason: string;
        code?: string;
    }>;
}
/** Accepted identity remains saved even when current policy, output or the follow-up read changes. */
export interface DesignRepairSubmission {
    status: "accepted" | "pending" | "refused";
    submittedOpId: string;
    opId: string | null;
    itemId: string;
    versionId: string;
    blobHash: string;
    seq?: number;
    reason?: string;
    consistency?: {
        status: "current" | "stale" | "unavailable";
        reasons: string[];
    };
    audit?: CanvasDesignAudit;
}
/** Restore the captured editor basis without inventing operation or replacement version identities. */
export declare function parseDesignRepairBasis(value: unknown): DesignRepairBasis;
/** Validate restored full retry intent, including exact source hash, before any persistence or transport action. */
export declare function validatePreparedDesignRepair(value: unknown): Promise<PreparedDesignRepair>;
/** Read one exact target and its governing identity, including an explicit known absence. */
export declare function captureDesignRepair(io: Pick<PreparedDesignRepairPort, "snapshot" | "home" | "classifySource" | "sourceSnapshot" | "blobText" | "sourceBlobText">, options: {
    canvasId: string;
    itemId: string;
    request?: DesignRepairInput["request"];
    review?: DesignRepairInput["review"];
    signal?: AbortSignal;
}): Promise<DesignRepairBasis>;
/** Validate and hash authored HTML before the caller persists an immutable intent; no read or upload occurs here. */
export declare function prepareDesignRepair(options: {
    basis: DesignRepairBasis;
    text: string;
    actorId: string;
    opId: string;
    versionId: string;
    repairId: string;
}): Promise<PreparedDesignRepair>;
/** Retry reaches canonical history before any stale source preflight; unrelated receipts never confirm this content. */
export declare function submitDesignRepair(io: PreparedDesignRepairPort, prepared: PreparedDesignRepair, options?: {
    retry?: boolean;
    signal?: AbortSignal;
}): Promise<DesignRepairSubmission>;
