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
import { type DesignDecisionOperation, type DesignDecisionsResponse } from "../../core/src/design-decision.js";
import type { Store } from "./store.js";
/** The three public specialized acts all require writer-owned materialization. */
export declare const isDesignDecisionOperation: (op: Operation) => op is DesignDecisionOperation;
/** Public input cannot mint canonical comments, operation receipts or paired restoration. */
export declare function rejectPublicDesignDecision(op: Operation): void;
/** Only an existing canonical receipt can establish this definitive changed-intent refusal. */
export declare function designDecisionRetry(entries: readonly LogEntry[], op: DesignDecisionOperation, opId: string | undefined, actorId: string, registry: ActorRegistry): Promise<LogEntry | null>;
/** Resolves a closed comparison/response or the exact target/comment adoption pair within Engine's writer queue. */
export declare function materializeDesignDecision(store: Store, state: CanvasState, home: string, op: DesignDecisionOperation, actor: Actor, registry: ActorRegistry, opId: string, ts: string, history?: readonly LogEntry[]): Promise<DesignDecisionOperation>;
/** Read history remains attributed after Undo/removal; artifact freshness never rewrites the original acceptance. */
export declare function readDesignDecisions(store: Store, state: CanvasState, home: string, registry: ActorRegistry, history: readonly LogEntry[]): Promise<DesignDecisionsResponse>;
