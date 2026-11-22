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
import type { CanvasState, Item } from "./model.js";
import type { LogEntry } from "./ops.js";
import type { NodeLease, PresenceSession, PresenceViewport } from "./protocol.js";
/** Serialization detail level: full context graph or compact navigation index. */
type ContextGraphMode = "full" | "nav";
/** Options accepted by {@link buildContextGraph}. */
interface ContextGraphOptions {
    /** Live presence sessions (used for selection and Follow-Me viewport). */
    presence?: readonly PresenceSession[] | undefined;
    /** Active ephemeral soft leases held by the daemon. */
    leases?: readonly Pick<NodeLease, "itemId" | "handle" | "expiresAt">[] | undefined;
    /** Recent oplog entries summarized as first-person past-tense lines. */
    recentOps?: readonly LogEntry[] | undefined;
    /** Detail level: `"full"` (default) or `"nav"` (compact navigation index). */
    mode?: ContextGraphMode | undefined;
    /** Explicit Follow-Me viewport override (otherwise read from live presence). */
    viewport?: PresenceViewport | null | undefined;
    /** Explicit selected item ids (merged with live presence selections). */
    selection?: readonly string[] | undefined;
}
/** One typed item node inside a {@link ContextGraph}. */
interface ContextGraphItem {
    id: string;
    title: string;
    kind: string;
    x: number;
    y: number;
    width: number;
    height: number;
    containerId: string | null;
    currentVersionId: string;
    agentDescription?: string;
    failure?: string;
    leasedByHandle?: string;
    isStation?: boolean;
}
/** One directional provenance or declared edge between two items. */
interface ContextGraphEdge {
    from: string;
    to: string;
    relation: string;
    label?: string;
}
/** Follow-Me viewport visibility breakdown. */
interface ContextGraphView {
    zoom: number;
    rect: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    fullyVisibleIds: string[];
    partiallyVisibleIds: string[];
    offscreenIds: string[];
    /** Up to 40 visible item ids ordered nearest to the viewport centre first. */
    visibleIds: string[];
}
/** One cluster (group or legacy area) in reading order. */
interface ContextGraphCluster {
    id: string;
    title: string;
    kind: "group" | "area";
    memberIds: string[];
}
/** Active agent station summary (always ≤160 chars, never raw trace lines). */
interface ContextGraphStation {
    itemId: string;
    handle: string;
    role: string;
    phase: string;
    summary: string;
}
/** Suggested empty world-space region beside existing content for clean placement. */
interface FreeRegion {
    label: string;
    x: number;
    y: number;
    width: number;
    height: number;
}
/** Full structured context graph produced by {@link buildContextGraph}. */
export interface ContextGraph {
    mode: ContextGraphMode;
    canvas: {
        id: string;
        title: string;
        itemCount: number;
        groupCount: number;
        threadCount: number;
    };
    items: ContextGraphItem[];
    edges: ContextGraphEdge[];
    selection: string[];
    view: ContextGraphView | null;
    clusters: ContextGraphCluster[];
    looseIds: string[];
    stations: ContextGraphStation[];
    leases: Array<{
        itemId: string;
        handle: string;
        expiresAt: string;
    }>;
    recentActivity: Array<{
        seq: number;
        actor: string;
        summary: string;
        ts: string;
    }>;
    suggestedFreeRegions: FreeRegion[];
}
/**
 * Compute clean empty world-space regions beside existing canvas content so an
 * agent can place new items without overlapping existing work.
 */
export declare function computeSuggestedFreeRegions(items: readonly Pick<Item, "x" | "y" | "width" | "height">[], regionWidth?: number, regionHeight?: number, gap?: number): FreeRegion[];
/**
 * Build a pure, structured {@link ContextGraph} from a canvas snapshot and
 * optional live presence, leases, and recent ops.
 */
export declare function buildContextGraph(snapshot: Pick<CanvasState, "project" | "canvas">, opts?: ContextGraphOptions): ContextGraph;
/**
 * Render a {@link ContextGraph} into compact, deterministic plain text for CLI
 * stdout or agent prompts. In `"nav"` mode emits a compact `NAV INDEX`.
 */
export declare function renderContextGraph(graph: ContextGraph): string;
export {};
