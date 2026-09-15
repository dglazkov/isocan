import { type Actor, type ItemVersion, type LogEntry, type PresenceSession, type RcAnsweringResponse } from "../../core/src/index.js";
import { type DesignArtifactRef } from "../../core/src/design-partner.js";
import type { DesignRepairsResponse } from "../../core/src/design-repair.js";
import { type DesignRequestReadPort } from "./design-request-reader.js";
import { type CanvasDesignAudit, type SourceDesignAudit } from "./design-audit-reader.js";
import { type DesignReviewRun, type DesignVerifierOffer } from "./design-review-contract.js";
/** History includes both live and archived canonical entries; missing history never means zero used attempts. */
export interface DesignReviewReadPort extends DesignRequestReadPort {
    history(canvasId: string, signal?: AbortSignal): Promise<LogEntry[]>;
    repairs(canvasId: string, signal?: AbortSignal): Promise<DesignRepairsResponse>;
    sessions(canvasId: string, signal?: AbortSignal): Promise<PresenceSession[]>;
    answering(canvasId: string, signal?: AbortSignal): Promise<RcAnsweringResponse>;
}
/** Source, actual task inspection and craft keep independent coverage and failure states. */
export interface DesignReviewReadings {
    source: "passed" | "failed" | "unsupported" | "unavailable";
    task: "passed" | "failed" | "unavailable";
    craft: "passed" | "failed" | "unavailable";
    missingObligationIds: string[];
    sourceAudit: CanvasDesignAudit | SourceDesignAudit | null;
    limits: string[];
}
/** Shared progression and attribution power the CLI and lazy task panel without a second workflow engine. */
export interface DesignReviewView {
    ref: DesignArtifactRef;
    run: DesignReviewRun;
    author: Actor;
    status: "current" | "stale" | "unavailable";
    reasons: string[];
    remainingRepairs: number | null;
    ready: boolean;
    readings: DesignReviewReadings;
    nextAction: "record" | "repair" | "finish" | "review-inputs";
    allowedActions: {
        record: boolean;
        beginRepair: boolean;
        finish: boolean;
        handoff: boolean;
    };
    passes: Array<{
        id: string;
        reservedBy: Actor | null;
        recordedBy: Actor | null;
        repairs: DesignRepairsResponse["repairs"];
    }>;
    versions: Array<{
        ref: DesignArtifactRef;
        author: Actor;
        seq: number;
    }>;
    handoffs: Array<{
        opId: string;
        threadId: string;
        commentId: string;
        author: Actor;
        verifierActorId: string;
        status: "requested";
        standing: "active" | "removed";
    }>;
}
/** Eligibility combines this exact expiring report with actual liveness and existing wake policy. */
export interface DesignVerifierView {
    ref: DesignArtifactRef;
    offer: DesignVerifierOffer;
    author: Actor;
    eligible: boolean;
    reasons: string[];
}
/** Malformed or lost run history stays visible; it cannot silently restart a review budget. */
export interface DesignReviewReadResult {
    runs: DesignReviewView[];
    offers: DesignVerifierView[];
    unavailable: Array<{
        itemId: string;
        reason: string;
    }>;
}
/** Stable semantic comparison is independent of key order and has no locale-dependent serialization. */
export declare function designReviewSemantic(value: unknown): string;
/** Assess declared obligations only; a clean audit cannot substitute for actual task or craft evidence. */
export declare function designReviewReadings(run: DesignReviewRun): DesignReviewReadings;
/** Resolve a named exact artifact through its source authority; newer bytes never satisfy historical evidence. */
export declare function readDesignReviewReference(io: DesignReviewReadPort, options: {
    canvasId: string;
    artifact: DesignArtifactRef;
    signal?: AbortSignal;
}): Promise<{
    artifact: DesignArtifactRef;
    version: ItemVersion;
    bytes: Uint8Array;
    local: boolean;
}>;
/** Read ordinary authored artifacts and recover reservations from canonical group-normalized and archived history. */
export declare function readDesignReviews(io: DesignReviewReadPort, options: {
    canvasId: string;
    requestId?: string;
    runId?: string;
    signal?: AbortSignal;
    now?: number;
}): Promise<DesignReviewReadResult>;
