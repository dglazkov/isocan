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

import { titleSlug, type Actor, type CanvasContents, type CoreModule, type JobSnapshot, type ModuleEdge } from "@isocan/core";
import { bareModelId } from "@isocan/core/models";

/** Home route that starts an async home-polled video generation job. */
export const VIDEO_GENERATE_ROUTE = "/api/m/video/generate";

/** Job kind key registered on `ServerModule.jobs` and stored in `job.kind`. */
export const VIDEO_JOB_KIND = "video";

/** Item property keys owned by `@isocan/video`. */
export const VIDEO_PROPS = {
  prompt: "video.prompt",
  sourceItem: "video.sourceItem",
} as const;

/** Supported clip lengths in seconds (4, 6, 8 for Veo; 10 for Omni). */
export const VIDEO_DURATIONS = [4, 6, 8, 10] as const;
export type VideoDuration = (typeof VIDEO_DURATIONS)[number];

/** Supported aspect ratios for video clips. */
export const VIDEO_ASPECT_RATIOS = ["16:9", "9:16"] as const;
export type VideoAspectRatio = (typeof VIDEO_ASPECT_RATIOS)[number];

/** Maximum prompt length accepted by `POST /api/m/video/generate`. */
export const VIDEO_MAX_PROMPT_LENGTH = 2000;

/** Request payload for `POST /api/m/video/generate`. */
export interface VideoGenerateRequest {
  canvasId: string;
  prompt: string;
  fromItem?: string;
  model?: string;
  durationSeconds?: VideoDuration;
  aspectRatio?: VideoAspectRatio;
  actor?: Actor;
}

/** Response payload returned with HTTP 202 by `POST /api/m/video/generate`. */
export interface VideoGenerateResponse {
  job: JobSnapshot;
  itemId: string;
}

/** Validate a video generation prompt string. */
export function validateVideoPrompt(
  raw: unknown,
): { ok: true; prompt: string } | { ok: false; error: string } {
  if (typeof raw !== "string") {
    return { ok: false, error: "a video request carries a non-empty `prompt`" };
  }
  const prompt = raw.trim();
  if (!prompt) {
    return { ok: false, error: "a video request carries a non-empty `prompt`" };
  }
  if (prompt.length > VIDEO_MAX_PROMPT_LENGTH) {
    return {
      ok: false,
      error: `video \`prompt\` is at most ${VIDEO_MAX_PROMPT_LENGTH} characters (got ${prompt.length})`,
    };
  }
  return { ok: true, prompt };
}

/** Validate an optional clip duration in seconds. */
export function validateVideoDuration(
  raw: unknown,
): { ok: true; durationSeconds?: VideoDuration } | { ok: false; error: string } {
  if (raw === undefined || raw === null || raw === "") return { ok: true };
  const n = typeof raw === "string" ? Number(raw) : raw;
  if (typeof n !== "number" || !Number.isInteger(n) || !(VIDEO_DURATIONS as readonly number[]).includes(n)) {
    return {
      ok: false,
      error: `\`durationSeconds\` must be one of ${VIDEO_DURATIONS.join(", ")} — got ${String(raw)}`,
    };
  }
  return { ok: true, durationSeconds: n as VideoDuration };
}

/** Validate an optional aspect ratio. */
export function validateVideoAspectRatio(
  raw: unknown,
): { ok: true; aspectRatio?: VideoAspectRatio } | { ok: false; error: string } {
  if (raw === undefined || raw === null || raw === "") return { ok: true };
  if (typeof raw !== "string" || !(VIDEO_ASPECT_RATIOS as readonly string[]).includes(raw)) {
    return {
      ok: false,
      error: `\`aspectRatio\` must be one of ${VIDEO_ASPECT_RATIOS.join(", ")} — got ${String(raw)}`,
    };
  }
  return { ok: true, aspectRatio: raw as VideoAspectRatio };
}

/** True when `model` targets Gemini Omni (`interactions` endpoint). */
export function isOmniVideoModel(model: string): boolean {
  const bare = bareModelId(model).replace(/^models\//, "");
  return /^gemini-omni-/i.test(bare);
}

/** True when `model` targets Veo (`predictLongRunning` endpoint). */
export function isVeoVideoModel(model: string): boolean {
  const bare = bareModelId(model).replace(/^models\//, "");
  return /^veo-/i.test(bare);
}

/** Safe `.mp4` filename derived from the prompt and model id. */
export function videoFilename(prompt: string, model: string): string {
  const slug = titleSlug(prompt, { max: 36, ascii: true });
  const modelSlug = titleSlug(bareModelId(model).replace(/^models\//, ""), { max: 24, ascii: true });
  return `${slug || "video"}${modelSlug ? `-${modelSlug}` : ""}.mp4`;
}

/**
 * **The record both surfaces register** (Open Stitch phase 3).
 *
 * Owns `video.prompt` and `video.sourceItem`, remaps `video.sourceItem` on copy,
 * and exposes provenance edges from source items to generated videos.
 */
export const videoModule: CoreModule = {
  name: "@isocan/video",
  propertyKeys: [VIDEO_PROPS.prompt, VIDEO_PROPS.sourceItem],
  itemReferenceProperties: [VIDEO_PROPS.sourceItem],
  edges(canvas: CanvasContents): ModuleEdge[] {
    const out: ModuleEdge[] = [];
    for (const item of Object.values(canvas.items)) {
      const srcId = item.properties?.[VIDEO_PROPS.sourceItem];
      if (!srcId) continue;
      const from = canvas.items[srcId];
      if (from) out.push({ from, to: item });
    }
    return out;
  },
};

export default videoModule;
