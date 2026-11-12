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
import type { CanvasState } from "./model.js";
import type { Operation } from "./ops.js";
/**
 * Compute the inverse of an operation against the state it is ABOUT to be
 * applied to. The daemon runs this before applying and stores the result in
 * the LogEntry — inverses are never re-derived later.
 *
 * Returns null for operations that are not undoable (trash.empty,
 * project.delete). Both are confirmation-gated at the client.
 */
export declare function invertOperation(stateBefore: CanvasState | null, op: Operation): Operation | null;
