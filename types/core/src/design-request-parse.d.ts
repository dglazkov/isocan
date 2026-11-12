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
export { parseDesignContinuation, parseDesignDiscovery, parseDesignGoverning } from "./design-partner-values.js";
import type { DesignRequestAction, DesignRecordOperation } from "./design-request.js";
/** Rejects unsupported lifecycle fields before any writer mutation or retry lookup. */
export declare function parseDesignRequestAction(value: unknown): DesignRequestAction;
/** Parses either public design act; canonical effects are refused at the public boundary. */
export declare function parseDesignRequestOperation(value: unknown): DesignRecordOperation;
/** Snapshot recovery hashes validated intent with its immutable authenticated author, after join-aware matching. */
export declare function designIntentHash(operation: DesignRecordOperation, authoredActorId: string): Promise<string>;
