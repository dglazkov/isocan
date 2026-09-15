import { type CanvasContents, type LogEntry, type Operation } from "../../core/src/index.js";
/** A decoder upgrade refusal is separate from canvas access and must not trigger a credential retry. */
export declare class QuestionnaireClientError extends Error {
    readonly code = "questionnaires-required";
    constructor();
}
/** Inspect records and inverses so undo/redo cannot introduce unknown metadata into an old reducer. */
export declare function questionnaireOperation(op: Operation): boolean;
/** Check snapshots and log tails before delivering either form of typed state. */
export declare function requireQuestionnaireClient(features: unknown, canvas?: CanvasContents, entries?: readonly LogEntry[]): void;
