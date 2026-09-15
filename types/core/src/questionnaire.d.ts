import type { Actor, CanvasContents, Comment, ItemVersion } from "./model.js";
import type { Operation } from "./ops.js";
import { type DesignArtifactRef, type DesignQuestionSet, type DesignQuestionSource, type DesignResolution, type DesignResponse } from "./design-partner.js";
import { type ActorJoins } from "./identity.js";
/** Exact legacy text selected for explicit adoption; another reply cannot infer its respondent. */
export interface LegacyQuestionSource {
    threadId: string;
    commentId: string;
    body: string;
}
/** Writer-retained version metadata keeps both source and visual bytes reachable after source pruning. */
export interface QuestionnaireRetainedReference {
    artifact: DesignArtifactRef;
    version: ItemVersion;
}
/** Public intent and canonical writer output share a refusing operation type; callers cannot provide retained fields. */
export type QuestionnaireOperation = Extract<Operation, {
    type: "questionnaire.ask" | "questionnaire.answer";
}>;
/** Answer history keeps immutable typed outcomes beside the operation's actual authored comment. */
interface QuestionnaireResponseRecord {
    response: DesignResponse;
    commentId: string;
    author: Actor;
}
/** One projection used by CLI, dock and standing; source freshness never erases accepted history. */
export interface QuestionnaireState {
    source: DesignQuestionSource;
    questions: DesignQuestionSet;
    author: Actor;
    responses: QuestionnaireResponseRecord[];
    resolutions: DesignResolution[];
    outstandingQuestionIds: string[];
    references: QuestionnaireRetainedReference[];
    status: "open" | "answered" | "superseded" | "stale";
    legacySource?: LegacyQuestionSource;
}
/** Public eligibility exposes resolved kind and identity, without private claim or credential records. */
export interface QuestionnaireActor {
    id: string;
    name: string;
    kind: "human" | "agent" | "unknown";
}
/** Both clients reach the writer's eligibility read through the ordinary canvas permission boundary. */
export declare const questionnaireActorsRoute: (canvasId: string) => string;
/** Exact authored question text remains a valid response source even when its brief version later changes. */
export declare function questionnaireSourceCurrent(canvas: CanvasContents, question: Pick<QuestionnaireState, "source" | "questions" | "legacySource">): boolean;
/** Only typed, writer-stamped responses resolve questions. Retained history survives stale inputs. */
export declare function questionnaireStates(canvas: CanvasContents, filter?: {
    threadId?: string;
    requestId?: string;
    respondentActorId?: string;
    joined?: ActorJoins;
}): QuestionnaireState[];
/** Human-readable projection; structured outcome readers never parse this generated prose. */
export declare function questionnaireQuestionMarkdown(questions: DesignQuestionSet, adopted?: boolean): string;
/** Exact identities requiring writer reads and retention, excluding URLs merely supplied as text. */
export declare function questionnaireArtifacts(design: DesignQuestionSet | DesignResponse): DesignArtifactRef[];
/** Ordinary comment acts cannot mint typed authority; internal restores retain already canonical records. */
export declare function rejectQuestionnaireMetadata(op: Operation): void;
/** Validates canonical replay metadata without looking at now-pruned live items. */
export declare function validateQuestionnaireComment(comment: Comment, canvasId: string): void;
/** Old visual cards may contain swatches; adoption never claims these are actual artifact previews. */
interface LegacyQuestionOption {
    id: string;
    title: string;
    body?: string;
    eyebrow?: string;
    colors?: string[];
    description?: string;
}
/** Compatible legacy rendering shape, validated before the dock sees optional fields. */
interface LegacyQuestionSpec {
    id: string;
    title: string;
    description?: string;
    renderer: "choice-list" | "visual-cards" | "upload" | "url-collection" | "freeform";
    label?: string;
    multiSelect?: boolean;
    skippable?: boolean;
    placeholder?: string;
    options?: LegacyQuestionOption[];
}
/** Legacy data remains readable without acquiring author/response authority from surrounding prose. */
export interface LegacyQuestionnaire {
    headline?: string;
    inferredAnswers?: Array<{
        questionId: string;
        displayValue: string;
    }>;
    questions: LegacyQuestionSpec[];
}
/** Legacy parsing is a conservative read-only adapter. Malformed text stays text. */
export declare function parseLegacyQuestionnaire(body: string): LegacyQuestionnaire | null;
export { legacyQuestionSet } from "./questionnaire-adoption.js";
