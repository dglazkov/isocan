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
import { type DesignRepairOperation, type DesignRepairsResponse } from "../../core/src/design-repair.js";
import type { Store } from "./store.js";
/** Narrow dispatch keeps ordinary content edits outside automatic review and task authority. */
export declare const isDesignRepairOperation: (op: Operation) => op is DesignRepairOperation;
/** Strict public parsing refuses canonical effect and retained-authority injection before retry lookup. */
export declare function rejectPublicDesignRepair(op: Operation): void;
/** Canonical identity remains reserved after Undo and archive; only exact original intent and current actor custody can observe it. */
export declare function designRepairRetry(history: readonly LogEntry[], op: DesignRepairOperation, opId: string | undefined, actorId: string, registry: ActorRegistry): Promise<LogEntry | null>;
/** One writer-serialized repair checks local scope and request facts; foreign policy remains a permission-bearing client read. */
export declare function materializeDesignRepair(store: Store, state: CanvasState, home: string, operation: DesignRepairOperation, actor: Actor, registry: ActorRegistry, history: readonly LogEntry[]): Promise<DesignRepairOperation>;
/** Read acceptance and active causes without claiming that a repair or an authored review proved task success. */
export declare function readDesignRepairs(store: Store, state: CanvasState, home: string, registry: ActorRegistry, history: readonly LogEntry[]): Promise<DesignRepairsResponse>;
