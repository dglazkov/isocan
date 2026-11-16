/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { requireDesignRepairClient } from "./design-repair-capability.ts";
import { QUESTIONNAIRES_REQUIRED, supportsQuestionnaires, type CanvasContents, type Comment, type LogEntry, type Operation } from "@isocan/core";
import { requireDesignRequestClient } from "./design-request-capability.ts";
import { requireDesignDecisionClient } from "./design-decision-capability.ts";

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
  requireDesignRepairClient(features, entries);
  requireDesignDecisionClient(features, canvas, entries);
  requireDesignRequestClient(features, canvas, entries);
  if (!supportsQuestionnaires(features) && (canvas && Object.values(canvas.threads).some((t) => t.comments.some(typed)) || entries.some((entry) => questionnaireOperation(entry.envelope.op) || entry.inverse && questionnaireOperation(entry.inverse)))) throw new QuestionnaireClientError();
}
