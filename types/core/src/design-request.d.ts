import type { Actor } from "./model.js";
import type { ContextRequest } from "./canvas-group-context.js";
import type { Placement, Operation } from "./ops.js";
import type { DesignArtifactRef, DesignBrief, DesignQuestionSource, DesignReceipt } from "./design-partner.js";
import type { QuestionnaireState } from "./questionnaire.js";
import type { DesignRecordMarker } from "./design-record.js";
export { parseDesignRequestAction, parseDesignRequestOperation, designIntentHash } from "./design-request-parse.js";
/** Editable design facts; lifecycle identity, source capture and authorship remain writer-owned. */
export type DesignBriefFields = Pick<DesignBrief, "intent" | "fidelity" | "delivery" | "targetItemId" | "groupId" | "audience" | "primaryTask" | "constraints" | "facts" | "references" | "outstandingDecisionIds" | "outputIds">;
/** Exact accepted response provenance, retained when a settled batch is reconciled into a later brief. */
export interface DesignAcceptedResponse {
    question: DesignQuestionSource;
    responseId: string;
}
/** Field provenance distinguishes actual edits and canvas answers from an agent's native-harness report. */
interface DesignFactProvenance {
    field: string;
    actorId: string;
    kind: "direct" | "reported" | "questionnaire";
    responseId?: string;
}
/** Canonical request history captures source content and scope without changing the original requester. */
export interface DesignContinuation {
    sourceCapture: {
        bodyHash: string;
        boundaryCommentId: string;
    } | null;
    scopeCapture: {
        kind: "source-comment" | "current-selection" | "current-ambient";
        revision: number;
    };
    acceptedResponses: DesignAcceptedResponse[];
    factProvenance: DesignFactProvenance[];
    resumedBy?: {
        actorId: string;
        reason: string;
    };
}
/** Governing selection and the independent canvas exemption coexist; either changing can invalidate policy evidence. */
export interface DesignGoverningBinding {
    atItemId: string | null;
    artifact: DesignArtifactRef | null;
    explicitNone: boolean;
}
/** Published questions declare why they consume discovery effort and which durable facts they settle. */
export interface DesignDiscovery {
    purpose: "initial" | "consequential" | "interview";
    reason?: string;
    source?: DesignBrief["source"];
    factBindings: Array<{
        questionId: string;
        factId: string;
    }>;
}
interface RecordPlacement {
    placement?: Placement;
    width?: number;
    height?: number;
    title?: string;
}
interface RequestBasis {
    brief: DesignArtifactRef;
    epoch: number;
    versionId: string;
}
interface RequestChanges {
    patch?: Partial<DesignBriefFields>;
    acceptedResponses?: DesignAcceptedResponse[];
}
/** Public lifecycle intents remain one conditional item effect; only explicit resume advances the epoch. */
export type DesignRequestAction = ({
    kind: "start";
    requestId: string;
    itemId: string;
    versionId: string;
    source: DesignBrief["source"];
    fields: DesignBriefFields;
    admission: "explicit" | "automatic";
    contextRequest?: ContextRequest;
} & RecordPlacement) | ({
    kind: "update" | "complete";
} & RequestBasis & RequestChanges) | ({
    kind: "resume";
    reason: string;
    contextRequest?: ContextRequest;
} & RequestBasis & RequestChanges) | ({
    kind: "cancel";
    reason?: string;
} & RequestBasis);
/** A receipt's publication carries attributed check data; the daemon does not attest browser execution. */
export interface DesignReceiptPublication extends RecordPlacement {
    itemId: string;
    versionId: string;
    receipt: DesignReceipt;
}
/** Narrow aliases derive from the directly enumerable canonical operation vocabulary. */
export type DesignRecordOperation = Extract<Operation, {
    type: "design.request" | "design.receipt";
}>;
/** Saved evidence remains readable when changed inputs make it stale or unavailable. */
export interface DesignReceiptState {
    ref: DesignArtifactRef;
    receipt: DesignReceipt;
    author: Actor;
    marker: DesignRecordMarker;
    status: "current" | "stale" | "unavailable";
    reasons: string[];
    checkFreshness: Array<{
        checkId: string;
        status: "current" | "stale" | "unavailable";
        reasons: string[];
    }>;
}
/** Shared writer reading supplies budget, history and eligibility; clients add permitted remote freshness. */
export interface DesignRequestState {
    ref: DesignArtifactRef;
    brief: DesignBrief;
    author: Actor;
    marker: DesignRecordMarker;
    status: "current" | "stale" | "cancelled";
    reasons: string[];
    remainingInitialQuestions: number;
    questions: QuestionnaireState[];
    receipts: DesignReceiptState[];
    allowedActions: Array<"update" | "resume" | "cancel" | "complete" | "receipt">;
}
/** Unreadable admitted JSON is explicit and never silently replaced by a guessed brief. */
export interface DesignRequestsResponse {
    requests: DesignRequestState[];
    unavailable: Array<{
        itemId: string;
        reason: string;
    }>;
}
/** Both clients read canonical admission through the existing canvas permission boundary. */
export declare const designRequestsRoute: (canvasId: string) => string;
