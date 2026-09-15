import { type CanvasSnapshotResponse, type ItemVersion, type PostOpResponse, type SourceClassificationRequest } from "../../core/src/index.js";
import { type DesignArtifactRef } from "../../core/src/design-partner.js";
import { type DesignAcceptedResponse, type DesignRequestAction, type DesignRecordOperation, type DesignReceiptPublication, type DesignRequestsResponse, type DesignRequestState, type DesignReceiptState, type DesignGoverningBinding } from "../../core/src/design-request.js";
import type { DesignAuditReadPort } from "./design-audit-reader.js";
import { type GoverningDesignRead } from "./design-governing.js";
import { type DesignDecisionsResponse } from "../../core/src/design-decision.js";
import type { DesignComparisonView, DesignDecisionView } from "./design-decision-reader.js";
/** Request selection uses canonical identities; neither client scans arbitrary JSON artifacts. */
export interface DesignRequestFilter {
    requestId?: string;
    threadId?: string;
    commentId?: string;
    outputItemId?: string;
}
/** Browsers and Node inject their existing authenticated and source-policy-bearing transports. */
export interface DesignRequestReadPort extends DesignAuditReadPort {
    actorId?: string | undefined;
    snapshot(canvasId: string, signal?: AbortSignal): Promise<CanvasSnapshotResponse>;
    home(canvasId: string, signal?: AbortSignal): Promise<string>;
    requests(canvasId: string, signal?: AbortSignal): Promise<DesignRequestsResponse>;
    decisions(canvasId: string, signal?: AbortSignal): Promise<DesignDecisionsResponse>;
    decisionActors(canvasId: string, signal?: AbortSignal): Promise<{
        actors: Array<{
            id: string;
            name: string;
            kind: "human" | "agent" | "unknown";
        }>;
    }>;
    blobBytes(canvasId: string, hash: string, signal?: AbortSignal): Promise<Uint8Array>;
    sourceBlobBytes(source: SourceClassificationRequest, hash: string, signal?: AbortSignal): Promise<Uint8Array>;
}
/** Currentness describes named inputs; it does not promote an attributed browser report into attestation. */
export interface DesignReceiptView extends DesignReceiptState {
    affectedChecks: string[];
    runtimeFreshness: "not-applicable" | "reported";
}
/** One view drives CLI continuation, chat cards, the brief face and output association. */
export interface DesignRequestView extends Omit<DesignRequestState, "receipts"> {
    governing: GoverningDesignRead;
    governingBinding: DesignGoverningBinding;
    outputGovernings: Array<{
        itemId: string;
        governing: GoverningDesignRead;
        binding: DesignGoverningBinding;
    }>;
    contextReferences: DesignArtifactRef[];
    receipts: DesignReceiptView[];
    reconciliation: DesignAcceptedResponse[];
    missingFactIds: string[];
    comparisons: DesignComparisonView[];
    decisionHistory: DesignDecisionView[];
    effectiveDecisions: DesignDecisionView[];
    outstandingDecisionIds: string[];
    nextAction: "clarify" | "reconcile" | "answer" | "compare" | "decide" | "build" | "verify" | "resume" | "review";
}
/** Unreadable admitted records remain visible alongside usable request views. */
export interface DesignRequestReadResult {
    requests: DesignRequestView[];
    unavailable: DesignRequestsResponse["unavailable"];
}
/** The shared procedure travels with current canvas policy and the same request projection. */
export interface DesignWorkflowView extends DesignRequestReadResult {
    policy: "off" | "adaptive-v1" | "unsupported";
    procedure: string;
    reviews?: import("./design-review-reader.js").DesignReviewReadResult;
}
/** Delivery uncertainty preserves the caller's retry identity and never invents an accepted operation ID. */
export interface DesignRequestSubmission {
    status: "accepted" | "pending" | "refused";
    canvasId: string;
    itemId: string;
    versionId: string;
    submittedOpId: string;
    opId: string | null;
    confirmedBy?: "receipt" | "snapshot";
    seq?: number;
    reason?: string;
}
/** One canonical operation is sent through a writer-observed result, never a local optimistic queue alone. */
export interface DesignRequestWritePort extends Pick<DesignRequestReadPort, "actorId" | "snapshot"> {
    send(canvasId: string, operation: DesignRecordOperation, options: {
        opId: string;
        signal?: AbortSignal;
    }): Promise<{
        status: "accepted";
        receipt: PostOpResponse;
    } | {
        status: "pending" | "refused";
        reason: string;
    }>;
}
/** A stable prepared intent is retained unchanged across retries. */
export interface DesignStartRequest {
    canvasId: string;
    opId: string;
    action: Extract<DesignRequestAction, {
        kind: "start";
    }>;
    signal?: AbortSignal;
}
/** Updates capture their exact brief and epoch; resume is an explicit lifecycle act. */
export interface DesignChangeRequest {
    canvasId: string;
    opId: string;
    action: Exclude<DesignRequestAction, {
        kind: "start";
    }>;
    signal?: AbortSignal;
}
/** Receipt publication identifies its separate canvas artifact and the completed brief it reports. */
export interface DesignPublishRequest extends DesignReceiptPublication {
    canvasId: string;
    opId: string;
    signal?: AbortSignal;
}
/** Read canonical admission, then re-resolve current governing inputs through permitted source reads. */
export declare function readDesignRequests(io: DesignRequestReadPort, options: {
    canvasId: string;
    filter?: DesignRequestFilter;
    signal?: AbortSignal;
}): Promise<DesignRequestReadResult>;
/** Both entrances discover the same compact procedure and shared canvas-owned enrollment policy. */
export declare function readDesignWorkflow(io: DesignRequestReadPort, options: {
    canvasId: string;
    filter?: DesignRequestFilter;
    signal?: AbortSignal;
}): Promise<DesignWorkflowView>;
/** Start is explicit in the wire vocabulary, with all retry IDs owned by the prepared intent. */
export declare function startDesignRequest(io: DesignRequestWritePort, request: DesignStartRequest): Promise<DesignRequestSubmission>;
/** Lifecycle changes preserve the same conditional writer boundary across browser and CLI. */
export declare function changeDesignRequest(io: DesignRequestWritePort, request: DesignChangeRequest): Promise<DesignRequestSubmission>;
/** Evidence publication is a separate undoable item, bound to its completed brief. */
export declare function publishDesignReceipt(io: DesignRequestWritePort, request: DesignPublishRequest): Promise<DesignRequestSubmission>;
/** Exact bytes retain their source identity, source/visual face metadata and availability. */
export interface DesignRequestReferenceContent {
    artifact: DesignArtifactRef;
    version: ItemVersion;
    title: string;
    face: "source" | "visual";
    bytes: Uint8Array;
}
/** Reads only named request inputs/evidence; foreign bytes keep their source-policy transport. */
export declare function readDesignRequestReference(io: DesignRequestReadPort, request: {
    canvasId: string;
    requestId: string;
    artifact: DesignArtifactRef;
    face?: "source" | "visual";
    signal?: AbortSignal;
}): Promise<DesignRequestReferenceContent>;
