import { type DesignArtifactRef, type DesignReceipt } from "../../core/src/design-partner.js";
import { type DesignRepairInput } from "../../core/src/design-repair.js";
import type { CanvasDesignAudit, SourceDesignAudit } from "./design-audit-reader.js";
/** Authored run and verifier artifacts use one bounded discovery property; arbitrary JSON is never scanned. */
export declare const DESIGN_REVIEW_PROPERTY = "design.review";
/** An obligation describes an actual task/state/viewport, independently of a tool's availability. */
export interface DesignReviewObligation {
    id: string;
    kind: "browser-task" | "craft";
    task: string;
    state: string;
    viewport: {
        width: number;
        height: number;
    } | null;
    required: boolean;
}
/** Observations report executed native tools and retrievable evidence; opening a plan is not an observation. */
export interface DesignReviewObservation {
    id: string;
    obligationId: string;
    tool: string;
    toolVersion: string;
    result: "passed" | "failed" | "unavailable";
    action: string;
    expected: string;
    observed: string;
    evidence: DesignArtifactRef[];
}
/** Craft and task defects retain their own rationale and criticality rather than becoming source diagnostics. */
export interface DesignReviewFinding {
    id: string;
    kind: "browser-task" | "craft";
    severity: "critical" | "noncritical";
    description: string;
    rationale: string;
}
/** The existing analyzer's exact serialized report is preserved without inventing another diagnostic schema. */
export type DesignReviewSource = {
    kind: "canvas-audit";
    reportJson: string;
} | {
    kind: "repository-audit";
    reportJson: string;
    repository: string;
    revision: string;
    path: string;
} | {
    kind: "unavailable";
    reason: string;
};
/** A reserved pass counts even when generation yields invalid or unchanged output; records never release it. */
export interface DesignReviewPass {
    id: string;
    kind: "initial" | "repair";
    reservedAt: string;
    sessionId: string;
    reservationVersionId: string;
    output: DesignReceipt["output"];
    record: {
        outcome: "reviewed" | "invalid" | "noop";
        note: string;
        source: DesignReviewSource;
        observations: DesignReviewObservation[];
        findings: DesignReviewFinding[];
    } | null;
}
/** Ordinary cumulative authored evidence, not a daemon quality assertion or a separate workflow database. */
export interface DesignReviewRun {
    schemaVersion: 1;
    kind: "review-run";
    id: string;
    request: NonNullable<DesignRepairInput["request"]>;
    preceding: {
        run: DesignArtifactRef;
        reason: string;
    } | null;
    mode: "review" | "audit-only";
    basis: {
        target: DesignRepairInput["target"] | null;
        governing: DesignRepairInput["governing"];
        context: DesignArtifactRef[];
        ruleVersion: string;
    };
    obligations: DesignReviewObligation[];
    passes: DesignReviewPass[];
    finished: {
        status: "ready" | "draft";
        limits: string[];
    } | null;
}
/** A fresh tool probe offers inspection for this exact request/run and actual session, for at most five minutes. */
export interface DesignVerifierOffer {
    schemaVersion: 1;
    kind: "verifier-offer";
    id: string;
    requestId: string;
    runId: string;
    run: DesignArtifactRef;
    output: DesignReceipt["output"];
    sessionId: string;
    observedAt: string;
    expiresAt: string;
    delivery: "canvas" | "repository";
    available: boolean;
    reason: string;
    tools: Array<{
        name: string;
        version: string;
    }>;
}
/** Reuse receipt output identity without accepting a canvas prototype as a connected runtime. */
export declare function parseDesignReviewOutput(value: unknown): DesignReceipt["output"];
/** Validate tool observations before preparing a report write; author identity comes only from its accepted version. */
export declare function parseDesignReviewObservations(value: unknown): DesignReviewObservation[];
/** Decode only the existing analyzer envelope; its detailed diagnostic payload stays byte-for-byte available. */
export declare function designReviewSourceAudit(source: DesignReviewSource): CanvasDesignAudit | SourceDesignAudit | null;
/** Strict versioned cumulative reports reject unknown fields and preserve prior reservations before progression. */
export declare function parseDesignReviewRun(value: unknown): DesignReviewRun;
/** Offer expiry and positive declared tooling are validated before publication; liveness remains a read-time fact. */
export declare function parseDesignVerifierOffer(value: unknown): DesignVerifierOffer;
