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
import { type Actor, type ActorRegistry, type CanvasState, type LogEntry, type Operation } from "../../core/src/index.js";
import { type DesignArtifactRef, type DesignBrief, type DesignQuestionSet, type DesignReceipt } from "../../core/src/design-partner.js";
import { type DesignRecordOperation, type DesignRequestsResponse } from "../../core/src/design-request.js";
import { type DesignRetainedReference } from "../../core/src/design-record.js";
import type { Store } from "./store.js";
/** Identifies the two refusing wire acts without changing ordinary item or comment vocabulary. */
export declare const isDesignRecordOperation: (op: Operation) => op is DesignRecordOperation;
/** Public callers cannot inject admission through generic item, group, restore or nested version fields. */
export declare function rejectPublicDesignRecord(op: Operation): void;
/** Content edits and version switching cannot bypass lifecycle guards on admitted records. */
export declare function guardDesignRecordEdit(state: CanvasState, op: Operation): void;
/** Retry compares original validated intent and join-aware custody before current lifecycle checks. */
export declare function designRecordRetry(entries: readonly LogEntry[], op: DesignRecordOperation, opId: string | undefined, actorId: string, registry: ActorRegistry): Promise<LogEntry | null>;
/** Comparison acts use the same live request, source, cancellation and input guards as lifecycle writes. */
export declare function designDecisionRequest(store: Store, state: CanvasState, home: string, ref: DesignArtifactRef, epoch: number, registry: ActorRegistry, history?: readonly LogEntry[]): Promise<DesignBrief>;
/** Admitted requests add source and effort guards while historical manual briefs keep phase-1 semantics. */
export declare function validateAdmittedDesignQuestions(state: CanvasState, brief: DesignBrief, questions: DesignQuestionSet, entries: readonly LogEntry[], registry: ActorRegistry, publishing: boolean): void;
/** Retains exact local source and visual bytes with flat metadata; inherited references remain permission-bearing. */
export declare function retainReferences(store: Store, state: CanvasState, home: string, refs: DesignArtifactRef[], previous?: DesignRetainedReference[]): Promise<DesignRetainedReference[]>;
/** Reuses canonical scope selection for request receipts and approval guards, without fetching supplied URLs. */
export declare function governingReasons(state: CanvasState, home: string, receipt: Pick<DesignReceipt, "governing">): string[];
/** Materializes JSON and one item effect while Engine holds the existing single-writer chain. */
export declare function materializeDesignRecord(store: Store, state: CanvasState, revision: number, operation: DesignRecordOperation, actor: Actor, registry: ActorRegistry, home: string, opId: string, history?: readonly LogEntry[]): Promise<DesignRecordOperation>;
/** Reads admitted records only; malformed JSON remains an explicit unavailable row, never inferred admission. */
export declare function readDesignRequests(store: Store, state: CanvasState, home: string, registry: ActorRegistry, history: readonly LogEntry[]): Promise<DesignRequestsResponse>;
