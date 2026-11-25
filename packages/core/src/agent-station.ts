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

import type { Item } from "./model.ts";
import { normalizeHandle } from "./handles.ts";

/**
 * **Agent Station convention** (Open Stitch Phase 2A, OS1 ADR 0273 §3).
 *
 * An agent station is a standard canvas group titled `@handle · role` with
 * `properties.role = "agent-station"`, holding a single `agent-trace` text item
 * capped at 40 settled lines, checklist items, peer `@messages`, and artifact
 * chips — zero new operations.
 */

/** Property value marking a group item as an Agent Station. */
const AGENT_STATION_ROLE = "agent-station";
/** Property value marking a text item inside a station as its live trace. */
const AGENT_TRACE_ROLE = "agent-trace";
/** Maximum settled lines retained in an agent station's trace item. */
export const AGENT_TRACE_MAX_LINES = 40;
/** Maximum characters emitted by {@link describeStation} in the context graph. */
export const AGENT_STATION_DESCRIPTION_MAX = 160;

/** Lifecycle phases an agent station reports. */
const AGENT_STATION_PHASES = [
  "working",
  "waiting",
  "paused",
  "done",
  "failed",
  "stopped",
] as const;

/** One of {@link AGENT_STATION_PHASES}. */
type AgentStationPhase = (typeof AGENT_STATION_PHASES)[number];

const PHASE_SET: ReadonlySet<string> = new Set(AGENT_STATION_PHASES);

/** Narrow an unknown value to an {@link AgentStationPhase}. */
function isAgentStationPhase(value: unknown): value is AgentStationPhase {
  return typeof value === "string" && PHASE_SET.has(value);
}

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

function bareHandle(raw: string): string {
  return normalizeHandle(raw) ?? (raw.replace(/^@+/, "").trim() || "agent");
}

/** Canonical title band for a station group: `@handle · role`. */
export function stationTitle(handle: string, role = "agent"): string {
  const bare = bareHandle(handle);
  const cleanRole = role.trim() || "agent";
  return `@${bare} · ${cleanRole}`;
}

/** Encode {@link AgentStationMeta} into string item properties for `item.add` / `item.update`. */
export function stationProperties(meta: AgentStationMeta): Record<string, string> {
  const bare = bareHandle(meta.handle);
  const props: Record<string, string> = {
    role: AGENT_STATION_ROLE,
    "station.handle": bare,
    "station.role": meta.role.trim() || "agent",
    "station.phase": meta.phase,
  };
  if (meta.goal?.trim()) props["station.goal"] = meta.goal.trim();
  if (meta.summary?.trim()) props["station.summary"] = meta.summary.trim();
  if (meta.artifacts && meta.artifacts.length > 0) {
    props["station.artifacts"] = meta.artifacts.filter(Boolean).join(",");
  }
  return props;
}

/** Properties for the trace text item that lives inside an agent station. */
export function traceProperties(stationId: string, handle: string): Record<string, string> {
  const bare = bareHandle(handle);
  return {
    role: AGENT_TRACE_ROLE,
    "station.id": stationId,
    "station.handle": bare,
  };
}

/** Whether a canvas item is an Agent Station group. */
export function isAgentStation(item: Pick<Item, "properties">): boolean {
  return item.properties?.role === AGENT_STATION_ROLE;
}

/** Whether a canvas item is an Agent Station trace item (excluded verbatim from context graphs). */
export function isAgentTrace(item: Pick<Item, "properties">): boolean {
  return item.properties?.role === AGENT_TRACE_ROLE;
}

/** Parse {@link AgentStationMeta} from an item's properties, or `null` if not a station. */
export function readStationMeta(item: Pick<Item, "title" | "properties">): AgentStationMeta | null {
  if (!isAgentStation(item)) return null;
  const props = item.properties ?? {};
  const rawPhase = props["station.phase"];
  const phase: AgentStationPhase = isAgentStationPhase(rawPhase) ? rawPhase : "working";
  const rawHandle = props["station.handle"] ?? item.title.split("·")[0] ?? "agent";
  const handle = bareHandle(rawHandle);
  const role = props["station.role"]?.trim() || item.title.split("·")[1]?.trim() || "agent";
  const artifacts = props["station.artifacts"]
    ? props["station.artifacts"].split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;
  return {
    handle,
    role,
    phase,
    ...(props["station.goal"] ? { goal: props["station.goal"] } : {}),
    ...(props["station.summary"] ? { summary: props["station.summary"] } : {}),
    ...(artifacts && artifacts.length > 0 ? { artifacts } : {}),
  };
}

/** Trim a trace line buffer to the newest `maxLines` (default 40) settled non-empty lines. */
export function capTraceLines(lines: readonly string[], maxLines = AGENT_TRACE_MAX_LINES): string[] {
  const clean = lines
    .map((line) => line.replace(/\r?\n/g, " ").trim())
    .filter((line) => line.length > 0);
  if (maxLines <= 0) return [];
  return clean.length > maxLines ? clean.slice(clean.length - maxLines) : clean;
}

/** Append new trace lines to an existing trace text body, retaining at most `maxLines` lines. */
export function appendTraceLines(
  existingText: string,
  additions: readonly string[],
  maxLines = AGENT_TRACE_MAX_LINES,
): string {
  const current = existingText ? existingText.split(/\r?\n/) : [];
  return capTraceLines([...current, ...additions], maxLines).join("\n");
}

/** Format a station's checklist in standard Markdown task-list syntax. */
export function formatStationChecklist(items: readonly AgentStationChecklistItem[]): string {
  return items
    .map((item) => `- [${item.done ? "x" : " "}] ${item.label.trim()}`)
    .join("\n");
}

/** Format peer `@messages` for display inside an agent station. */
export function formatPeerMessages(messages: readonly AgentPeerMessage[]): string {
  return messages
    .map((msg) => {
      const sender = normalizeHandle(msg.from) ?? msg.from.replace(/^@+/, "").trim();
      const time = msg.at ? ` (${msg.at})` : "";
      return `@${sender}${time}: ${msg.body.replace(/\s+/g, " ").trim()}`;
    })
    .join("\n");
}

/**
 * Produce the single-line, ≤160-character station summary read by the context
 * graph instead of the raw trace.
 */
export function describeStation(
  station: AgentStationMeta | Pick<Item, "title" | "properties">,
): string {
  const meta = "properties" in station ? readStationMeta(station) : station;
  if (!meta) return "";
  const head = `${stationTitle(meta.handle, meta.role)} [${meta.phase}]`;
  const detail = (meta.summary ?? meta.goal ?? "").replace(/\s+/g, " ").trim();
  const artifactNote =
    meta.artifacts && meta.artifacts.length > 0
      ? ` (${meta.artifacts.length} artifact${meta.artifacts.length === 1 ? "" : "s"})`
      : "";
  const full = detail ? `${head}: ${detail}${artifactNote}` : `${head}${artifactNote}`;
  if (full.length <= AGENT_STATION_DESCRIPTION_MAX) return full;
  return `${full.slice(0, AGENT_STATION_DESCRIPTION_MAX - 1)}…`;
}
