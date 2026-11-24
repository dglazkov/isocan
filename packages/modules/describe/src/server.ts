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
  itemKind,
  type Actor,
  type ModuleRequest,
  type ModuleResponse,
  type ServerHost,
  type ServerModule,
} from "@isocan/core";
import { CREDENTIAL_REF_PROP } from "@isocan/core/keys";
import { bareModelId, modelFor } from "@isocan/core/models";
import {
  AGENT_DESCRIPTION_PROP,
  buildDescribePrompt,
  isDescribableKind,
  type DescribeItemRequest,
  type DescribeItemResponse,
} from "./core.ts";

/**
 * **Describe's server half: `POST /api/m/describe/item`** (Open Stitch phase 3).
 *
 * Reads the target item and its current version bytes from the home, calls
 * Gemini `generateContent` with `modelFor("utility")` and the resolved Gemini
 * key (per-user BYOK first, else env, else owner's stored key), and records
 * `properties.agentDescription` and `properties.credentialRef` via
 * `item.update` (zero new ops). Never leaks key material in any error path.
 */

const DESCRIBE_PER_MINUTE = 30;
/** Inline base64 cap (~14 MiB raw keeps base64 under Gemini's 20 MiB inline request limit). */
const MAX_INLINE_BYTES = 14 * 1024 * 1024;
/** Maximum text excerpt length sent for text/html/markdown/svg/json items. */
const MAX_TEXT_EXCERPT_CHARS = 24_000;

const DESCRIBE_BAD_REQUEST = "describe-bad-request";
const DESCRIBE_OWNER_ONLY = "describe-owner-only";
const DESCRIBE_UNAVAILABLE = "describe-unavailable";
const DESCRIBE_RATE_LIMITED = "describe-rate-limited";
const DESCRIBE_UPSTREAM = "describe-upstream";

interface GeminiGenerateResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: unknown; thought?: unknown }>;
    };
  }>;
  error?: { message?: unknown };
}

function modelOf(host: ServerHost): string {
  const seam = host.options.model;
  if (typeof seam === "string" && seam.trim()) return bareModelId(seam.trim());
  return bareModelId(modelFor("utility", { env: process.env }).id);
}

function isTextualMime(mimeType: string): boolean {
  const lower = mimeType.toLowerCase();
  return (
    lower.startsWith("text/") ||
    lower === "image/svg+xml" ||
    lower === "application/json" ||
    lower === "application/javascript" ||
    lower === "application/xml"
  );
}

function isInlineBinaryMime(mimeType: string): boolean {
  const lower = mimeType.toLowerCase();
  return (
    (lower.startsWith("image/") && lower !== "image/svg+xml") ||
    lower.startsWith("video/") ||
    lower === "application/pdf"
  );
}

function extractGeminiText(payload: GeminiGenerateResponse): string {
  const parts = payload.candidates?.[0]?.content?.parts ?? [];
  return parts
    .filter((p) => !p.thought && typeof p.text === "string")
    .map((p) => p.text as string)
    .join("")
    .trim();
}

function checkDescribe({ body: raw }: { body: unknown }): ModuleResponse | null {
  const body = raw as Partial<DescribeItemRequest> | null;
  const bad = (error: string): ModuleResponse => ({ status: 400, body: { error, code: DESCRIBE_BAD_REQUEST } });
  if (!body || typeof body !== "object") {
    return bad("a describe request must be a JSON object naming `canvasId` and `itemId`");
  }
  if (typeof body.canvasId !== "string" || !body.canvasId.trim()) {
    return bad("a describe request names the canvas it is for (`canvasId`)");
  }
  if (typeof body.itemId !== "string" || !body.itemId.trim()) {
    return bad("a describe request names the item to describe (`itemId`)");
  }
  if (body.actor !== undefined) {
    const a = body.actor;
    if (!a || typeof a !== "object" || typeof a.id !== "string" || !a.id || typeof a.name !== "string") {
      return bad("when supplied, `actor` must carry non-empty `id` and string `name`");
    }
  }
  return null;
}

async function resolveActor(body: DescribeItemRequest, host: ServerHost): Promise<Actor | null> {
  if (body.actor) {
    await host.speaksFor(body.actor.id);
    return { id: body.actor.id, name: body.actor.name };
  }
  return (await host.defaultActor?.()) ?? null;
}

async function describeItem(req: ModuleRequest, host: ServerHost): Promise<ModuleResponse> {
  const body = req.body as DescribeItemRequest;
  const { canvasId } = req;
  const itemId = body.itemId.trim();

  const resolved = await host.resolveKey("gemini");
  if (!resolved) {
    return {
      status: 503,
      body: {
        error: "this home has no Gemini key — describe cannot run here (`isocan keys set gemini`, or set a personal key)",
        code: DESCRIBE_UNAVAILABLE,
      },
    };
  }
  const { key, credentialRef } = resolved;
  const scrub = (text: string): string => text.split(key).join("[key]");

  const actor = await resolveActor(body, host);
  if (!actor) {
    return {
      status: 400,
      body: {
        error: "an actor is required to write `agentDescription` — claim an identity or pass `actor` in the body",
        code: DESCRIBE_BAD_REQUEST,
      },
    };
  }

  const snapshot = await host.canvas(canvasId);
  const item = snapshot.canvas.items[itemId];
  if (!item) {
    return { status: 404, body: { error: `item not found on ${canvasId}: ${itemId}`, code: DESCRIBE_BAD_REQUEST } };
  }
  const version = item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions.at(-1);
  if (!version) {
    return { status: 400, body: { error: `item ${itemId} has no version bytes to describe`, code: DESCRIBE_BAD_REQUEST } };
  }

  const kind = itemKind(item);
  if (!isDescribableKind(kind)) {
    return {
      status: 400,
      body: {
        error: `item ${itemId} is kind "${kind}" — describe supports image, video, document, and screen items`,
        code: DESCRIBE_BAD_REQUEST,
      },
    };
  }

  const bytes = await host.readBlob(canvasId, version.blobHash);
  if (!bytes) {
    return { status: 404, body: { error: `blob ${version.blobHash} for item ${itemId} is not at this home`, code: DESCRIBE_BAD_REQUEST } };
  }

  const prompt = buildDescribePrompt(kind, item.title);
  const parts: Array<Record<string, unknown>> = [{ text: prompt }];

  if (isTextualMime(version.mimeType)) {
    const rawText = Buffer.from(bytes).toString("utf8");
    const excerpt =
      rawText.length > MAX_TEXT_EXCERPT_CHARS
        ? `${rawText.slice(0, MAX_TEXT_EXCERPT_CHARS)}\n[truncated]`
        : rawText;
    parts.push({ text: `\n\n--- Content (${version.mimeType}, ${version.filename}) ---\n${excerpt}` });
  } else if (isInlineBinaryMime(version.mimeType)) {
    if (bytes.byteLength > MAX_INLINE_BYTES) {
      return {
        status: 413,
        body: {
          error: `item ${itemId} (${bytes.byteLength} bytes) exceeds the ${MAX_INLINE_BYTES}-byte inline description limit`,
          code: DESCRIBE_BAD_REQUEST,
        },
      };
    }
    parts.push({
      inlineData: {
        mimeType: version.mimeType,
        data: Buffer.from(bytes).toString("base64"),
      },
    });
  } else {
    return {
      status: 400,
      body: {
        error: `unsupported mimeType "${version.mimeType}" for describe on item ${itemId}`,
        code: DESCRIBE_BAD_REQUEST,
      },
    };
  }

  const model = modelOf(host);
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  let description: string;
  try {
    const res = await host.fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      let said = text.slice(0, 300);
      try {
        const parsed = JSON.parse(text) as GeminiGenerateResponse;
        if (typeof parsed.error?.message === "string" && parsed.error.message) {
          said = parsed.error.message;
        }
      } catch {
        // non-JSON upstream error
      }
      return {
        status: 502,
        body: {
          error: scrub(`Gemini refused the describe request (${res.status}): ${said}`),
          code: DESCRIBE_UPSTREAM,
        },
      };
    }
    const parsed = JSON.parse(text) as GeminiGenerateResponse;
    description = extractGeminiText(parsed);
    if (!description) {
      return {
        status: 502,
        body: {
          error: "Gemini answered without a description",
          code: DESCRIBE_UPSTREAM,
        },
      };
    }
    description = scrub(description);
  } catch (err) {
    return {
      status: 502,
      body: {
        error: scrub(`Gemini could not be reached to describe ${itemId}: ${err instanceof Error ? err.message : String(err)}`),
        code: DESCRIBE_UPSTREAM,
      },
    };
  }

  await host.submit({
    canvasId,
    actor,
    op: {
      type: "item.update",
      itemId,
      patch: {
        properties: {
          [AGENT_DESCRIPTION_PROP]: description,
          [CREDENTIAL_REF_PROP]: credentialRef,
        },
      },
    },
  });

  return {
    status: 200,
    body: {
      itemId,
      agentDescription: description,
      model,
      credentialRef,
    } satisfies DescribeItemResponse,
  };
}

export const describeServer: ServerModule = {
  name: "@isocan/describe",
  routes: [
    {
      method: "POST",
      path: "item",
      spend: "owner",
      provider: "gemini",
      rate: { perMinute: DESCRIBE_PER_MINUTE },
      bodyLimit: 16 * 1024,
      says: {
        badRequest: { code: DESCRIBE_BAD_REQUEST, error: "a describe request names `canvasId` and `itemId`" },
        ownerOnly: DESCRIBE_OWNER_ONLY,
        unavailable: {
          code: DESCRIBE_UNAVAILABLE,
          error: "this home has no Gemini key — describe can't run here (`isocan keys set gemini`, or Model keys…, on the machine that holds this canvas)",
        },
        rateLimited: {
          code: DESCRIBE_RATE_LIMITED,
          error: "this badge has described enough items this minute — wait a moment and ask again",
        },
      },
      check: checkDescribe,
      handler: describeItem,
    },
  ],
};

export default describeServer;
