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

/**
 * **CLI Agent Semantics** (Open Stitch Phase 2A).
 *
 * Keeps all Phase 2A CLI behavior out of `main.ts` so `main.ts` stays slim:
 * - `session work <item> --doing <verb>`
 * - `session start --station [--role <role>]`
 * - `session point <item> --ack`
 * - `edit --expect <ver>`
 * - `comment reply --receipt <item>`
 * - `context --graph [--nav]` and `context --view`
 */

import type { DaemonRoutes } from "@isocan/api";
import { CanvasGroups } from "@isocan/api";
import {
  AGENT_ACTION_VERBS,
  ApiError,
  buildContextGraph,
  capTraceLines,
  computeSuggestedFreeRegions,
  describeFailure,
  formatFailureForCli,
  formatReceiptLine,
  handleForActor,
  isAgentActionVerb,
  isAgentStation,
  makeCommentReceipt,
  newItemId,
  newVersionId,
  normalizeHandle,
  readStationMeta,
  renderContextGraph,
  stationProperties,
  stationTitle,
  traceProperties,
  type Actor,
  type AgentActionVerb,
  type CanvasSnapshotResponse,
  type CommentReceipt,
  type Item,
  type ItemPrecondition,
  type PaintAckResult,
  type PresenceSession,
} from "@isocan/core";
import { EXIT_CONFLICT } from "./conditional-edit.ts";
import { printJson } from "./output.ts";

/** Minimal CLI context subset required by agent-semantics helpers (easy to test in-process). */
export interface AgentSemanticsCtx {
  client: DaemonRoutes;
  actor: Actor;
  json?: boolean;
}

/** Validate `--doing <verb>` against {@link AGENT_ACTION_VERBS}. */
export function parseDoingVerb(raw: string): AgentActionVerb {
  const clean = raw.trim().toLowerCase();
  if (!isAgentActionVerb(clean)) {
    throw new Error(`--doing expects one of: ${AGENT_ACTION_VERBS.join(", ")} — got "${raw}"`);
  }
  return clean;
}

/** Parse `--expect <ver|hash:sha|updated:iso>` into an {@link ItemPrecondition}. */
export function parseExpectFlag(raw: string): ItemPrecondition {
  const value = raw.trim();
  if (!value) throw new Error("--expect requires a version id, content hash, or updatedAt timestamp");
  if (value.startsWith("hash:")) {
    const hash = value.slice(5).trim();
    if (!hash) throw new Error("--expect hash: requires a non-empty content hash");
    return { contentHash: hash };
  }
  if (value.startsWith("updated:")) {
    const updatedAt = value.slice(8).trim();
    if (!updatedAt) throw new Error("--expect updated: requires an ISO timestamp");
    return { updatedAt };
  }
  if (/^[a-f0-9]{64}$/i.test(value)) {
    return { contentHash: value };
  }
  return { versionId: value };
}

/**
 * Format and report an `expect` precondition 409 conflict using the shared
 * plain-language failure object, setting `process.exitCode = EXIT_CONFLICT`.
 * Returns `true` if `err` was handled as a precondition conflict.
 */
export function handlePreconditionConflict(ctx: Pick<AgentSemanticsCtx, "json">, err: unknown): boolean {
  if (!(err instanceof ApiError)) return false;
  if (err.status !== 409 && err.code !== "precondition-conflict") return false;
  const failure = describeFailure({
    kind: "precondition-conflict",
    code: err.code ?? "precondition-conflict",
    status: err.status,
    message: err.message,
  });
  process.exitCode = EXIT_CONFLICT;
  if (ctx.json) {
    printJson({ status: "conflict", code: err.code ?? "precondition-conflict", failure });
  } else {
    console.error(formatFailureForCli(failure));
  }
  return true;
}

/** Resolve an item by id, exact title, or unique prefix (matching CLI semantics). */
function resolveItemInSnapshot(snapshot: CanvasSnapshotResponse, ref: string): Item {
  const direct = snapshot.canvas.items[ref];
  if (direct) return direct;
  const items = Object.values(snapshot.canvas.items);
  const exact = items.find((i) => i.title.toLowerCase() === ref.toLowerCase());
  if (exact) return exact;
  const matches = items.filter(
    (i) => i.id.startsWith(ref) || i.title.toLowerCase().startsWith(ref.toLowerCase()),
  );
  if (matches.length === 1) return matches[0]!;
  if (matches.length > 1) {
    throw new Error(`ambiguous item "${ref}" — matches: ${matches.map((m) => m.id).join(", ")}`);
  }
  throw new Error(`unknown item "${ref}"`);
}

/** Result of creating or refreshing an Agent Station on a canvas. */
export interface StationStartResult {
  handle: string;
  role: string;
  stationItemId: string;
  traceItemId: string | null;
  created: boolean;
}

/**
 * Create (or refresh) the agent's station group (`@handle · role`) and its
 * `agent-trace` text item on `canvasId`, using existing operations only.
 */
export async function ensureAgentStation(
  ctx: AgentSemanticsCtx,
  canvasId: string,
  opts: { role?: string; handle?: string; goal?: string } = {},
): Promise<StationStartResult> {
  const snapshot = await ctx.client.snapshot(canvasId);
  const sessions = await ctx.client.listSessions(canvasId).catch(() => [] as PresenceSession[]);
  const takenHandles = new Set<string>();
  for (const s of sessions) {
    if (s.actor.id !== ctx.actor.id && s.handle) takenHandles.add(s.handle);
  }
  for (const item of Object.values(snapshot.canvas.items)) {
    const meta = readStationMeta(item);
    if (meta && item.createdBy.id !== ctx.actor.id) takenHandles.add(meta.handle);
  }
  const handle =
    (opts.handle ? normalizeHandle(opts.handle) : null) ??
    handleForActor(ctx.actor.id, takenHandles);
  const role = opts.role?.trim() || "agent";
  const title = stationTitle(handle, role);
  const props = stationProperties({
    handle,
    role,
    phase: "working",
    ...(opts.goal ? { goal: opts.goal } : {}),
  });

  // Reuse existing station for this handle if already present on canvas.
  const existing = Object.values(snapshot.canvas.items).find((item) => {
    if (!isAgentStation(item)) return false;
    return readStationMeta(item)?.handle === handle;
  });
  if (existing) {
    await ctx.client.sendOp(canvasId, ctx.actor, {
      type: "item.update",
      itemId: existing.id,
      patch: { title, properties: props },
    });
    const trace = Object.values(snapshot.canvas.items).find(
      (i) => i.properties?.role === "agent-trace" && i.properties?.["station.id"] === existing.id,
    );
    return {
      handle,
      role,
      stationItemId: existing.id,
      traceItemId: trace?.id ?? null,
      created: false,
    };
  }

  const free = computeSuggestedFreeRegions(Object.values(snapshot.canvas.items), 360, 260, 80)[0]!;
  const traceBody = capTraceLines([`${title} started.`]).join("\n");
  const traceBytes = Buffer.from(traceBody, "utf8");
  const uploaded = await ctx.client.uploadBlob(canvasId, traceBytes, "text/plain", `${handle}-trace.txt`);

  if (snapshot.project.groupMode === "groups") {
    const groups = new CanvasGroups(ctx.client, canvasId, () => ctx.actor);
    const created = await groups.new(title, { at: { x: free.x, y: free.y }, properties: props });
    const stationItemId = created.itemId!;
    const traceItemId = newItemId();
    await ctx.client.sendOp(canvasId, ctx.actor, {
      type: "item.add",
      itemId: traceItemId,
      containerId: stationItemId,
      title: `@${handle} trace`,
      width: 320,
      height: 180,
      placement: { x: free.x + 20, y: free.y + 48, chosen: true },
      properties: traceProperties(stationItemId, handle),
      version: {
        id: newVersionId(),
        blobHash: uploaded.blobHash,
        mimeType: "text/plain",
        filename: `${handle}-trace.txt`,
        size: uploaded.size,
      },
    });
    return { handle, role, stationItemId, traceItemId, created: true };
  }

  // Legacy canvas mode: create an area item for the station + trace text item inside it.
  const stationItemId = newItemId();
  const areaBlob = await ctx.client.uploadBlob(
    canvasId,
    Buffer.from(JSON.stringify({ kind: "area" }), "utf8"),
    "application/vnd.isocan.area+json",
    `${handle}-station.json`,
  );
  await ctx.client.sendOp(canvasId, ctx.actor, {
    type: "item.add",
    itemId: stationItemId,
    title,
    width: 360,
    height: 240,
    placement: { x: free.x, y: free.y, chosen: true },
    properties: { kind: "area", ...props },
    version: {
      id: newVersionId(),
      blobHash: areaBlob.blobHash,
      mimeType: "application/vnd.isocan.area+json",
      filename: `${handle}-station.json`,
      size: areaBlob.size,
    },
  });
  const traceItemId = newItemId();
  await ctx.client.sendOp(canvasId, ctx.actor, {
    type: "item.add",
    itemId: traceItemId,
    title: `@${handle} trace`,
    width: 320,
    height: 160,
    placement: { x: free.x + 20, y: free.y + 56, chosen: true },
    properties: traceProperties(stationItemId, handle),
    version: {
      id: newVersionId(),
      blobHash: uploaded.blobHash,
      mimeType: "text/plain",
      filename: `${handle}-trace.txt`,
      size: uploaded.size,
    },
  });
  return { handle, role, stationItemId, traceItemId, created: true };
}

/** Build a structured {@link CommentReceipt} for `isocan comment reply --receipt <item>`. */
export function buildReplyReceipt(
  snapshot: CanvasSnapshotResponse,
  itemRef: string,
  replyText: string,
): CommentReceipt {
  const item = resolveItemInSnapshot(snapshot, itemRef);
  return makeCommentReceipt(item, replyText);
}

/** Format receipt confirmation line for CLI output. */
export function receiptConfirmationLine(receipt: CommentReceipt): string {
  return formatReceiptLine(receipt);
}

/** Await a paint acknowledgement for `isocan session point --ack`. */
export async function awaitPointPaintAck(
  ctx: AgentSemanticsCtx,
  canvasId: string,
  timeoutMs = 1000,
): Promise<PaintAckResult> {
  const snap = await ctx.client.snapshot(canvasId);
  const res = await ctx.client.paintAckStatus(canvasId, { seq: snap.lastSeq, waitMs: timeoutMs });
  if ("status" in res) return res;
  return {
    seq: snap.lastSeq,
    status: res.paintedSeq >= snap.lastSeq ? "rendered" : "applied",
    paintedSeq: res.paintedSeq,
    waitedMs: 0,
  };
}

/** Execute `isocan context --graph [--nav]` and print JSON or rendered text. */
export async function runContextGraph(
  ctx: AgentSemanticsCtx,
  canvasId: string,
  opts: { nav?: boolean } = {},
): Promise<void> {
  const [snapshot, sessions, leaseRes] = await Promise.all([
    ctx.client.snapshot(canvasId),
    ctx.client.listSessions(canvasId).catch(() => [] as PresenceSession[]),
    ctx.client.leases(canvasId).catch(() => ({ leases: [] })),
  ]);
  const graph = buildContextGraph(snapshot, {
    presence: sessions,
    leases: leaseRes.leases,
    mode: opts.nav ? "nav" : "full",
  });
  if (ctx.json) {
    printJson(graph);
    return;
  }
  console.log(renderContextGraph(graph));
}

/** Execute `isocan context --view` (Follow-Me viewport readout). */
export async function runContextView(
  ctx: AgentSemanticsCtx,
  canvasId: string,
): Promise<void> {
  const [snapshot, sessions] = await Promise.all([
    ctx.client.snapshot(canvasId),
    ctx.client.listSessions(canvasId).catch(() => [] as PresenceSession[]),
  ]);
  const graph = buildContextGraph(snapshot, { presence: sessions });
  const payload = { canvasId, view: graph.view };
  if (ctx.json) {
    printJson(payload);
    return;
  }
  if (!graph.view) {
    console.log("no live Follow-Me viewport reported");
    return;
  }
  const r = graph.view.rect;
  console.log(
    `viewport: (${Math.round(r.x)}, ${Math.round(r.y)}) ${Math.round(r.width)}x${Math.round(r.height)} @ ${Math.round(graph.view.zoom * 100)}%`,
  );
  console.log(`fully visible (${graph.view.fullyVisibleIds.length}): ${graph.view.fullyVisibleIds.join(", ") || "none"}`);
  console.log(`partially visible (${graph.view.partiallyVisibleIds.length}): ${graph.view.partiallyVisibleIds.join(", ") || "none"}`);
  console.log(`offscreen: ${graph.view.offscreenIds.length}`);
}

/** Build the agent-actor predicate used by `isocan wait` for the 4-hop mention breaker. */
export async function makeWaitAgentChecker(
  client: DaemonRoutes,
  snapshot: CanvasSnapshotResponse | null,
): Promise<(actorId: string) => boolean> {
  const kinds = await client.actorKinds().catch(() => ({} as Record<string, string>));
  return (actorId: string) =>
    kinds[actorId] === "agent" || Boolean(snapshot?.canvas.agents?.[actorId]);
}
