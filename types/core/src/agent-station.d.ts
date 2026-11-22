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
import type { Item } from "./model.js";
/** Maximum settled lines retained in an agent station's trace item. */
export declare const AGENT_TRACE_MAX_LINES = 40;
/** Maximum characters emitted by {@link describeStation} in the context graph. */
export declare const AGENT_STATION_DESCRIPTION_MAX = 160;
/** Lifecycle phases an agent station reports. */
declare const AGENT_STATION_PHASES: readonly ["working", "waiting", "paused", "done", "failed", "stopped"];
/** One of {@link AGENT_STATION_PHASES}. */
type AgentStationPhase = (typeof AGENT_STATION_PHASES)[number];
/** One step in a station's checklist. */
interface AgentStationChecklistItem {
    label: string;
    done: boolean;
}
/** One peer-to-peer steer or coordination message displayed in a station. */
interface AgentPeerMessage {
    from: string;
    body: string;
    at?: string | undefined;
}
/** Structured metadata persisted on a station group's `properties`. */
interface AgentStationMeta {
    handle: string;
    role: string;
    phase: AgentStationPhase;
    goal?: string | undefined;
    summary?: string | undefined;
    artifacts?: string[] | undefined;
}
/** Canonical title band for a station group: `@handle · role`. */
export declare function stationTitle(handle: string, role?: string): string;
/** Encode {@link AgentStationMeta} into string item properties for `item.add` / `item.update`. */
export declare function stationProperties(meta: AgentStationMeta): Record<string, string>;
/** Properties for the trace text item that lives inside an agent station. */
export declare function traceProperties(stationId: string, handle: string): Record<string, string>;
/** Whether a canvas item is an Agent Station group. */
export declare function isAgentStation(item: Pick<Item, "properties">): boolean;
/** Whether a canvas item is an Agent Station trace item (excluded verbatim from context graphs). */
export declare function isAgentTrace(item: Pick<Item, "properties">): boolean;
/** Parse {@link AgentStationMeta} from an item's properties, or `null` if not a station. */
export declare function readStationMeta(item: Pick<Item, "title" | "properties">): AgentStationMeta | null;
/** Trim a trace line buffer to the newest `maxLines` (default 40) settled non-empty lines. */
export declare function capTraceLines(lines: readonly string[], maxLines?: number): string[];
/** Append new trace lines to an existing trace text body, retaining at most `maxLines` lines. */
export declare function appendTraceLines(existingText: string, additions: readonly string[], maxLines?: number): string;
/** Format a station's checklist in standard Markdown task-list syntax. */
export declare function formatStationChecklist(items: readonly AgentStationChecklistItem[]): string;
/** Format peer `@messages` for display inside an agent station. */
export declare function formatPeerMessages(messages: readonly AgentPeerMessage[]): string;
/**
 * Produce the single-line, ≤160-character station summary read by the context
 * graph instead of the raw trace.
 */
export declare function describeStation(station: AgentStationMeta | Pick<Item, "title" | "properties">): string;
export {};
