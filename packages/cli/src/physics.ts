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
 * **CLI physics flags** (Open Stitch phase 1B).
 *
 * Keeps the CLI logic for `--actual-size`, `--make-room`, `--infer`, and
 * `--source` out of `main.ts` and `canvas-groups.ts` so both stay slim while
 * every new core physics helper has a first-class CLI surface tested in-process.
 */

import type { CanvasGroupResult, DaemonRoutes } from "@isocan/api";
import { CanvasGroups, resolveCanvasGroupRef } from "@isocan/api";
import {
  TITLE_SOURCE_PROP,
  actualSizeFor,
  annotationsOf,
  canOverwriteTitle,
  computeMakeRoom,
  groupChildren,
  inferGroupLayout,
  isGroupItem,
  isTitleSource,
  itemKind,
  parseImageMetadata,
  readTitleSource,
  type Actor,
  type CanvasContents,
  type InferredGroupLayout,
  type Item,
  type NamedRect,
  type Size2D,
  type TitleSource,
} from "@isocan/core";
import type { Ctx } from "./ctx.ts";
import { printJson } from "./output.ts";

/** Read an item's natural dimensions (properties or image header) and return its 100% actual size. */
export async function resolveActualSize(
  ctx: { client: Pick<DaemonRoutes, "downloadBlob"> },
  canvasId: string,
  item: Item,
): Promise<Size2D> {
  const kind = itemKind(item);
  const propW = Number(item.properties?.naturalWidth);
  const propH = Number(item.properties?.naturalHeight);
  let natural: Size2D | undefined =
    Number.isFinite(propW) && Number.isFinite(propH) && propW > 0 && propH > 0
      ? { width: propW, height: propH }
      : undefined;

  if (!natural) {
    const current = item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions.at(-1);
    if (current && current.mimeType.startsWith("image/")) {
      const bytes = await ctx.client.downloadBlob(canvasId, current.blobHash);
      const meta = parseImageMetadata(new Uint8Array(bytes), current.mimeType);
      if (meta.width && meta.height) {
        natural = { width: meta.width, height: meta.height };
      }
    }
  }

  return actualSizeFor(kind, natural);
}

/** Result of evaluating `set --title ... --source <user|agent|auto>` against `titleSource` CAS. */
export interface TitleSourceCheck {
  blocked: boolean;
  currentSource?: TitleSource | undefined;
  incoming?: TitleSource | undefined;
}

/**
 * Validate `--source <user|agent|auto>` on `isocan set` and apply the
 * `titleSource` compare-and-set rule to `patch`.
 *
 * When blocked (e.g. `auto` trying to overwrite `user`), strips `patch.title`
 * so the existing title stays untouched and reports why.
 */
export function applyTitleSourceOption(
  item: Item,
  opts: { title?: string; source?: string },
  patch: { title?: string; properties?: Record<string, string> },
): TitleSourceCheck {
  if (opts.source === undefined) return { blocked: false };
  const raw = opts.source.trim().toLowerCase();
  if (!isTitleSource(raw)) {
    throw new Error(`--source expects user, agent, or auto — got: ${opts.source}`);
  }
  if (opts.title === undefined) {
    throw new Error("--source requires --title");
  }
  const currentSource = readTitleSource(item.properties);
  if (!canOverwriteTitle(currentSource, raw)) {
    delete patch.title;
    return { blocked: true, currentSource, incoming: raw };
  }
  patch.properties = { ...(patch.properties ?? {}), [TITLE_SOURCE_PROP]: raw };
  return { blocked: false, currentSource, incoming: raw };
}

/**
 * Compute neighbour displacements for `isocan mv --make-room` within the same
 * container scope, preserving pinned/locked items as immovable obstacles.
 */
export function planMakeRoomDisplacements(
  canvas: CanvasContents,
  item: Item,
  target: { x: number; y: number },
  marks: readonly Item[],
): Array<{ itemId: string; x: number; y: number }> {
  const movedIds = new Set<string>([item.id, ...marks.map((m) => m.id)]);
  const parent = item.containerId ?? null;
  const siblings: NamedRect[] = [];
  const protectedIds = new Set<string>();

  for (const other of Object.values(canvas.items)) {
    if (movedIds.has(other.id)) continue;
    if ((other.containerId ?? null) !== parent) continue;
    if (other.properties?.annotates && movedIds.has(other.properties.annotates)) continue;
    siblings.push({ id: other.id, x: other.x, y: other.y, width: other.width, height: other.height });
    if (other.properties?.pinned === "true" || other.properties?.locked === "true") {
      protectedIds.add(other.id);
    }
  }

  const movedRect = { x: target.x, y: target.y, width: item.width, height: item.height };
  const pushed = computeMakeRoom(movedRect, movedIds, siblings, { protectedIds });
  const moves: Array<{ itemId: string; x: number; y: number }> = [];
  for (const [id, pos] of pushed) {
    const orig = canvas.items[id];
    if (!orig) continue;
    const dx = pos.x - orig.x;
    const dy = pos.y - orig.y;
    moves.push({ itemId: id, x: pos.x, y: pos.y });
    for (const mark of annotationsOf(canvas, id)) {
      moves.push({ itemId: mark.id, x: mark.x + dx, y: mark.y + dy });
    }
  }
  return moves;
}

/**
 * Execute `mv --make-room` on a group-enabled canvas in one atomic `moveMany`
 * transform so the moved item and every pushed neighbour share one undo step.
 */
export async function moveWithMakeRoomGroup(
  ctx: { client: DaemonRoutes; actor: Actor },
  canvasId: string,
  canvas: CanvasContents,
  item: Item,
  target: { x: number; y: number },
  opts: { dryRun?: boolean },
): Promise<CanvasGroupResult> {
  const marks = annotationsOf(canvas, item.id);
  const pushed = planMakeRoomDisplacements(canvas, item, target, marks);
  const movedSet = new Set<string>([item.id]);
  const targets: Array<{ ref: string; at: { x: number; y: number } }> = [{ ref: item.id, at: target }];
  for (const row of pushed) {
    const entry = canvas.items[row.itemId];
    // On group canvases, `CanvasGroups.moveMany` moves attached ink with its target automatically.
    if (!entry || entry.properties?.annotates || movedSet.has(row.itemId)) continue;
    movedSet.add(row.itemId);
    targets.push({ ref: row.itemId, at: { x: row.x, y: row.y } });
  }
  return new CanvasGroups(ctx.client, canvasId, () => ctx.actor).moveMany(targets, { dryRun: !!opts.dryRun });
}

/** Result returned by `wrapWithInferredLayout` and `inferGroupLayoutAction`. */
export interface InferGroupCliResult {
  inferred: {
    layout: InferredGroupLayout["layout"];
    columns?: number;
    gap: number;
    movedCount: number;
  };
  result: CanvasGroupResult;
}

/**
 * `isocan canvas group wrap <items...> --title <t> --infer`: infer vertical,
 * horizontal, or grid positions for the selected items, apply them, and wrap
 * them into a hug-sized group.
 */
export async function wrapWithInferredLayout(
  handle: CanvasGroups,
  ctx: Pick<Ctx, "client" | "json">,
  refs: string[],
  opts: { title: string; note?: string; dryRun?: boolean },
): Promise<InferGroupCliResult> {
  const snapshot = await ctx.client.snapshot(handle.canvasId);
  const items = refs.map((ref) => resolveCanvasGroupRef(snapshot.canvas, ref));
  const boxes: NamedRect[] = items.map((item) => ({
    id: item.id,
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
  }));
  const inferred = inferGroupLayout(boxes);

  const moves: Array<{ ref: string; at: { x: number; y: number } }> = [];
  if (inferred.layout !== "freeform") {
    for (const item of items) {
      const next = inferred.positions.get(item.id);
      if (next && (next.x !== item.x || next.y !== item.y)) {
        moves.push({ ref: item.id, at: next });
      }
    }
  }

  if (!opts.dryRun && moves.length > 0) {
    await handle.moveMany(moves);
  }
  const result = await handle.wrap(refs, opts.title, {
    ...(opts.note !== undefined ? { note: opts.note } : {}),
    dryRun: !!opts.dryRun,
  });

  return {
    inferred: {
      layout: inferred.layout,
      ...(inferred.columns !== undefined ? { columns: inferred.columns } : {}),
      gap: inferred.gap,
      movedCount: moves.length,
    },
    result,
  };
}

/**
 * `isocan canvas group layout <group> --infer`: infer a clean vertical,
 * horizontal, or grid arrangement for an existing group's direct children and
 * fit the group frame around them.
 */
export async function inferExistingGroupLayout(
  handle: CanvasGroups,
  ctx: Pick<Ctx, "client" | "json">,
  groupRef: string,
  opts: { dryRun?: boolean },
): Promise<InferGroupCliResult> {
  const snapshot = await ctx.client.snapshot(handle.canvasId);
  const group = resolveCanvasGroupRef(snapshot.canvas, groupRef, true);
  if (!isGroupItem(group)) throw new Error(`${groupRef} is not a canvas group`);
  const children = groupChildren(snapshot.canvas, group.id);
  const boxes: NamedRect[] = children.map((child) => ({
    id: child.id,
    x: child.x,
    y: child.y,
    width: child.width,
    height: child.height,
  }));
  const inferred = inferGroupLayout(boxes);

  const moves: Array<{ ref: string; at: { x: number; y: number } }> = [];
  if (inferred.layout !== "freeform") {
    for (const child of children) {
      const next = inferred.positions.get(child.id);
      if (next && (next.x !== child.x || next.y !== child.y)) {
        moves.push({ ref: child.id, at: next });
      }
    }
  }

  if (moves.length > 0) {
    const moved = await handle.moveMany(moves, { dryRun: !!opts.dryRun });
    const fitted = opts.dryRun ? moved : await handle.frame([group.id], { fit: true });
    return {
      inferred: {
        layout: inferred.layout,
        ...(inferred.columns !== undefined ? { columns: inferred.columns } : {}),
        gap: inferred.gap,
        movedCount: moves.length,
      },
      result: fitted,
    };
  }

  const fitted = await handle.frame([group.id], { fit: true, dryRun: !!opts.dryRun });
  return {
    inferred: {
      layout: inferred.layout,
      ...(inferred.columns !== undefined ? { columns: inferred.columns } : {}),
      gap: inferred.gap,
      movedCount: 0,
    },
    result: fitted,
  };
}

/** Print human or JSON summary of an inferred-layout group command. */
export function printInferredGroupResult(
  ctx: Pick<Ctx, "json">,
  out: InferGroupCliResult,
  report: (result: CanvasGroupResult) => Promise<void>,
): Promise<void> {
  if (ctx.json) {
    printJson({ inferred: out.inferred, ...out.result });
    return Promise.resolve();
  }
  const cols = out.inferred.columns !== undefined ? ` (${out.inferred.columns} cols)` : "";
  console.log(`inferred layout: ${out.inferred.layout}${cols}, gap ${out.inferred.gap}`);
  return report(out.result);
}
