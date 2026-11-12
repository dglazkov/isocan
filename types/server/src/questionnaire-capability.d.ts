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
