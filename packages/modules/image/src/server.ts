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

import {
  newItemId,
  newVersionId,
  type Actor,
  type CanvasContents,
  type ModuleRequest,
  type ModuleResponse,
  type ServerHost,
  type ServerModule,
} from "@isocan/core";
import { CREDENTIAL_REF_PROP } from "@isocan/core/keys";
import { bareModelId, modelFor } from "@isocan/core/models";
import {
  IMAGE_MAX_IDEMPOTENCY_KEY_LENGTH,
  IMAGE_PROPS,
  imageFilename,
  validateImagePrompt,
  type ImageGenerateRequest,
  type ImageGenerateResponse,
} from "./core.ts";

/**
 * **Image's server half: `POST /api/m/image/generate`** (Open Stitch phase 3).
 *
 * Synchronous single-image generation and in-place image editing using
 * `modelFor("image")` + `host.resolveKey("gemini")`. Supports an in-memory
 * idempotency cache keyed by `(canvasId, idempotencyKey)` so retries never
 * double-spend or duplicate items. Every error path scrubs key material.
 */

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const IMAGE_GENERATES_PER_MINUTE = 20;
const IMAGE_CARD_SIZE = { width: 512, height: 512 } as const;
const MAX_IDEMPOTENCY_ENTRIES = 512;

const IMAGE_BAD_REQUEST = "image-bad-request";
const IMAGE_OWNER_ONLY = "image-owner-only";
const IMAGE_UNAVAILABLE = "image-unavailable";
const IMAGE_RATE_LIMITED = "image-rate-limited";
const IMAGE_UPSTREAM = "image-upstream";

interface GeminiGenerateResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: unknown;
        inlineData?: { data?: unknown; mimeType?: unknown };
      }>;
    };
  }>;
  error?: { message?: unknown };
}

/** Bounded in-memory idempotency cache keyed by `${canvasId}:${idempotencyKey}`. */
const idempotencyCache = new Map<string, ImageGenerateResponse>();

function rememberIdempotent(cacheKey: string, value: ImageGenerateResponse): void {
  if (idempotencyCache.size >= MAX_IDEMPOTENCY_ENTRIES) {
    const oldest = idempotencyCache.keys().next().value;
    if (oldest !== undefined) idempotencyCache.delete(oldest);
  }
  idempotencyCache.set(cacheKey, value);
}

/** Clear the in-memory idempotency cache (intended for tests). */
export function clearImageIdempotencyCache(): void {
  idempotencyCache.clear();
}

function scrubKey(text: string, key: string): string {
  return key ? text.split(key).join("[key]") : text;
}

function extractUpstreamError(raw: string): string {
  let said = raw.slice(0, 300);
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: unknown }; message?: unknown };
    if (typeof parsed.error?.message === "string" && parsed.error.message) {
      said = parsed.error.message;
    } else if (typeof parsed.message === "string" && parsed.message) {
      said = parsed.message;
    }
  } catch {
    // plain text upstream error
  }
  return said;
}

function nextImagePlacement(canvas: CanvasContents): { x: number; y: number } {
  const items = Object.values(canvas.items);
  if (items.length === 0) return { x: 0, y: 0 };
  let maxRight = -Infinity;
  let minY = Infinity;
  for (const item of items) {
    const right = item.x + item.width;
    if (right > maxRight) maxRight = right;
    if (item.y < minY) minY = item.y;
  }
  return { x: Math.round(maxRight + 32), y: Number.isFinite(minY) ? Math.round(minY) : 0 };
}

function extractImageFromPayload(payload: GeminiGenerateResponse): { bytes: Uint8Array; mimeType: string } | null {
  const parts = payload.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    const inline = part.inlineData;
    if (inline && typeof inline.data === "string" && inline.data) {
      const mimeType = typeof inline.mimeType === "string" && inline.mimeType ? inline.mimeType : "image/png";
      const bytes = new Uint8Array(Buffer.from(inline.data, "base64"));
      if (bytes.byteLength > 0) return { bytes, mimeType };
    }
  }
  return null;
}

function defaultModelOf(host: ServerHost, explicit?: string): string {
  if (explicit?.trim()) return bareModelId(explicit.trim());
  const seam = host.options.model;
  if (typeof seam === "string" && seam.trim()) return bareModelId(seam.trim());
  return bareModelId(modelFor("image", { env: process.env }).id);
}

async function resolveActor(actor: Actor | undefined, host: ServerHost): Promise<Actor | null> {
  if (actor) {
    await host.speaksFor(actor.id);
    return { id: actor.id, name: actor.name };
  }
  return (await host.defaultActor?.()) ?? null;
}

function checkGenerate({ body: raw }: { body: unknown }): ModuleResponse | null {
  const body = raw as Partial<ImageGenerateRequest> | null;
  const bad = (error: string): ModuleResponse => ({ status: 400, body: { error, code: IMAGE_BAD_REQUEST } });
  if (!body || typeof body !== "object") {
    return bad("an image request must be a JSON object naming `canvasId` and `prompt`");
  }
  if (typeof body.canvasId !== "string" || !body.canvasId.trim()) {
    return bad("an image request names the canvas it is for (`canvasId`)");
  }
  const promptCheck = validateImagePrompt(body.prompt);
  if (!promptCheck.ok) return bad(promptCheck.error);
  if (body.editItem !== undefined && (typeof body.editItem !== "string" || !body.editItem.trim())) {
    return bad("when supplied, `editItem` must name an item id on this canvas");
  }
  if (body.model !== undefined && (typeof body.model !== "string" || !body.model.trim())) {
    return bad("when supplied, `model` must be a non-empty model id");
  }
  if (
    body.idempotencyKey !== undefined &&
    (typeof body.idempotencyKey !== "string" ||
      !body.idempotencyKey.trim() ||
      body.idempotencyKey.length > IMAGE_MAX_IDEMPOTENCY_KEY_LENGTH)
  ) {
    return bad(`when supplied, \`idempotencyKey\` must be a non-empty string (at most ${IMAGE_MAX_IDEMPOTENCY_KEY_LENGTH} characters)`);
  }
  if (body.actor !== undefined) {
    const a = body.actor;
    if (!a || typeof a !== "object" || typeof a.id !== "string" || !a.id || typeof a.name !== "string") {
      return bad("when supplied, `actor` must carry non-empty `id` and string `name`");
    }
  }
  return null;
}

async function generateImage(req: ModuleRequest, host: ServerHost): Promise<ModuleResponse> {
  const body = req.body as ImageGenerateRequest;
  const { canvasId } = req;
  const promptCheck = validateImagePrompt(body.prompt);
  if (!promptCheck.ok) {
    return { status: 400, body: { error: promptCheck.error, code: IMAGE_BAD_REQUEST } };
  }
  const prompt = promptCheck.prompt;
  const idempotencyKey = body.idempotencyKey?.trim() || undefined;
  const cacheKey = idempotencyKey ? `${canvasId}:${idempotencyKey}` : undefined;

  if (cacheKey) {
    const hit = idempotencyCache.get(cacheKey);
    if (hit) {
      return { status: 200, body: { ...hit, cached: true } satisfies ImageGenerateResponse };
    }
  }

  const resolved = await host.resolveKey("gemini");
  if (!resolved) {
    return {
      status: 503,
      body: {
        error: "this home has no Gemini key — image generation cannot run here (`isocan keys set gemini`)",
        code: IMAGE_UNAVAILABLE,
      },
    };
  }
  const { key, credentialRef } = resolved;

  const actor = await resolveActor(body.actor, host);
  if (!actor) {
    return {
      status: 400,
      body: {
        error: "an actor is required to add generated images — claim an identity or pass `actor` in the body",
        code: IMAGE_BAD_REQUEST,
      },
    };
  }

  const snapshot = await host.canvas(canvasId);
  const editItemId = body.editItem?.trim() || undefined;
  const parts: Array<Record<string, unknown>> = [{ text: prompt }];

  if (editItemId) {
    const source = snapshot.canvas.items[editItemId];
    if (!source) {
      return {
        status: 404,
        body: { error: `item not found on ${canvasId}: ${editItemId}`, code: IMAGE_BAD_REQUEST },
      };
    }
    const ver = source.versions.find((v) => v.id === source.currentVersionId) ?? source.versions.at(-1);
    if (!ver) {
      return {
        status: 400,
        body: { error: `item ${editItemId} has no version to edit`, code: IMAGE_BAD_REQUEST },
      };
    }
    const sourceBytes = await host.readBlob(canvasId, ver.blobHash);
    if (!sourceBytes) {
      return {
        status: 404,
        body: { error: `source blob missing for item ${editItemId}`, code: IMAGE_BAD_REQUEST },
      };
    }
    parts.push({
      inlineData: {
        mimeType: ver.mimeType || "image/png",
        data: Buffer.from(sourceBytes).toString("base64"),
      },
    });
  }

  const model = defaultModelOf(host, body.model);
  const endpoint = `${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:generateContent`;

  let payload: GeminiGenerateResponse;
  try {
    const res = await host.fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseModalities: ["IMAGE", "TEXT"],
        },
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      return {
        status: 502,
        body: {
          error: scrubKey(`Gemini refused the image request (${res.status}): ${extractUpstreamError(text)}`, key),
          code: IMAGE_UPSTREAM,
        },
      };
    }
    payload = JSON.parse(text) as GeminiGenerateResponse;
  } catch (err) {
    return {
      status: 502,
      body: {
        error: scrubKey(`Gemini could not be reached for image generation: ${err instanceof Error ? err.message : String(err)}`, key),
        code: IMAGE_UPSTREAM,
      },
    };
  }

  const image = extractImageFromPayload(payload);
  if (!image) {
    return {
      status: 502,
      body: { error: "image model returned no image output", code: IMAGE_UPSTREAM },
    };
  }

  const filename = imageFilename(prompt, image.mimeType);
  const put = await host.putBlob(canvasId, image.bytes, { mimeType: image.mimeType, filename });
  const versionId = newVersionId();

  let itemId: string;
  if (editItemId) {
    itemId = editItemId;
    const group = `image-edit-${versionId}`;
    await host.submit({
      canvasId,
      actor,
      group,
      op: {
        type: "item.addVersion",
        itemId,
        version: {
          id: versionId,
          blobHash: put.blobHash,
          mimeType: put.mimeType,
          filename,
          size: put.size,
        },
      },
    });
    await host.submit({
      canvasId,
      actor,
      group,
      op: {
        type: "item.update",
        itemId,
        patch: {
          properties: {
            [IMAGE_PROPS.prompt]: prompt,
            [IMAGE_PROPS.sourceItem]: editItemId,
            parent: editItemId,
            "derived-from": editItemId,
            [CREDENTIAL_REF_PROP]: credentialRef,
            ...(idempotencyKey ? { [IMAGE_PROPS.idempotencyKey]: idempotencyKey } : {}),
          },
        },
      },
    });
  } else {
    itemId = newItemId();
    const title = prompt.length > 64 ? `${prompt.slice(0, 61)}…` : prompt;
    await host.submit({
      canvasId,
      actor,
      op: {
        type: "item.add",
        itemId,
        version: {
          id: versionId,
          blobHash: put.blobHash,
          mimeType: put.mimeType,
          filename,
          size: put.size,
        },
        width: IMAGE_CARD_SIZE.width,
        height: IMAGE_CARD_SIZE.height,
        placement: nextImagePlacement(snapshot.canvas),
        title,
        properties: {
          [IMAGE_PROPS.prompt]: prompt,
          [CREDENTIAL_REF_PROP]: credentialRef,
          ...(idempotencyKey ? { [IMAGE_PROPS.idempotencyKey]: idempotencyKey } : {}),
        },
      },
    });
  }

  const answer: ImageGenerateResponse = {
    itemId,
    versionId,
    blobHash: put.blobHash,
    mimeType: put.mimeType,
    model,
    credentialRef,
  };
  if (cacheKey) rememberIdempotent(cacheKey, answer);

  return { status: 200, body: answer };
}

export const imageServer: ServerModule = {
  name: "@isocan/image",
  routes: [
    {
      method: "POST",
      path: "generate",
      spend: "owner",
      provider: "gemini",
      rate: { perMinute: IMAGE_GENERATES_PER_MINUTE },
      bodyLimit: 16 * 1024,
      says: {
        badRequest: { code: IMAGE_BAD_REQUEST, error: "an image request names `canvasId` and `prompt`" },
        ownerOnly: IMAGE_OWNER_ONLY,
        unavailable: {
          code: IMAGE_UNAVAILABLE,
          error: "this home has no Gemini key — image generation can't run here (`isocan keys set gemini`, or Model keys…, on the machine that holds this canvas)",
        },
        rateLimited: {
          code: IMAGE_RATE_LIMITED,
          error: "this badge has generated enough images this minute — wait a moment and ask again",
        },
      },
      check: checkGenerate,
      handler: generateImage,
    },
  ],
};

export default imageServer;
