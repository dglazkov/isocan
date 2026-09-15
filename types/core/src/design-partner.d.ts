import { type ContextManifest } from "./canvas-group-context.js";
/** Decision metadata travels with the adopted target's conditional content edit and inverse. */
export declare const DESIGN_PARTNER_DECISION_PROPERTY = "designPartner.decision";
/** Unsupported values remain visible and cannot accidentally enable automatic enrollment. */
type DesignPartnerPolicy = "off" | "adaptive-v1" | "unsupported";
/** Writer-resolved classification; a missing agent-map entry does not establish a human. */
export type DesignActorKind = "human" | "agent" | "unknown";
/** Presentation intent, independent of request progress and verification status. */
type DesignFidelity = "wireframe" | "designed" | "implementation";
/** A hash alone cannot identify which permitted source supplied an artifact. */
export interface DesignArtifactRef {
    home: string;
    canvasId: string;
    itemId: string;
    versionId: string;
    blobHash: string;
}
interface DesignRecordBase {
    schemaVersion: 1;
    requestId: string;
    epoch: number;
}
/** Supplied locations and inspected bytes are distinct states; unavailable sources retain a reason. */
interface DesignReference {
    id: string;
    state: "supplied" | "fetched" | "inaccessible" | "superseded";
    url?: string;
    artifact?: DesignArtifactRef;
    reason?: string;
}
/** Versioned request facts owned by the canvas; projections must preserve provenance and assumptions. */
export interface DesignBrief extends DesignRecordBase {
    kind: "brief";
    requestingActorId: string;
    source: {
        entrance: "canvas-chat";
        threadId: string;
        commentId: string;
    } | {
        entrance: "external-agent";
        externalRequestId: string;
    };
    progress: "active" | "cancelled" | "completed";
    intent: "create" | "extend" | "refine";
    fidelity: DesignFidelity;
    delivery: "html-node" | "connected-app" | "wireframe" | "exploration";
    targetItemId: string | null;
    groupId: string | null;
    audience: string | null;
    primaryTask: string | null;
    constraints: string[];
    facts: Array<{
        id: string;
        name: string;
        value: string;
        origin: "supplied" | "context" | "assumed";
        sources: DesignArtifactRef[];
    }>;
    context: ContextManifest;
    references: DesignReference[];
    outstandingDecisionIds: string[];
    outputIds: string[];
}
/** An identified answer choice explains its consequence and may point to an actual preview version. */
interface DesignQuestionOption {
    id: string;
    title: string;
    consequence: string;
    preview?: DesignArtifactRef;
}
/** Renderer-specific input semantics; permission to skip or delegate is explicit for each question. */
interface DesignQuestion {
    id: string;
    title: string;
    consequence: string;
    renderer: "choice-list" | "visual-cards" | "freeform" | "url-collection" | "upload";
    options: DesignQuestionOption[];
    multiple: boolean;
    skippable: boolean;
    delegatable: boolean;
    recommendedOptionId?: string;
}
/** Reissue changes with a new payload id; never edit published typed questions. */
export interface DesignQuestionSet extends DesignRecordBase {
    kind: "questions";
    id: string;
    revision: number;
    brief: DesignArtifactRef;
    respondentActorId: string;
    headline: string;
    inferredAnswers: Array<{
        questionId: string;
        value: string;
        sources: DesignArtifactRef[];
    }>;
    questions: DesignQuestion[];
    supersedes: DesignQuestionSource | null;
}
/** Exact immutable published source; a title or latest thread message cannot substitute for identity. */
export interface DesignQuestionSource {
    threadId: string;
    commentId: string;
    payloadId: string;
    revision: number;
}
/** One explicit outcome; skipped, dismissed and delegated states never imply a supplied answer. */
type DesignResolution = {
    questionId: string;
    state: "answered";
    value: {
        kind: "options";
        optionIds: string[];
    } | {
        kind: "text";
        text: string;
    } | {
        kind: "references";
        references: DesignReference[];
    };
} | {
    questionId: string;
    state: "skipped" | "dismissed";
} | {
    questionId: string;
    state: "delegated";
    agentActorId: string;
};
/** Published respondent outcomes linked to their exact source; changes explicitly supersede a prior response. */
export interface DesignResponse extends DesignRecordBase {
    kind: "response";
    id: string;
    question: DesignQuestionSource;
    respondentActorId: string;
    resolutions: DesignResolution[];
    supersedesResponseId: string | null;
}
/** Attributed direction choice and version adoption, retaining the comparison and its reasoning. */
export interface DesignDecision extends DesignRecordBase {
    kind: "decision";
    id: string;
    brief: DesignArtifactRef;
    questionId: string;
    uncertainty: "structure" | "visual";
    alternatives: Array<{
        id: string;
        hypothesis: string;
        fidelity: DesignFidelity;
        artifact: DesignArtifactRef;
    }>;
    recommendedAlternativeId: string;
    chosenAlternativeId: string;
    recommendation: string;
    tradeoff: string;
    reason: string;
    decidingActorId: string;
    attribution: "human-choice" | "delegated-agent";
    delegationResponseId: string | null;
    /** The source version and target version are different identities even in greenfield work. */
    adoption: {
        targetItemId: string;
        expectedVersionId: string;
        versionId: string;
    };
    supersedesDecisionId: string | null;
}
/** Identifies the actual delivery surface; a repository result also requires its build and running address. */
type DesignOutputIdentity = {
    kind: "canvas";
    artifact: DesignArtifactRef;
} | {
    kind: "repository";
    repository: string;
    revision: string;
    buildId: string;
    runtimeUrl: string;
};
/** Scoped completion evidence, independent of craft preference; references make later staleness detectable. */
export interface DesignReceipt extends DesignRecordBase {
    kind: "receipt";
    id: string;
    brief: DesignArtifactRef;
    output: DesignOutputIdentity;
    context: DesignArtifactRef[];
    fidelity: DesignFidelity;
    status: "draft" | "ready";
    checks: Array<{
        id: string;
        kind: "source" | "browser-task" | "craft";
        tool: string;
        toolVersion: string;
        result: "passed" | "failed" | "unavailable";
        coverage: string;
        state: string;
        viewport: {
            width: number;
            height: number;
        } | null;
        evidence: DesignArtifactRef[];
    }>;
    unresolved: Array<{
        severity: "critical" | "noncritical";
        description: string;
    }>;
}
/** Closed persisted record family; unsupported kinds require a deliberate schema change. */
type DesignPartnerRecord = DesignBrief | DesignQuestionSet | DesignResponse | DesignDecision | DesignReceipt;
export declare class DesignPartnerContractError extends Error {
    readonly code: "invalid" | "association" | "actor" | "stale" | "conflict";
    constructor(code: "invalid" | "association" | "actor" | "stale" | "conflict", message: string);
}
/** Refuses filename-only uploads and fetched URLs without version identities; availability stays explicit. */
export declare function parseDesignReference(value: unknown): DesignReference;
/** Validates immutable questions, unique choices and real visual-preview identities before publication. */
export declare function parseDesignQuestionSet(value: unknown): DesignQuestionSet;
/** Validates outcome shape; source freshness, respondent custody and allowed choices need association checks. */
export declare function parseDesignResponse(value: unknown): DesignResponse;
/** Reuses the retained-context validator and preserves known facts separately from stated assumptions. */
export declare function parseDesignBrief(value: unknown): DesignBrief;
/** Checks comparable alternatives and attribution consistency, without authorizing adoption into a target. */
export declare function parseDesignDecision(value: unknown): DesignDecision;
/** Checks readiness and evidence shape; actual inspection requires separate proof beyond record validation. */
export declare function parseDesignReceipt(value: unknown): DesignReceipt;
/** Dispatches the persisted schema explicitly; unknown kinds and future semantics are refused. */
export declare function parseDesignPartnerRecord(value: unknown): DesignPartnerRecord;
/** Unknown policy never silently enables automatic enrollment. */
export declare function designPartnerPolicy(properties: Readonly<Record<string, string>>): DesignPartnerPolicy;
export {};
