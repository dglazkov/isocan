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
import { type Canvas, type LogEntry, type Operation } from "../../core/src/index.js";
/** A protocol refusal must stop reads and queued writes before group state
 * reaches a reducer which does not understand it. It is not an ACL failure. */
export declare class CanvasGroupsClientError extends Error {
    readonly code = "canvas-groups-required";
    constructor();
}
/** Log reads and socket broadcasts also inspect the record itself: a group
 * creation can be the first event an already-connected legacy client sees. */
export declare function groupOperation(op: Operation): boolean;
/** Snapshot mode and log contents are separate evidence. Check either before
 * serving state, including archived group operations after a mode rollback. */
export declare function requireGroupClient(features: unknown, canvas?: Canvas, entries?: readonly LogEntry[]): void;
