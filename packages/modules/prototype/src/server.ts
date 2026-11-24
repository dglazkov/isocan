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
  newOpId,
  newVersionId,
  type Actor,
  type ModuleRequest,
  type ModuleResponse,
  type ServerHost,
  type ServerModule,
} from "@isocan/core";
import { CREDENTIAL_REF_PROP } from "@isocan/core/keys";
import { bareModelId, modelFor } from "@isocan/core/models";
import {
  PROTOTYPE_PROPS,
  isPrototypeTier,
  validateSelfContainedHtml,
  type PrototypeBuildRequest,
  type PrototypeBuiltResponse,
  type PrototypeDelegatedResponse,
} from "./core.ts";

const BUILD_PER_MINUTE = 12;

const BAD_REQUEST = "prototype-bad-request";
const OWNER_ONLY = "prototype-owner-only";
const UNAVAILABLE = "prototype-unavailable";
const RATE_LIMITED = "prototype-rate-limited";
const UPSTREAM = "prototype-upstream";

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
  return bareModelId(modelFor("chat", { env: process.env }).id);
}

function extractGeminiText(payload: GeminiGenerateResponse): string {
  const parts = payload.candidates?.[0]?.content?.parts ?? [];
  return parts
    .filter((p) => !p.thought && typeof p.text === "string")
    .map((p) => p.text as string)
    .join("")
    .trim();
}

async function resolveActor(actor: Actor | undefined, host: ServerHost): Promise<Actor | null> {
  if (actor) {
    await host.speaksFor(actor.id);
    return { id: actor.id, name: actor.name };
  }
  return (await host.defaultActor?.()) ?? null;
}

function checkBuild({ body: raw }: { body: unknown }): ModuleResponse | null {
  const body = raw as Partial<PrototypeBuildRequest> | null;
  const bad = (error: string): ModuleResponse => ({ status: 400, body: { error, code: BAD_REQUEST } });
  if (!body || typeof body !== "object") return bad("request body must be a JSON object");
  if (typeof body.canvasId !== "string" || !body.canvasId.trim()) return bad("`canvasId` is required");
  if (typeof body.prompt !== "string" || !body.prompt.trim()) return bad("`prompt` is required");
  if (body.tier !== undefined && !isPrototypeTier(body.tier)) {
    return bad('`tier` must be "quick", "standard", or "app"');
  }
  return null;
}

async function handleBuild(req: ModuleRequest, host: ServerHost): Promise<ModuleResponse> {
  const body = req.body as PrototypeBuildRequest;
  const tier = body.tier ?? "quick";

  if (tier === "app") {
    return {
      status: 200,
      body: {
        delegated: true,
        tier: "app",
        route: "/api/m/workbench/start",
        hint: "App-tier prototypes run as a workbench agent session",
      } satisfies PrototypeDelegatedResponse,
    };
  }

  const resolved = await host.resolveKey("gemini");
  if (!resolved) {
    return { status: 503, body: { error: "this home has no Gemini key", code: UNAVAILABLE } };
  }
  const scrub = (s: string) => s.split(resolved.key).join("[key]");

  const actor = await resolveActor(body.actor, host);
  if (!actor) {
    return { status: 400, body: { error: "an actor is required to build a prototype", code: BAD_REQUEST } };
  }

  const model = modelOf(host);
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const detail =
    tier === "standard"
      ? "Build a rich, interactive, responsive, self-contained HTML5 prototype with inline CSS and vanilla JS."
      : "Build a concise, clean, self-contained HTML5 prototype with inline CSS.";

  let rawHtml: string;
  try {
    const res = await host.fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": resolved.key,
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${detail} Do not reference external scripts. Return only the complete HTML document.\n\nPrompt: ${body.prompt.trim()}`,
              },
            ],
          },
        ],
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
        body: { error: scrub(`Gemini refused the prototype build (${res.status}): ${said}`), code: UPSTREAM },
      };
    }
    const parsed = JSON.parse(text) as GeminiGenerateResponse;
    rawHtml = scrub(extractGeminiText(parsed));
  } catch (err) {
    return {
      status: 502,
      body: {
        error: scrub(`Gemini prototype build failed: ${err instanceof Error ? err.message : String(err)}`),
        code: UPSTREAM,
      },
    };
  }

  const validated = validateSelfContainedHtml(rawHtml);
  if (!validated.ok) {
    return { status: 502, body: { error: validated.error, code: UPSTREAM } };
  }

  const filename = `prototype-${tier}.html`;
  const blob = await host.putBlob(req.canvasId, new TextEncoder().encode(validated.html), {
    mimeType: "text/html",
    filename,
  });
  const versionId = newVersionId();

  if (body.itemId?.trim()) {
    const targetId = body.itemId.trim();
    const snapshot = await host.canvas(req.canvasId);
    if (!snapshot.canvas.items[targetId]) {
      return { status: 404, body: { error: `item not found: ${targetId}`, code: BAD_REQUEST } };
    }
    const group = newOpId();
    await host.submit({
      canvasId: req.canvasId,
      actor,
      group,
      op: {
        type: "item.addVersion",
        itemId: targetId,
        version: {
          id: versionId,
          blobHash: blob.blobHash,
          mimeType: "text/html",
          filename,
          size: blob.size,
        },
      },
    });
    await host.submit({
      canvasId: req.canvasId,
      actor,
      group,
      op: {
        type: "item.update",
        itemId: targetId,
        patch: {
          properties: {
            [PROTOTYPE_PROPS.tier]: tier,
            [PROTOTYPE_PROPS.prompt]: body.prompt.trim(),
            [CREDENTIAL_REF_PROP]: resolved.credentialRef,
          },
        },
      },
    });
    return {
      status: 200,
      body: {
        delegated: false,
        itemId: targetId,
        versionId,
        tier,
        model,
        credentialRef: resolved.credentialRef,
      } satisfies PrototypeBuiltResponse,
    };
  }

  const itemId = newItemId();
  const title = body.title?.trim() || body.prompt.trim().slice(0, 64);
  await host.submit({
    canvasId: req.canvasId,
    actor,
    op: {
      type: "item.add",
      itemId,
      title,
      width: 640,
      height: 480,
      placement: { x: 0, y: 0 },
      version: {
        id: versionId,
        blobHash: blob.blobHash,
        mimeType: "text/html",
        filename,
        size: blob.size,
      },
      properties: {
        [PROTOTYPE_PROPS.tier]: tier,
        [PROTOTYPE_PROPS.prompt]: body.prompt.trim(),
        [CREDENTIAL_REF_PROP]: resolved.credentialRef,
      },
    },
  });

  return {
    status: 200,
    body: {
      delegated: false,
      itemId,
      versionId,
      tier,
      model,
      credentialRef: resolved.credentialRef,
    } satisfies PrototypeBuiltResponse,
  };
}

export const prototypeServer: ServerModule = {
  name: "@isocan/prototype",
  routes: [
    {
      method: "POST",
      path: "build",
      spend: "owner",
      provider: "gemini",
      rate: { perMinute: BUILD_PER_MINUTE },
      bodyLimit: 32 * 1024,
      says: {
        badRequest: { code: BAD_REQUEST, error: "a prototype build names `canvasId` and `prompt`" },
        ownerOnly: OWNER_ONLY,
        unavailable: { code: UNAVAILABLE, error: "this home has no Gemini key" },
        rateLimited: { code: RATE_LIMITED, error: "prototype build rate limit reached — wait a moment" },
      },
      check: checkBuild,
      handler: handleBuild,
    },
  ],
};

export default prototypeServer;
