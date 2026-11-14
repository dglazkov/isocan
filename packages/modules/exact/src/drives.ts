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

import type { CanvasContents, Item, LogEntry } from "@isocan/core";
import { core } from "./core-ref.ts";

/**
 * **Drive mode over the canvas** (exact phase 3; design §5, §7) — the pure
 * half. A browser whose local-tool door is shut (*Live frames* off, or a
 * home that is not on this machine) still drives: it writes the drive it
 * wants on the screen as `exact.drive` with the ordinary `item.update`, and
 * `isocan exact live` — on the machine that captures the app, waiting on the
 * canvas's op log as every CLI waiter does — replays it and writes the answer
 * back as `exact.driven`. Nothing reaches the person's machine from the
 * browser; the drive is a capture behind, and visible on the item.
 */

/** What a browser asks for. `seq` names the request; the answer carries it back. */
export interface DriveRequest {
  seq: number;
  by: string | null;
  host: string;
  size: string;
  scheme: "light" | "dark";
  shots: string;
  ops: string[];
}

/** What `isocan exact live` answers: the fresh picture as a blob of the canvas, and its nodes. */
export interface DriveAnswer {
  seq: number;
  ok: boolean;
  blobHash: string | null;
  points: unknown;
  results: Array<{ op: string; reply: Record<string, unknown> | null }>;
  ms: number;
  error?: string;
}

export function parseDriveRequest(text: string | undefined): DriveRequest | null {
  if (!text) return null;
  try {
    const v = JSON.parse(text) as DriveRequest;
    if (!Number.isFinite(v?.seq) || typeof v.host !== "string" || typeof v.shots !== "string" || !Array.isArray(v.ops) || v.ops.some((o) => typeof o !== "string")) return null;
    return { seq: v.seq, by: typeof v.by === "string" ? v.by : null, host: v.host, size: typeof v.size === "string" ? v.size : "390x844", scheme: v.scheme === "dark" ? "dark" : "light", shots: v.shots, ops: v.ops };
  } catch {
    return null;
  }
}

export function parseDriveAnswer(text: string | undefined): DriveAnswer | null {
  if (!text) return null;
  try {
    const v = JSON.parse(text) as DriveAnswer;
    return Number.isFinite(v?.seq) ? v : null;
  } catch {
    return null;
  }
}

/**
 * **The drives waiting for an answer, read off the op log**: each
 * `item.update` that wrote `exact.drive` on one of this app's screens, whose
 * request the screen still holds and has not been answered. The newest per
 * screen: a press made while an older drive ran supersedes it (it carries the
 * whole drive).
 */
export function pendingDrives(entries: readonly LogEntry[], canvas: CanvasContents, appId: string): Array<{ item: Item; request: DriveRequest }> {
  const touched = new Set<string>();
  for (const e of entries) {
    const op = e.envelope.op as { type: string; itemId?: string; patch?: { properties?: Record<string, unknown> } };
    if (op.type === "item.update" && op.itemId && op.patch?.properties && core.EXACT_PROPS.drive in op.patch.properties) touched.add(op.itemId);
  }
  const out: Array<{ item: Item; request: DriveRequest }> = [];
  for (const id of touched) {
    const item = canvas.items[id];
    if (!item || core.appIdOf(item) !== appId) continue;
    const request = parseDriveRequest(item.properties?.[core.EXACT_PROPS.drive]);
    const answered = parseDriveAnswer(item.properties?.[core.EXACT_PROPS.driven]);
    if (request && (!answered || answered.seq < request.seq)) out.push({ item, request });
  }
  return out;
}
