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
import { type DesignRequestReadPort } from "./design-request-reader.js";
import { type DesignCraftPacket, type DesignCraftStage } from "./design-craft-packet.js";
export { parseDesignCraftPacket, type DesignCraftPacket, type DesignCraftStage } from "./design-craft-packet.js";
/** Reads optional adapted knowledge around one canonical request without enrollment, questions or writes. */
export declare function readDesignCraft(io: DesignRequestReadPort, options: {
    canvasId: string;
    requestId: string;
    stage: DesignCraftStage;
    signal?: AbortSignal;
}): Promise<DesignCraftPacket>;
/** Rechecks the original complete capture through current permissions, without recapturing beneath local drafts. */
export declare function checkDesignCraft(io: DesignRequestReadPort, options: {
    canvasId: string;
    requestId: string;
    packet: unknown;
    signal?: AbortSignal;
}): Promise<{
    packetId: string;
    status: "current" | "stale" | "unavailable";
    reasons: string[];
}>;
