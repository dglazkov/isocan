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
import { type CanvasContents } from "../../core/src/index.js";
import type { DeskCheckInput } from "../../core/src/desk-check.js";
import type { CanvasDesignAudit } from "./design-audit-reader.js";
/**
 * **What the desk check needs from a surface** (proactive-agent phase 8):
 * the bytes of a version, the design audit over some screens, the stale
 * receipts, and the wires behind their system. Each client already reads
 * all four its own way — the terminal through its daemon client, the
 * browser through its badge — so this file asks rather than reaches, and
 * says what was found the same way for both.
 */
export interface DeskCheckPort {
    text(blobHash: string): Promise<string>;
    audit(itemIds: readonly string[]): Promise<CanvasDesignAudit>;
    /** Design receipts whose inputs changed since they were written, titled by their output. */
    staleReceipts(): Promise<{
        title: string;
        why: string;
    }[]>;
    /** The wireframe module's reading of wires behind their system (`readWiresBehind`); empty without the module. */
    wiresBehind(canvas: CanvasContents): Promise<{
        title: string;
        system: string;
    }[]>;
}
/**
 * **Read the desk check** — everything but the critics, whom the room
 * module asks (the surface adds them). Every part that cannot be read is
 * left out rather than failing the share: the check reports, it never blocks.
 */
export declare function readDeskCheck(port: DeskCheckPort, canvas: CanvasContents, opts?: {
    itemIds?: readonly string[];
}): Promise<Omit<DeskCheckInput, "critics">>;
