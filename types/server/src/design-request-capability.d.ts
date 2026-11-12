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
/** Decoder refusal cannot be repaired by credential retries or silently dropping admission metadata. */
export declare class DesignRequestClientError extends Error {
    readonly code = "design-requests-required";
    constructor();
}
/** Both canonical acts and ordinary inverses carrying new metadata require the new decoder. */
export declare function designRequestOperation(op: Operation): boolean;
/** Checks current state and actual receipts/inverses, including archived retries. */
export declare function requireDesignRequestClient(features: unknown, canvas?: CanvasContents, entries?: readonly LogEntry[]): void;
