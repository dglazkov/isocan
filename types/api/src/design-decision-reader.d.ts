import { type ItemVersion, type PostOpResponse } from "../../core/src/index.js";
import { designComparisonActions, type DesignApprovalBasis, type DesignComparison, type DesignComparisonResponse, type DesignComparisonState, type DesignDecisionInput, type DesignDecisionOperation, type DesignDecisionState, type DesignDecisionsResponse } from "../../core/src/design-decision.js";
import type { DesignArtifactRef, DesignQuestionSource } from "../../core/src/design-partner.js";
import { type GoverningDesignRead } from "./design-governing.js";
import type { DesignRequestReadPort } from "./design-request-reader.js";
/** Exact source and target filters select canonical history without scanning arbitrary properties or JSON. */
export interface DesignComparisonFilter {
    requestId?: string;
    targetItemId?: string;
    threadId?: string;
    commentId?: string;
    decisionKey?: string;
}
/** Both entrances supply authenticated canvas and policy-bearing source reads through their existing transport. */
export interface DesignDecisionReadPort extends DesignRequestReadPort {
    decisions(canvasId: string, signal?: AbortSignal): Promise<DesignDecisionsResponse>;
}
/** The current actor sends one public intent; the writer alone adds canonical effects and retained evidence. */
export interface DesignDecisionWritePort extends DesignDecisionReadPort {
    sendDecision(canvasId: string, operation: DesignDecisionOperation, options: {
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
/** Read-time approval captures every option and the selected target; a final click must retain this basis. */
export interface DesignComparisonView extends DesignComparisonState {
    governing: GoverningDesignRead;
    allowedActions: ReturnType<typeof designComparisonActions>;
    approvalBases: Array<{
        alternativeId: string;
        basis: DesignApprovalBasis | null;
        reason?: string;
    }>;
}
/** Accepted choice remains history even when later output or governing changes make its consistency stale. */
export interface DesignDecisionView extends DesignDecisionState {
    governing: GoverningDesignRead;
}
/** Comparison and adoption history share one projection across native text, JSON and the lazy browser surface. */
export interface DesignComparisonReadResult {
    comparisons: DesignComparisonView[];
    decisions: DesignDecisionView[];
    unavailable: DesignDecisionsResponse["unavailable"];
}
/** Public publication owns stable source and operation IDs before delivery. */
export interface DesignCompareRequest {
    canvasId: string;
    threadId: string;
    commentId: string;
    opId: string;
    comparison: DesignComparison;
    signal?: AbortSignal;
    retry?: boolean;
}
/** Non-adopting outcomes preserve exact source association and distinguish native reports from canvas-human acts. */
export interface DesignRespondRequest {
    canvasId: string;
    threadId: string;
    commentId: string;
    opId: string;
    response: DesignComparisonResponse;
    signal?: AbortSignal;
    retry?: boolean;
}
/** A decision carries the basis already reviewed by its author; retry never substitutes fresh metadata. */
export interface DesignDecideRequest {
    canvasId: string;
    threadId: string;
    commentId: string;
    opId: string;
    decision: DesignDecisionInput;
    signal?: AbortSignal;
    retry?: boolean;
}
/** Delivery identity is independent of a later unavailable or stale consistency read. */
export interface DesignDecisionSubmission {
    status: "accepted" | "pending" | "refused";
    canvasId: string;
    threadId: string;
    commentId: string;
    payloadId: string;
    submittedOpId: string;
    opId: string | null;
    confirmedBy?: "receipt" | "snapshot";
    seq?: number;
    reason?: string;
    consistency?: {
        status: "current" | "stale" | "unavailable";
        reasons: string[];
    };
}
/** Resolve exact comparison versions and captured approval metadata through the same governing policy as other design reads. */
export declare function readDesignComparisons(io: DesignDecisionReadPort, options: {
    canvasId: string;
    filter?: DesignComparisonFilter;
    signal?: AbortSignal;
}): Promise<DesignComparisonReadResult>;
/** Validate the author's already captured basis before journaling; this deliberately performs no fresh target read. */
export declare function prepareDesignDecision(request: DesignDecideRequest): DesignDecideRequest;
/** Publish a validated immutable comparison; a source revision is an explicit new intent. */
export declare function publishDesignComparison(io: DesignDecisionWritePort, request: DesignCompareRequest): Promise<DesignDecisionSubmission>;
/** Non-adopting instructions have their own typed operation and never manufacture a questionnaire answer. */
export declare function respondDesignComparison(io: DesignDecisionWritePort, request: DesignRespondRequest): Promise<DesignDecisionSubmission>;
/** The writer validates and commits the captured target edit and decision together; retries keep the original basis. */
export declare function submitDesignDecision(io: DesignDecisionWritePort, request: DesignDecideRequest): Promise<DesignDecisionSubmission>;
/** Exact preview bytes keep their original source/version and can outlive an alternative's visible version stack. */
export interface DesignComparisonReference {
    artifact: DesignArtifactRef;
    version: ItemVersion;
    title: string;
    face: "source" | "visual";
    bytes: Uint8Array;
}
/** Open a named option under an exact source, never an unscoped option ID or a latest-version fallback. */
export declare function readDesignComparisonReference(io: DesignDecisionReadPort, request: {
    canvasId: string;
    source: DesignQuestionSource;
    optionId: string;
    face?: "source" | "visual";
    signal?: AbortSignal;
}): Promise<DesignComparisonReference>;
