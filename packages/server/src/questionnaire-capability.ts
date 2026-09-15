import { QUESTIONNAIRES_REQUIRED, supportsQuestionnaires, type CanvasContents, type Comment, type LogEntry, type Operation } from "@isocan/core";
import { requireDesignRequestClient } from "./design-request-capability.ts";

/** A decoder upgrade refusal is separate from canvas access and must not trigger a credential retry. */
export class QuestionnaireClientError extends Error {
  readonly code = QUESTIONNAIRES_REQUIRED;
  constructor() { super("This canvas uses typed questionnaires. Update isocan and reload the app before opening it."); this.name = "QuestionnaireClientError"; }
}
const typed = (comment: Comment) => !!comment.design || !!comment.designReferences || !!comment.designLegacySource;
/** Inspect records and inverses so undo/redo cannot introduce unknown metadata into an old reducer. */
export function questionnaireOperation(op: Operation): boolean {
  return op.type === "questionnaire.ask" || op.type === "questionnaire.answer" || op.type === "comment.restore" && typed(op.comment) || op.type === "thread.restore" && op.thread.comments.some(typed);
}
/** Check snapshots and log tails before delivering either form of typed state. */
export function requireQuestionnaireClient(features: unknown, canvas?: CanvasContents, entries: readonly LogEntry[] = []): void {
  requireDesignRequestClient(features, canvas, entries);
  if (!supportsQuestionnaires(features) && (canvas && Object.values(canvas.threads).some((t) => t.comments.some(typed)) || entries.some((entry) => questionnaireOperation(entry.envelope.op) || entry.inverse && questionnaireOperation(entry.inverse)))) throw new QuestionnaireClientError();
}
