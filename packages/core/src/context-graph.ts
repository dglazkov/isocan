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

import type { CanvasState, Item } from "./model.ts";
import type { LogEntry } from "./ops.ts";
import type { NodeLease, PresenceSession, PresenceViewport } from "./protocol.ts";
import { itemKind } from "./kinds.ts";
import { isGroupItem } from "./canvas-groups.ts";
import { isArea, itemsIn } from "./area.ts";
import { declaredEdgesOf } from "./edges.ts";
import { describeFailure, formatFailureForGraph } from "./failures.ts";
import { describeStation, isAgentStation, isAgentTrace, readStationMeta } from "./agent-station.ts";
import { summarizeOp } from "./work-visible.ts";

/**
 * **Context Graph serializer** (Open Stitch Phase 2A, OS1 `src/graph.ts` &
 * `src/canvasInput.ts` + ADR 0274/0275).
 *
 * Produces a single structured, deterministic representation of a canvas for
 * agents (both CLI `isocan context --graph [--nav]` and MCP `read_canvas`):
 * typed items with `agentDescription` and plain-language failures, provenance
 * edges, selection, Follow-Me viewport visibility sets, reading-order clusters,
 * ≤160-char station summaries (never raw traces), active soft leases, recent
 * activity, and `suggestedFreeRegions` for pointer-free placement.
 */

/** Maximum visible item ids returned in the Follow-Me nearest-centre list (OS1 ADR 0275). */
const FOLLOW_ME_VISIBLE_LIMIT = 40;

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
  rect: { x: number; y: number; width: number; height: number };
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
  leases: Array<{ itemId: string; handle: string; expiresAt: string }>;
  recentActivity: Array<{ seq: number; actor: string; summary: string; ts: string }>;
  suggestedFreeRegions: FreeRegion[];
}

/** Sort items in reading order: rows top-to-bottom (40px band), then left-to-right. */
function readingOrderCompare(a: Pick<Item, "id" | "x" | "y">, b: Pick<Item, "id" | "x" | "y">): number {
  const rowA = Math.round(a.y / 40);
  const rowB = Math.round(b.y / 40);
  if (rowA !== rowB) return rowA - rowB;
  if (a.x !== b.x) return a.x - b.x;
  return a.id.localeCompare(b.id);
}

function itemFailureLine(item: Item): string | undefined {
  const props = item.properties ?? {};
  const isJobFailed = props["job.status"] === "failed" || props["job.state"] === "failed";
  const errMsg = props["job.error"] ?? props["error.message"] ?? props["failure.message"];
  if (!isJobFailed && !errMsg) return undefined;
  const failure = describeFailure({
    kind: props["error.kind"] ?? props["job.errorKind"],
    code: props["error.code"] ?? props["job.errorCode"],
    message: errMsg ?? "Generation failed",
    model: props["job.model"],
    provider: props["job.provider"],
  });
  return formatFailureForGraph(failure);
}

function computeViewVisibility(
  viewport: PresenceViewport,
  items: readonly Item[],
): ContextGraphView {
  const rect = {
    x: viewport.x,
    y: viewport.y,
    width: viewport.width,
    height: viewport.height,
  };
  const vx2 = rect.x + rect.width;
  const vy2 = rect.y + rect.height;
  const vcx = rect.x + rect.width / 2;
  const vcy = rect.y + rect.height / 2;

  const fullyVisibleIds: string[] = [];
  const partiallyVisibleIds: string[] = [];
  const offscreenIds: string[] = [];
  const visibleScored: Array<{ id: string; dist: number }> = [];

  for (const item of items) {
    const ix2 = item.x + item.width;
    const iy2 = item.y + item.height;
    const fully = item.x >= rect.x && item.y >= rect.y && ix2 <= vx2 && iy2 <= vy2;
    const intersects = item.x < vx2 && ix2 > rect.x && item.y < vy2 && iy2 > rect.y;
    if (fully) {
      fullyVisibleIds.push(item.id);
    } else if (intersects) {
      partiallyVisibleIds.push(item.id);
    } else {
      offscreenIds.push(item.id);
    }
    if (fully || intersects) {
      const cx = item.x + item.width / 2;
      const cy = item.y + item.height / 2;
      visibleScored.push({ id: item.id, dist: Math.hypot(cx - vcx, cy - vcy) });
    }
  }

  visibleScored.sort((a, b) => a.dist - b.dist || a.id.localeCompare(b.id));
  const computedVisible = visibleScored.slice(0, FOLLOW_ME_VISIBLE_LIMIT).map((s) => s.id);
  const visibleIds =
    viewport.visibleIds && viewport.visibleIds.length > 0
      ? viewport.visibleIds.slice(0, FOLLOW_ME_VISIBLE_LIMIT)
      : computedVisible;

  return {
    zoom: viewport.zoom,
    rect,
    fullyVisibleIds,
    partiallyVisibleIds,
    offscreenIds,
    visibleIds,
  };
}

/**
 * Compute clean empty world-space regions beside existing canvas content so an
 * agent can place new items without overlapping existing work.
 */
export function computeSuggestedFreeRegions(
  items: readonly Pick<Item, "x" | "y" | "width" | "height">[],
  regionWidth = 480,
  regionHeight = 360,
  gap = 80,
): FreeRegion[] {
  if (items.length === 0) {
    return [{ label: "origin", x: 0, y: 0, width: regionWidth, height: regionHeight }];
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const item of items) {
    if (item.x < minX) minX = item.x;
    if (item.y < minY) minY = item.y;
    if (item.x + item.width > maxX) maxX = item.x + item.width;
    if (item.y + item.height > maxY) maxY = item.y + item.height;
  }
  return [
    {
      label: "right-of-content",
      x: Math.round(maxX + gap),
      y: Math.round(minY),
      width: regionWidth,
      height: regionHeight,
    },
    {
      label: "below-content",
      x: Math.round(minX),
      y: Math.round(maxY + gap),
      width: regionWidth,
      height: regionHeight,
    },
  ];
}

/**
 * Build a pure, structured {@link ContextGraph} from a canvas snapshot and
 * optional live presence, leases, and recent ops.
 */
export function buildContextGraph(
  snapshot: Pick<CanvasState, "project" | "canvas">,
  opts: ContextGraphOptions = {},
): ContextGraph {
  const mode: ContextGraphMode = opts.mode ?? "full";
  const allItems = Object.values(snapshot.canvas.items);
  const sortedItems = [...allItems].sort(readingOrderCompare);

  const leaseByItem = new Map<string, Pick<NodeLease, "itemId" | "handle" | "expiresAt">>();
  const leases: ContextGraph["leases"] = [];
  for (const lease of opts.leases ?? []) {
    leaseByItem.set(lease.itemId, lease);
    leases.push({ itemId: lease.itemId, handle: lease.handle, expiresAt: lease.expiresAt });
  }

  // Stations are surfaced ONLY through their <=160-char summary; raw trace
  // items are intentionally excluded from the item list so traces never bloat
  // model context.
  const stations: ContextGraphStation[] = [];
  const stationIds = new Set<string>();
  for (const item of sortedItems) {
    if (!isAgentStation(item)) continue;
    stationIds.add(item.id);
    const meta = readStationMeta(item);
    if (meta) {
      stations.push({
        itemId: item.id,
        handle: meta.handle,
        role: meta.role,
        phase: meta.phase,
        summary: describeStation(meta),
      });
    }
  }

  const visibleContentItems = sortedItems.filter((item) => !isAgentTrace(item));

  const graphItems: ContextGraphItem[] = visibleContentItems.map((item) => {
    const desc =
      item.properties?.agentDescription?.trim() ||
      item.description?.trim() ||
      undefined;
    const failure = itemFailureLine(item);
    const lease = leaseByItem.get(item.id);
    const isStation = stationIds.has(item.id);
    return {
      id: item.id,
      title: item.title,
      kind: isGroupItem(item) ? "group" : itemKind(item),
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
      containerId: item.containerId ?? null,
      currentVersionId: item.currentVersionId,
      ...(mode === "full" && desc ? { agentDescription: desc } : {}),
      ...(failure ? { failure } : {}),
      ...(lease ? { leasedByHandle: lease.handle } : {}),
      ...(isStation ? { isStation: true } : {}),
    };
  });

  // Provenance edges: parent / derived-from / containerId + declared `edge:*`
  const edges: ContextGraphEdge[] = [];
  const seenEdge = new Set<string>();
  const pushEdge = (from: string, to: string, relation: string, label?: string) => {
    if (!from || !to || from === to) return;
    if (!snapshot.canvas.items[from] || !snapshot.canvas.items[to]) return;
    const key = `${from}|${to}|${relation}`;
    if (seenEdge.has(key)) return;
    seenEdge.add(key);
    edges.push({ from, to, relation, ...(label ? { label } : {}) });
  };

  for (const item of visibleContentItems) {
    if (item.containerId) {
      pushEdge(item.containerId, item.id, "parent");
    }
    const parentProp =
      item.properties?.["derived-from"] ??
      item.properties?.derivedFrom ??
      item.properties?.parent ??
      item.properties?.mapParent;
    if (parentProp) {
      pushEdge(parentProp.trim(), item.id, "derived-from");
    }
    for (const decl of declaredEdgesOf(item)) {
      pushEdge(item.id, decl.to, `edge:${decl.key}`, decl.label);
    }
  }

  // Clusters (groups and legacy areas) in reading order
  const clusters: ContextGraphCluster[] = [];
  const clusteredIds = new Set<string>();

  for (const item of visibleContentItems) {
    if (stationIds.has(item.id)) continue;
    if (isGroupItem(item)) {
      const members = visibleContentItems
        .filter((child) => child.containerId === item.id && !isAgentTrace(child))
        .sort(readingOrderCompare)
        .map((c) => c.id);
      for (const id of members) clusteredIds.add(id);
      clusteredIds.add(item.id);
      clusters.push({
        id: item.id,
        title: item.title,
        kind: "group",
        memberIds: members,
      });
    } else if (isArea(item)) {
      const members = itemsIn(snapshot.canvas, item)
        .filter((child) => !isAgentTrace(child) && !stationIds.has(child.id))
        .sort(readingOrderCompare)
        .map((c) => c.id);
      for (const id of members) clusteredIds.add(id);
      clusteredIds.add(item.id);
      clusters.push({
        id: item.id,
        title: item.title,
        kind: "area",
        memberIds: members,
      });
    }
  }

  const looseIds = visibleContentItems
    .filter((item) => !clusteredIds.has(item.id) && !stationIds.has(item.id))
    .map((item) => item.id);

  // Selection (explicit + live presence selections)
  const selectionSet = new Set<string>(opts.selection ?? []);
  for (const session of opts.presence ?? []) {
    for (const id of session.selection ?? []) {
      if (snapshot.canvas.items[id]) selectionSet.add(id);
    }
  }
  const selection = [...selectionSet];

  // Follow-Me viewport (explicit override or first live session carrying viewport)
  const activeViewport =
    opts.viewport !== undefined
      ? opts.viewport
      : (opts.presence ?? []).find((s) => s.viewport != null)?.viewport ?? null;
  const view = activeViewport ? computeViewVisibility(activeViewport, visibleContentItems) : null;

  // Recent activity (newest up to 15)
  const recentActivity = (opts.recentOps ?? []).slice(-15).map((entry) => ({
    seq: entry.seq,
    actor: entry.envelope.actor.name,
    summary: summarizeOp(entry.envelope.op, { canvas: snapshot.canvas }),
    ts: entry.envelope.ts,
  }));

  const suggestedFreeRegions = computeSuggestedFreeRegions(allItems);

  return {
    mode,
    canvas: {
      id: snapshot.project.id,
      title: snapshot.project.title,
      itemCount: visibleContentItems.length,
      groupCount: clusters.length,
      threadCount: Object.keys(snapshot.canvas.threads).length,
    },
    items: graphItems,
    edges,
    selection,
    view,
    clusters,
    looseIds,
    stations,
    leases,
    recentActivity,
    suggestedFreeRegions,
  };
}

/**
 * Render a {@link ContextGraph} into compact, deterministic plain text for CLI
 * stdout or agent prompts. In `"nav"` mode emits a compact `NAV INDEX`.
 */
export function renderContextGraph(graph: ContextGraph): string {
  const lines: string[] = [];
  const headerTag = graph.mode === "nav" ? "NAV INDEX" : "CONTEXT GRAPH";
  lines.push(
    `# ${headerTag}: ${graph.canvas.title} (${graph.canvas.id}) — ${graph.canvas.itemCount} items, ${graph.canvas.groupCount} clusters, ${graph.canvas.threadCount} threads`,
  );

  if (graph.selection.length > 0) {
    lines.push(`Selection: ${graph.selection.join(", ")}`);
  }

  if (graph.view) {
    const r = graph.view.rect;
    lines.push(
      `View: zoom=${graph.view.zoom.toFixed(2)} rect=(${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}) fullyVisible=[${graph.view.fullyVisibleIds.join(",")}] partiallyVisible=[${graph.view.partiallyVisibleIds.join(",")}] offscreen=${graph.view.offscreenIds.length}`,
    );
  }

  if (graph.stations.length > 0) {
    lines.push("", "## Active Agent Stations");
    for (const station of graph.stations) {
      lines.push(`- ${station.itemId}: ${station.summary}`);
    }
  }

  if (graph.leases.length > 0) {
    lines.push("", "## Active Leases");
    for (const lease of graph.leases) {
      lines.push(`- ${lease.itemId} leased by @${lease.handle} (until ${lease.expiresAt})`);
    }
  }

  if (graph.clusters.length > 0) {
    lines.push("", "## Clusters (reading order)");
    for (const cluster of graph.clusters) {
      lines.push(`- [${cluster.kind}] ${cluster.id} "${cluster.title}": ${cluster.memberIds.join(", ") || "(empty)"}`);
    }
  }

  const contentItems = graph.items.filter((i) => !i.isStation);
  if (contentItems.length > 0) {
    lines.push("", "## Items");
    for (const item of contentItems) {
      const leaseTag = item.leasedByHandle ? ` [leased:@${item.leasedByHandle}]` : "";
      const failTag = item.failure ? ` ${item.failure}` : "";
      const pos = `(${Math.round(item.x)},${Math.round(item.y)} ${Math.round(item.width)}x${Math.round(item.height)})`;
      const desc =
        graph.mode === "full" && item.agentDescription
          ? ` — ${item.agentDescription}`
          : "";
      lines.push(`- ${item.id} [${item.kind}] "${item.title}" ${pos} v=${item.currentVersionId}${leaseTag}${failTag}${desc}`);
    }
  }

  if (graph.mode === "full" && graph.edges.length > 0) {
    lines.push("", "## Edges");
    for (const edge of graph.edges) {
      const lbl = edge.label ? ` "${edge.label}"` : "";
      lines.push(`- ${edge.from} --${edge.relation}${lbl}--> ${edge.to}`);
    }
  }

  if (graph.mode === "full" && graph.recentActivity.length > 0) {
    lines.push("", "## Recent Activity");
    for (const act of graph.recentActivity) {
      lines.push(`- #${act.seq} ${act.actor}: ${act.summary}`);
    }
  }

  if (graph.suggestedFreeRegions.length > 0) {
    lines.push("", "## Suggested Free Regions");
    for (const reg of graph.suggestedFreeRegions) {
      lines.push(`- ${reg.label}: (${reg.x}, ${reg.y}) ${reg.width}x${reg.height}`);
    }
  }

  return lines.join("\n");
}
