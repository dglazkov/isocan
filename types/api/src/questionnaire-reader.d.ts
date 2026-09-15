import { type CanvasSnapshotResponse, type Operation, type PostOpResponse, type ItemVersion } from "../../core/src/index.js";
import { type DesignQuestionSet, type DesignResponse, type DesignArtifactRef } from "@isocan/core/design-partner";
import { questionnaireStates } from "@isocan/core/questionnaire";
type QuestionnaireOperation = Extract<Operation, {
    type: "questionnaire.ask" | "questionnaire.answer";
}>;
/** Readers can narrow a conversation without changing selection or marking it answered. */
export interface DesignQuestionsOptions {
    threadId?: string;
    requestId?: string;
    respondentActorId?: string;
    signal?: AbortSignal;
}
/** The public API carries the same effective answers and outstanding questions as the dock. */
export type DesignQuestionsResult = ReturnType<typeof questionnaireStates>;
/** Transport uncertainty must retain the intent instead of looking like a rejected or saved answer. */
export type QuestionnaireDelivery = {
    status: "accepted";
    receipt: PostOpResponse;
} | {
    status: "pending" | "refused";
    reason: string;
};
/** Browser and Node provide transport only; they use the same records and receipts. */
export interface QuestionnairePort {
    actorId?: string;
    snapshot(canvasId: string, signal?: AbortSignal): Promise<Pick<CanvasSnapshotResponse, "canvas" | "joined">>;
    send(canvasId: string, operation: QuestionnaireOperation, options: {
        opId: string;
        signal?: AbortSignal;
    }): Promise<QuestionnaireDelivery>;
}
/** References read through the same authority as the canvas, including retained historical blobs. */
export interface QuestionnaireReferencePort {
    snapshot(canvasId: string, signal?: AbortSignal): Promise<Pick<CanvasSnapshotResponse, "canvas">>;
    home(canvasId: string): Promise<string>;
    blobBytes(canvasId: string, hash: string, signal?: AbortSignal): Promise<Uint8Array>;
}
/** An exact answer location prevents a reference name from resolving against another conversation. */
export interface DesignReferenceRequest {
    threadId: string;
    commentId: string;
    referenceId: string;
    signal?: AbortSignal;
}
/** Verified bytes remain paired with the writer-retained version that supplied them. */
export interface DesignReferenceContent {
    referenceId: string;
    artifact: DesignArtifactRef;
    version: ItemVersion;
    bytes: Uint8Array;
}
/** Publishing binds an immutable question set to one existing thread and retry identity. */
export interface DesignAskRequest {
    canvasId: string;
    threadId: string;
    commentId: string;
    opId: string;
    questions: DesignQuestionSet;
    legacySource?: {
        threadId: string;
        commentId: string;
        body: string;
    };
    signal?: AbortSignal;
}
/** A saved answer intent keeps its original source and IDs through failed delivery and retries. */
export interface DesignAnswerRequest {
    canvasId: string;
    threadId: string;
    commentId: string;
    opId: string;
    response: DesignResponse;
    signal?: AbortSignal;
}
/** Both surfaces report matching writer evidence; an uncertain result keeps the same retry IDs. */
export interface QuestionnaireSubmission {
    status: "accepted" | "pending" | "refused";
    canvasId: string;
    threadId: string;
    commentId: string;
    payloadId: string;
    /** Actual receipt identity, unknown when a saved comment alone confirms delivery. */
    opId: string | null;
    /** The caller's original retry identity is retained even if the writer returned an older receipt. */
    submittedOpId: string;
    reason?: string;
    seq?: number;
    confirmedBy?: "receipt" | "snapshot";
}
/** Fetch once, then let the core resolver derive open and resolved questions from typed comments. */
export declare function readDesignQuestions(io: Pick<QuestionnairePort, "snapshot">, canvasId: string, options?: DesignQuestionsOptions): Promise<DesignQuestionsResult>;
/** Opens the exact immutable source attached to this answer, including after an item edit or removal. */
export declare function readDesignReference(io: QuestionnaireReferencePort, canvasId: string, request: DesignReferenceRequest): Promise<DesignReferenceContent>;
type QuestionnaireWritePort = Pick<QuestionnairePort, "send" | "actorId"> & Partial<Pick<QuestionnairePort, "snapshot">>;
/** Only explicit validation/admission failures prove non-acceptance; timeouts and server failures do not. */
export declare function questionnaireFailureStatus(error: unknown): "refused" | "pending";
/** IDs belong to the caller's draft. A timeout keeps them retryable; it is never success. */
export declare function askDesignQuestions(io: QuestionnaireWritePort, request: DesignAskRequest): Promise<QuestionnaireSubmission>;
/** Answers travel as refusing canonical operations; prose is never substituted for a typed response. */
export declare function answerDesignQuestions(io: QuestionnaireWritePort, request: DesignAnswerRequest): Promise<QuestionnaireSubmission>;
/** Stable wire identities for a saved payload ID, shared by both client surfaces. */
export declare function questionnaireSubmissionIds(kind: "ask" | "answer", payloadId: string): Promise<{
    opId: string;
    commentId: string;
}>;
export {};
