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

import { titleSlug, type Actor, type CanvasContents, type CoreModule, type ModuleEdge } from "@isocan/core";

/** Home route that generates or edits a single image on a canvas. */
export const IMAGE_GENERATE_ROUTE = "/api/m/image/generate";

/** Item property keys owned by `@isocan/image`. */
export const IMAGE_PROPS = {
  prompt: "image.prompt",
  sourceItem: "image.sourceItem",
  idempotencyKey: "image.idempotencyKey",
} as const;

/** Maximum prompt length accepted by `POST /api/m/image/generate`. */
export const IMAGE_MAX_PROMPT_LENGTH = 2000;

/** Maximum idempotency key length accepted by `POST /api/m/image/generate`. */
export const IMAGE_MAX_IDEMPOTENCY_KEY_LENGTH = 128;

/** Request payload for `POST /api/m/image/generate`. */
export interface ImageGenerateRequest {
  canvasId: string;
  prompt: string;
  editItem?: string;
  model?: string;
  idempotencyKey?: string;
  actor?: Actor;
}

/** Response payload returned by `POST /api/m/image/generate`. */
export interface ImageGenerateResponse {
  itemId: string;
  versionId: string;
  blobHash: string;
  mimeType: string;
  model: string;
  credentialRef: string;
  cached?: boolean;
}

/** Validate an image generation or edit prompt. */
export function validateImagePrompt(
  raw: unknown,
): { ok: true; prompt: string } | { ok: false; error: string } {
  if (typeof raw !== "string") {
    return { ok: false, error: "an image request carries a non-empty `prompt`" };
  }
  const prompt = raw.trim();
  if (!prompt) {
    return { ok: false, error: "an image request carries a non-empty `prompt`" };
  }
  if (prompt.length > IMAGE_MAX_PROMPT_LENGTH) {
    return {
      ok: false,
      error: `image \`prompt\` is at most ${IMAGE_MAX_PROMPT_LENGTH} characters (got ${prompt.length})`,
    };
  }
  return { ok: true, prompt };
}

/** Safe filename derived from the prompt and mime type. */
export function imageFilename(prompt: string, mimeType: string): string {
  const slug = titleSlug(prompt, { max: 40, ascii: true });
  const base = mimeType.toLowerCase().split(";")[0]?.trim() ?? "image/png";
  const ext = base === "image/jpeg" || base === "image/jpg" ? "jpg" : base === "image/webp" ? "webp" : "png";
  return `${slug || "image"}.${ext}`;
}

/**
 * **The record both surfaces register** (Open Stitch phase 3).
 *
 * Owns `image.prompt`, `image.sourceItem`, and `image.idempotencyKey`, remaps
 * `image.sourceItem` on copy, and exposes provenance edges from source items
 * to derived images.
 */
export const imageModule: CoreModule = {
  name: "@isocan/image",
  propertyKeys: [IMAGE_PROPS.prompt, IMAGE_PROPS.sourceItem, IMAGE_PROPS.idempotencyKey],
  itemReferenceProperties: [IMAGE_PROPS.sourceItem],
  edges(canvas: CanvasContents): ModuleEdge[] {
    const out: ModuleEdge[] = [];
    for (const item of Object.values(canvas.items)) {
      const srcId = item.properties?.[IMAGE_PROPS.sourceItem];
      if (!srcId || srcId === item.id) continue;
      const from = canvas.items[srcId];
      if (from) out.push({ from, to: item });
    }
    return out;
  },
};

export default imageModule;
