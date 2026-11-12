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
import type { LogEntry, OpEnvelope } from "./ops.js";
import type { DesignArtifactRef } from "./design-partner.js";
import type { DesignRepairInput } from "./design-repair.js";
/** A canonical repair edge remains attributed to its original act; history causes determine activity. */
export interface DesignRepairTransition {
    id: string;
    request: NonNullable<DesignRepairInput["request"]>;
    target: DesignRepairInput["target"];
    adopted: DesignArtifactRef;
}
/** Replay validates the one exact edit and its flat evidence without resolving now-changed live policy. */
export declare function validateDesignRepairCanonical(envelope: OpEnvelope): void;
/** Original acceptance is active unless the latest recorded Undo/Redo cause disables it; hashes alone never restore authority. */
export declare function activeDesignRepairEntries(history: readonly LogEntry[]): LogEntry[];
/** Current request context combines these accepted repair edges with live adoption edges, without recapturing its original input. */
export declare function designRepairTransitions(history: readonly LogEntry[]): DesignRepairTransition[];
