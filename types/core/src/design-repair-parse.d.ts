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
import type { DesignRepairInput, DesignRepairOperation } from "./design-repair.js";
/** An incomplete proposal validates its captured basis before replacement bytes or operation identities exist. */
export declare function parseDesignRepairBasis(value: unknown): Omit<DesignRepairInput, "id" | "version">;
/** Strict intent validation preserves optional task attribution without granting permission from a review citation. */
export declare function parseDesignRepairInput(value: unknown): DesignRepairInput;
/** Public repair input cannot supply its resolved edit, retained versions or canonical intent digest. */
export declare function parseDesignRepairOperation(value: unknown): DesignRepairOperation;
/** Accepted identity binds full public intent and original authenticated author across joins and archived retries. */
export declare function designRepairIntentHash(op: DesignRepairOperation, actorId: string): Promise<string>;
