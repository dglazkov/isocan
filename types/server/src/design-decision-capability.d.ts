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
/** An unsupported paired-decision decoder must upgrade, not retry with different credentials. */
export declare class DesignDecisionClientError extends Error {
    readonly code = "design-decisions-required";
    constructor();
}
/** Actual op and inverse payloads, including archived receipts, establish required decoding support. */
export declare function designDecisionOperation(op: Operation): boolean;
/** Transparent relays use the caller's feature declaration, never their own decoder's capability. */
export declare function requireDesignDecisionClient(features: unknown, canvas?: CanvasContents, entries?: readonly LogEntry[]): void;
