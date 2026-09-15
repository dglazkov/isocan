import { type Operation, type PostOpResponse } from "../../core/src/index.js";
import { type DesignArtifactRef, type DesignReceipt } from "../../core/src/design-partner.js";
import type { DesignChangeRequest, DesignPublishRequest } from "./design-request-reader.js";
import { type PreparedDesignRepair, type PreparedDesignRepairPort } from "./design-repair-reader.js";
import { type DesignReviewReadPort } from "./design-review-reader.js";
import { type DesignReviewObligation, type DesignReviewObservation, type DesignReviewFinding, type DesignVerifierOffer } from "./design-review-contract.js";
/** Generic ordinary writes retain a writer receipt and original actor, rather than a local optimistic acknowledgement. */
export interface DesignReviewWritePort extends DesignReviewReadPort {
    uploadReview(canvasId: string, text: string, filename: string, signal?: AbortSignal): Promise<{
        blobHash: string;
        size: number;
    }>;
    sendReview(canvasId: string, operation: Operation, options: {
        opId: string;
        originGroupMode: "groups" | "legacy";
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
/** Pure persisted envelope: text, actor and complete ordinary operation are immutable across uncertain delivery. */
export interface PreparedDesignReviewWrite {
    schemaVersion: 1;
    canvasId: string;
    actorId: string;
    opId: string;
    originGroupMode: "groups" | "legacy";
    text: string | null;
    operation: Extract<Operation, {
        type: "item.add" | "item.edit" | "thread.reply" | "thread.create";
    }>;
    handoff?: {
        runId: string;
        offer: DesignArtifactRef;
    };
}
/** Acceptance survives unavailable post-save reads; consistency does not rewrite operation history. */
export interface DesignReviewSubmission {
    status: "accepted" | "pending" | "refused";
    submittedOpId: string;
    opId: string | null;
    seq?: number;
    reason?: string;
    consistency?: {
        status: "current" | "stale" | "unavailable";
        reasons: string[];
    };
}
/** One reservation's stable IDs are generated before work and persist through every retry. */
export interface DesignReviewWriteIds {
    opId: string;
    versionId: string;
}
/** Actual observation input excludes source facts: this path executes the shared source analyzer itself. */
export interface DesignReviewRecordInput {
    outcome: "reviewed" | "invalid" | "noop";
    note: string;
    observations: DesignReviewObservation[];
    findings: DesignReviewFinding[];
    output?: DesignReceipt["output"];
    repositorySource?: {
        text: string;
        path: string;
        designText?: string;
        designPath?: string;
    };
}
/** A start identifies an admitted task, actual delivery and concrete obligations, with explicit linked rerun intent. */
export interface DesignReviewStartInput extends DesignReviewWriteIds {
    canvasId: string;
    requestId: string;
    runId: string;
    itemId: string;
    passId: string;
    sessionId: string;
    output: DesignReceipt["output"];
    obligations: DesignReviewObligation[];
    mode?: "review" | "audit-only";
    preceding?: {
        run: DesignArtifactRef;
        reason: string;
    };
    signal?: AbortSignal;
}
/** Each append binds the exact shared version seen by its caller, preventing competing reservations. */
export interface DesignReviewStepInput extends DesignReviewWriteIds {
    canvasId: string;
    runId: string;
    base: DesignArtifactRef;
    action: "record" | "begin-repair" | "finish";
    passId?: string;
    sessionId?: string;
    record?: DesignReviewRecordInput;
    signal?: AbortSignal;
}
/** Reserve one initial inspection after reading shared history; a rerun needs an explicit prior run and reason. */
export declare function prepareDesignReviewStart(io: DesignReviewWritePort, options: DesignReviewStartInput): Promise<PreparedDesignReviewWrite>;
/** Record real native observations, reserve bounded repair work, or close this authored report against one captured version. */
export declare function prepareDesignReviewStep(io: DesignReviewWritePort, options: DesignReviewStepInput): Promise<PreparedDesignReviewWrite>;
/** A positive verifier offer names the caller's actually live session and an immutable run/output scope. */
export declare function prepareDesignVerifierOffer(io: DesignReviewWritePort, options: {
    canvasId: string;
    itemId: string;
    opId: string;
    versionId: string;
    offer: DesignVerifierOffer;
    signal?: AbortSignal;
}): Promise<PreparedDesignReviewWrite>;
/** Handoff is one addressed ordinary comment; it never records an inspection or replenishes its budget. */
export declare function prepareDesignReviewHandoff(io: DesignReviewWritePort, options: {
    canvasId: string;
    runId: string;
    offer: DesignArtifactRef;
    threadId: string;
    commentId: string;
    opId: string;
    signal?: AbortSignal;
}): Promise<PreparedDesignReviewWrite>;
/** Task repairs can use only an already reserved pass and the author's current captured basis. */
export declare function prepareDesignReviewRepair(io: DesignReviewWritePort & PreparedDesignRepairPort, options: {
    canvasId: string;
    runId: string;
    base: DesignArtifactRef;
    text: string;
    opId: string;
    versionId: string;
    repairId: string;
    signal?: AbortSignal;
}): Promise<PreparedDesignRepair>;
/** Completion is its existing separate conditional act, prepared from the run's original active brief. */
export declare function prepareDesignReviewCompletion(io: DesignReviewReadPort, options: {
    canvasId: string;
    runId: string;
    base: DesignArtifactRef;
    opId: string;
    versionId: string;
    signal?: AbortSignal;
}): Promise<DesignChangeRequest>;
/** Publish the independent source/task/craft readings using existing receipt roots and the exact completed brief. */
export declare function prepareDesignReviewReceipt(io: DesignReviewReadPort, options: {
    canvasId: string;
    runId: string;
    base: DesignArtifactRef;
    opId: string;
    itemId: string;
    versionId: string;
    receiptId: string;
    signal?: AbortSignal;
}): Promise<DesignPublishRequest>;
/** Restored journals validate their exact document hash and full supported operation before transport. */
export declare function validatePreparedDesignReviewWrite(value: unknown): Promise<PreparedDesignReviewWrite>;
/** Submit only a persisted immutable intent; recover full canonical effects/actors from live and archived receipts. */
export declare function submitDesignReviewWrite(io: DesignReviewWritePort, prepared: PreparedDesignReviewWrite, options?: {
    retry?: boolean;
    signal?: AbortSignal;
}): Promise<DesignReviewSubmission>;
