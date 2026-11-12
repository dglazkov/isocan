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
import { type LogEntry } from "../../core/src/index.js";
/** An old decoder must upgrade before observing the new repair operation or its canonical history. */
export declare class DesignRepairClientError extends Error {
    readonly code = "design-repairs-required";
    constructor();
}
/** Gate actual exposed repair semantics; ordinary restored HTML is still an ordinary snapshot. */
export declare function requireDesignRepairClient(features: unknown, entries: readonly LogEntry[]): void;
