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

import type { Actor, CanvasContents, CoreModule, ModuleEdge } from "@isocan/core";

/** Home routes for local FFmpeg media editing primitives. */
export const MEDIA_EDIT_TRIM_ROUTE = "/api/m/media-edit/trim";
export const MEDIA_EDIT_STITCH_ROUTE = "/api/m/media-edit/stitch";
export const MEDIA_EDIT_MUX_ROUTE = "/api/m/media-edit/mux";
export const MEDIA_EDIT_FRAMES_ROUTE = "/api/m/media-edit/frames";

/** Item property keys owned by `@isocan/media-edit`. */
export const CLIP_PROPS = {
  op: "clip.op",
  sources: "clip.sources",
} as const;

export type ClipOp = "trim" | "stitch" | "mux" | "frames";

export interface ClipTrimRequest {
  canvasId: string;
  itemId: string;
  startSec: number;
  endSec: number;
  actor?: Actor;
}

export interface ClipStitchRequest {
  canvasId: string;
  itemIds: string[];
  actor?: Actor;
}

export interface ClipMuxRequest {
  canvasId: string;
  videoItemId: string;
  audioItemId: string;
  actor?: Actor;
}

export interface ClipFramesRequest {
  canvasId: string;
  itemId: string;
  fps?: number;
  actor?: Actor;
}

export interface ClipOutputResponse {
  itemId: string;
  blobHash: string;
  mimeType: string;
  op: Exclude<ClipOp, "frames">;
  sources: string[];
}

export interface ClipFramesResponse {
  itemIds: string[];
  op: "frames";
  sources: string[];
  fps: number;
}

/** Parse comma-separated `clip.sources` property into item ids. */
export function parseClipSources(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * **The record both surfaces register** (Open Stitch phase 3).
 *
 * Owns `clip.op` and `clip.sources`, exposing provenance edges from each
 * source clip to derived outputs.
 */
export const mediaEditModule: CoreModule = {
  name: "@isocan/media-edit",
  propertyKeys: [CLIP_PROPS.op, CLIP_PROPS.sources],
  edges(canvas: CanvasContents): ModuleEdge[] {
    const out: ModuleEdge[] = [];
    for (const item of Object.values(canvas.items)) {
      const sources = parseClipSources(item.properties?.[CLIP_PROPS.sources]);
      for (const srcId of sources) {
        if (srcId === item.id) continue;
        const from = canvas.items[srcId];
        if (from) out.push({ from, to: item });
      }
    }
    return out;
  },
};

export default mediaEditModule;
