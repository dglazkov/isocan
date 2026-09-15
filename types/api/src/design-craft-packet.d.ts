import type { Actor } from "../../core/src/index.js";
import { type DesignArtifactRef, type DesignBrief, type DesignQuestionSet, type DesignResponse } from "../../core/src/design-partner.js";
import { type DesignComparison, type DesignDecisionInput } from "../../core/src/design-decision.js";
import { type DesignProjection } from "./design-system-reader.js";
import { designCraftRevision, designCraftSources } from "./design-craft-guidance.js";
import { parseDesignReviewOutput } from "./design-review-contract.js";
/** Guidance is selected explicitly; ordinary design work never opts in automatically. */
export type DesignCraftStage = "new-work" | "critique" | "finish";
type Status = "current" | "stale" | "unavailable";
type CraftFile = {
    path: string;
    mimeType: string;
    size: number;
    sha256: string;
    data: string;
};
/** A bounded, attributed context projection whose original files remain independent of local edits. */
export interface DesignCraftPacket {
    schemaVersion: 1;
    kind: "craft-packet";
    mode: "adapted-guidance";
    revision: typeof designCraftRevision;
    packetId: string;
    stage: DesignCraftStage;
    status: Status;
    reasons: string[];
    upstream: {
        repository: "https://github.com/pbakaus/impeccable";
        commit: "2149fcce39a90bb409df5f16515f316a76dc6199";
        skillVersion: "4.3.1";
        resources: ReturnType<typeof designCraftSources>;
    };
    request: {
        ref: DesignArtifactRef;
        brief: DesignBrief;
        author: Actor;
    };
    questions: Array<{
        questions: DesignQuestionSet;
        author: Actor;
        status: "open" | "answered" | "superseded" | "stale";
        outstandingQuestionIds: string[];
        responses: Array<{
            response: DesignResponse;
            author: Actor;
        }>;
    }>;
    decisions: Array<{
        input: DesignDecisionInput;
        comparison: DesignComparison;
        adopted: DesignArtifactRef;
        author: Actor;
        recommendationAuthor: Actor;
        recommendation: string;
        status: Status;
    }>;
    governing: {
        status: "available";
        projection: DesignProjection;
        author: Actor;
    } | {
        status: "none" | "unavailable";
        reason: string;
    };
    references: Array<{
        artifact: DesignArtifactRef;
        roles: string[];
        title: string;
        filename: string;
        mimeType: string;
        path: string | null;
        reason: string | null;
    }>;
    runtimeReports: Array<{
        receipt: DesignArtifactRef;
        output: Extract<ReturnType<typeof parseDesignReviewOutput>, {
            kind: "repository";
        }>;
        author: Actor;
        status: Status;
    }>;
    files: CraftFile[];
    limits: string[];
}
/** Deterministic serialization binds every field, independent of object insertion order. */
export declare function craftSemantic(value: unknown): string;
/** Exact byte hashes identify packet files and never imply their source was authorized. */
export declare function craftHash(value: string | Uint8Array): Promise<string>;
/** Base64 keeps arbitrary permitted reference bytes serializable in either runtime. */
export declare function craftBytes(file: Pick<CraftFile, "data">): Uint8Array;
/** A generated safe filename and exact bytes form one immutable baseline file. */
export declare function craftFile(path: string, content: string | Uint8Array, mimeType: string): Promise<CraftFile>;
/** Context prose is generated from canonical facts; local edits stay proposed notes. */
export declare function craftContextFiles(packet: Omit<DesignCraftPacket, "files" | "packetId">): Record<string, string>;
/** Validate the complete saved shape, provenance payloads, source pin and baseline bytes before reuse. */
export declare function parseDesignCraftPacket(value: unknown): Promise<DesignCraftPacket>;
export {};
