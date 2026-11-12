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
import { type Actor, type ActorRegistry, type CanvasState, type DesignActorKind, type LogEntry, type Operation, type QuestionnaireActor, type QuestionnaireOperation } from "../../core/src/index.js";
import type { Store } from "./store.js";
/** Joins preserve identity while known harness records establish eligibility; absence remains unknown. */
export declare function questionnaireActorKind(registry: ActorRegistry, id: string): DesignActorKind;
/** Exposes canvas authors and current faces through registry-backed eligibility, never private session or credential data. */
export declare function questionnaireActors(state: CanvasState, registry: ActorRegistry, liveActors?: readonly Actor[]): QuestionnaireActor[];
/** Narrows the refusing public acts before their writer-only materialization fields are added. */
export declare const isQuestionnaireOperation: (op: Operation) => op is QuestionnaireOperation;
/** Rejects invented authority or retained metadata before forwarding and idempotency lookup. */
export declare function rejectPublicQuestionnaire(op: Operation): void;
/** Called before the general op-id fast path; canonical fields alone are ignored. */
export declare function questionnaireRetry(entries: readonly LogEntry[], op: QuestionnaireOperation, opId: string | undefined, actorId: string, registry: ActorRegistry): LogEntry | null;
/** This function runs within Engine's single writer chain, after custody and ordinary canvas grants. */
export declare function resolveQuestionnaireOperation(store: Store, state: CanvasState, revision: number, op: QuestionnaireOperation, actor: Actor, registry: ActorRegistry, home: string | undefined, history?: readonly LogEntry[]): Promise<QuestionnaireOperation>;
