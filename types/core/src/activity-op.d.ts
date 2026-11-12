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
import type { Operation, OperationType } from "./ops.js";
/**
 * The act behind a canonical write, for activity summaries on both surfaces.
 * Group-mode insertion is still adding an item; the writer wraps it so its
 * placement and ancestor repairs are atomic. Explicit group creation stays a
 * group change. Undo keeps the original intent, so only actual creation
 * effects count as adding — an inverse insertion must not claim it added.
 */
export declare function activityOpType(op: Operation): OperationType;
