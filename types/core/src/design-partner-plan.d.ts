import { type CanvasContents } from "./model.js";
import type { Operation } from "./ops.js";
import { type DesignActorKind, type DesignArtifactRef, type DesignBrief, type DesignQuestionSet, type DesignQuestionSource, type DesignResponse } from "./design-partner.js";
/** Ports supply these after existing custody/grant/join resolution. They are not credentials. */
interface DesignWriterActor {
    actorId: string;
    kind: DesignActorKind;
}
/** The current brief bytes and their source identity, read together by the calling writer. */
interface ActiveDesignRequest {
    brief: DesignBrief;
    ref: DesignArtifactRef;
}
/** Published question provenance plus current request state; retained bytes alone do not make a question current. */
export interface DesignQuestionContext {
    request: ActiveDesignRequest;
    questions: DesignQuestionSet;
    source: DesignQuestionSource;
    /** The current source was removed or superseded, even if a reader retained its bytes. */
    sourceStatus: "current" | "removed" | "superseded";
}
/** Full authority and version equality; identical blob bytes on another canvas are a different source. */
export declare function sameDesignArtifact(a: DesignArtifactRef, b: DesignArtifactRef): boolean;
/** Shape plus explicit association. Calling this does not prove server authorization. */
export declare function validateDesignResponseAssociation(input: unknown, context: DesignQuestionContext, actor: DesignWriterActor): DesignResponse;
/** Describes the single reply effect and required guards; it is deliberately not a sendable wire act. */
interface DesignAnswerMaterializationPlan {
    kind: "answer-materialization";
    /** NOT a sendable operation: old daemons drop typed metadata. Phase 1 owns its refusing wire act. */
    reply: Extract<Operation, {
        type: "thread.reply";
    }>;
    design: DesignResponse;
    opId: string;
    guard: {
        requestId: string;
        epoch: number;
        brief: DesignArtifactRef;
        question: DesignQuestionSource;
    };
}
/** An accepted identical retry is an observation and must not create another comment or undo step. */
type DesignAnswerPlan = DesignAnswerMaterializationPlan | {
    kind: "already-recorded";
    responseId: string;
};
/** This projection is for people. Readers use typed data, never parse these sentences. */
export declare function designResponseMarkdown(response: DesignResponse, questions: DesignQuestionSet): string;
/** Associates outcomes and supersession with one source; the future serialized writer must enforce its guards. */
export declare function planDesignAnswer(input: {
    response: unknown;
    context: DesignQuestionContext;
    actor: DesignWriterActor;
    commentId: string;
    opId: string;
    previousResponses?: readonly DesignResponse[];
}): DesignAnswerPlan;
/** One existing conditional edit preserves target content and decision metadata under the same undo. */
interface DesignDecisionPlan {
    kind: "decision-edit";
    operation: Extract<Operation, {
        type: "item.edit";
    }>;
    opId: string;
    /** Existing item.edit only enforces target conditions. The future writer also enforces these. */
    guard: {
        requestId: string;
        epoch: number;
        brief: DesignArtifactRef;
        alternatives: DesignArtifactRef[];
    };
}
/** Plans faithful adoption only into the brief's target or greenfield winner; it does not enforce concurrency. */
export declare function planDesignDecision(input: {
    decision: unknown;
    request: ActiveDesignRequest;
    actor: DesignWriterActor;
    canvas: CanvasContents;
    home: string;
    opId: string;
    /** A writer-validated, currently effective delegation, not a quoted human sentence. */
    delegation?: DesignResponse;
}): DesignDecisionPlan;
export {};
