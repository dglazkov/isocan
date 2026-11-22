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
  DESIGN_PROPS,
  DESIGN_SYSTEM_MIME,
  compileDesignMd,
  parseDesignSystemSpec,
  summarizeTokens,
  type DesignCritiqueRequest,
  type DesignCritiqueResponse,
  type DesignMockupsRequest,
  type DesignMockupsResponse,
  type DesignSystemRequest,
  type DesignSystemResponse,
  type DesignSystemSpec,
} from "./core.ts";

const SYSTEM_PER_MINUTE = 12;
const CRITIQUE_PER_MINUTE = 20;
const MOCKUPS_PER_MINUTE = 10;

const BAD_REQUEST = "design-system-bad-request";
const OWNER_ONLY = "design-system-owner-only";
const UNAVAILABLE = "design-system-unavailable";
const RATE_LIMITED = "design-system-rate-limited";
const UPSTREAM = "design-system-upstream";

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

function extractGeminiText(payload: GeminiGenerateResponse): string {
  const parts = payload.candidates?.[0]?.content?.parts ?? [];
  return parts
    .filter((p) => !p.thought && typeof p.text === "string")
    .map((p) => p.text as string)
    .join("")
    .trim();
}

function stripJsonFences(raw: string): string {
  const match = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw);
  return (match ? match[1]! : raw).trim();
}

async function resolveActor(actor: Actor | undefined, host: ServerHost): Promise<Actor | null> {
  if (actor) {
    await host.speaksFor(actor.id);
    return { id: actor.id, name: actor.name };
  }
  return (await host.defaultActor?.()) ?? null;
}

async function callGemini(
  host: ServerHost,
  model: string,
  key: string,
  parts: Array<Record<string, unknown>>,
): Promise<{ ok: true; text: string } | { ok: false; response: ModuleResponse }> {
  const scrub = (s: string) => s.split(key).join("[key]");
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
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
    const raw = await res.text();
    if (!res.ok) {
      let said = raw.slice(0, 300);
      try {
        const parsed = JSON.parse(raw) as GeminiGenerateResponse;
        if (typeof parsed.error?.message === "string" && parsed.error.message) {
          said = parsed.error.message;
        }
      } catch {
        // non-JSON upstream response
      }
      return {
        ok: false,
        response: {
          status: 502,
          body: { error: scrub(`Gemini refused the design-system request (${res.status}): ${said}`), code: UPSTREAM },
        },
      };
    }
    const parsed = JSON.parse(raw) as GeminiGenerateResponse;
    const text = scrub(extractGeminiText(parsed));
    if (!text) {
      return {
        ok: false,
        response: { status: 502, body: { error: "Gemini returned an empty response", code: UPSTREAM } },
      };
    }
    return { ok: true, text };
  } catch (err) {
    return {
      ok: false,
      response: {
        status: 502,
        body: {
          error: scrub(`Gemini request failed: ${err instanceof Error ? err.message : String(err)}`),
          code: UPSTREAM,
        },
      },
    };
  }
}

function checkSystem({ body: raw }: { body: unknown }): ModuleResponse | null {
  const body = raw as Partial<DesignSystemRequest> | null;
  const bad = (error: string): ModuleResponse => ({ status: 400, body: { error, code: BAD_REQUEST } });
  if (!body || typeof body !== "object") return bad("request body must be a JSON object");
  if (typeof body.canvasId !== "string" || !body.canvasId.trim()) return bad("`canvasId` is required");
  if (typeof body.prompt !== "string" || !body.prompt.trim()) return bad("`prompt` is required");
  return null;
}

async function handleSystem(req: ModuleRequest, host: ServerHost): Promise<ModuleResponse> {
  const body = req.body as DesignSystemRequest;
  const resolved = await host.resolveKey("gemini");
  if (!resolved) {
    return { status: 503, body: { error: "this home has no Gemini key", code: UNAVAILABLE } };
  }
  const actor = await resolveActor(body.actor, host);
  if (!actor) {
    return { status: 400, body: { error: "an actor is required to create a design system", code: BAD_REQUEST } };
  }

  const model = modelOf(host);
  const prompt = [
    "Generate a concise design system specification as strict JSON (no prose outside JSON).",
    'Schema: {"name": string, "summary": string, "palette": [{"name": string, "hex": "#RRGGBB", "usage": string}], "typography": [{"role": string, "family": string, "size": string, "weight": string}], "spacing": string[], "radii": string[], "principles": string[]}.',
    `Brief: ${body.prompt.trim()}`,
  ].join("\n");

  const answer = await callGemini(host, model, resolved.key, [{ text: prompt }]);
  if (!answer.ok) return answer.response;

  const parsed = parseDesignSystemSpec(stripJsonFences(answer.text));
  const spec: DesignSystemSpec = parsed ?? {
    name: body.title?.trim() || "Design System",
    summary: body.prompt.trim(),
    palette: [
      { name: "Primary", hex: "#1F2937", usage: "Primary text and anchors" },
      { name: "Surface", hex: "#F9FAFB", usage: "Canvas background" },
      { name: "Accent", hex: "#2563EB", usage: "Interactive actions" },
    ],
    typography: [
      { role: "Display", family: "Inter, system-ui, sans-serif", size: "32px", weight: "700" },
      { role: "Body", family: "Inter, system-ui, sans-serif", size: "15px", weight: "400" },
    ],
    spacing: ["4px", "8px", "16px", "24px", "40px"],
    radii: ["4px", "8px", "16px"],
    principles: ["Clear hierarchy", "Generous whitespace"],
  };
  if (body.title?.trim()) spec.name = body.title.trim();

  const designMd = compileDesignMd(spec);
  const specBytes = new TextEncoder().encode(JSON.stringify(spec, null, 2) + "\n");
  const mdBytes = new TextEncoder().encode(designMd);

  const [specBlob, mdBlob] = await Promise.all([
    host.putBlob(req.canvasId, specBytes, { mimeType: DESIGN_SYSTEM_MIME, filename: "design-system.design-system.json" }),
    host.putBlob(req.canvasId, mdBytes, { mimeType: "text/markdown", filename: "DESIGN.md" }),
  ]);

  const systemItemId = newItemId();
  const designMdItemId = newItemId();
  const group = newOpId();
  const tokenSummary = summarizeTokens(spec);

  await host.submit({
    canvasId: req.canvasId,
    actor,
    group,
    op: {
      type: "item.add",
      itemId: systemItemId,
      title: spec.name,
      width: 440,
      height: 360,
      placement: { x: 0, y: 0 },
      version: {
        id: newVersionId(),
        blobHash: specBlob.blobHash,
        mimeType: DESIGN_SYSTEM_MIME,
        filename: "design-system.design-system.json",
        size: specBlob.size,
      },
      properties: {
        [DESIGN_PROPS.role]: "system",
        [DESIGN_PROPS.tokens]: tokenSummary,
        [CREDENTIAL_REF_PROP]: resolved.credentialRef,
      },
    },
  });

  await host.submit({
    canvasId: req.canvasId,
    actor,
    group,
    op: {
      type: "item.add",
      itemId: designMdItemId,
      title: `${spec.name} — DESIGN.md`,
      width: 480,
      height: 420,
      placement: { anchorItemId: systemItemId },
      version: {
        id: newVersionId(),
        blobHash: mdBlob.blobHash,
        mimeType: "text/markdown",
        filename: "DESIGN.md",
        size: mdBlob.size,
      },
      properties: {
        [DESIGN_PROPS.role]: "design-md",
        [DESIGN_PROPS.tokens]: tokenSummary,
        parent: systemItemId,
        [CREDENTIAL_REF_PROP]: resolved.credentialRef,
      },
    },
  });

  return {
    status: 200,
    body: {
      systemItemId,
      designMdItemId,
      spec,
      designMd,
      model,
      credentialRef: resolved.credentialRef,
    } satisfies DesignSystemResponse,
  };
}

function checkCritique({ body: raw }: { body: unknown }): ModuleResponse | null {
  const body = raw as Partial<DesignCritiqueRequest> | null;
  const bad = (error: string): ModuleResponse => ({ status: 400, body: { error, code: BAD_REQUEST } });
  if (!body || typeof body !== "object") return bad("request body must be a JSON object");
  if (typeof body.canvasId !== "string" || !body.canvasId.trim()) return bad("`canvasId` is required");
  if (typeof body.itemId !== "string" || !body.itemId.trim()) return bad("`itemId` is required");
  return null;
}

async function handleCritique(req: ModuleRequest, host: ServerHost): Promise<ModuleResponse> {
  const body = req.body as DesignCritiqueRequest;
  const resolved = await host.resolveKey("gemini");
  if (!resolved) {
    return { status: 503, body: { error: "this home has no Gemini key", code: UNAVAILABLE } };
  }
  const actor = await resolveActor(body.actor, host);
  if (!actor) {
    return { status: 400, body: { error: "an actor is required to post a critique", code: BAD_REQUEST } };
  }

  const snapshot = await host.canvas(req.canvasId);
  const target = snapshot.canvas.items[body.itemId.trim()];
  if (!target) {
    return { status: 404, body: { error: `item not found: ${body.itemId}`, code: BAD_REQUEST } };
  }
  const version = target.versions.find((v) => v.id === target.currentVersionId) ?? target.versions.at(-1);
  if (!version) {
    return { status: 400, body: { error: `item ${target.id} has no version bytes`, code: BAD_REQUEST } };
  }
  const bytes = await host.readBlob(req.canvasId, version.blobHash);
  if (!bytes) {
    return { status: 404, body: { error: `blob ${version.blobHash} not found`, code: BAD_REQUEST } };
  }

  let systemContext = "";
  if (body.systemItemId?.trim()) {
    const sys = snapshot.canvas.items[body.systemItemId.trim()];
    const sysVer = sys?.versions.find((v) => v.id === sys.currentVersionId) ?? sys?.versions.at(-1);
    const sysBytes = sysVer ? await host.readBlob(req.canvasId, sysVer.blobHash) : null;
    if (sysBytes) {
      systemContext = `\n\nDesign system reference:\n${Buffer.from(sysBytes).toString("utf8").slice(0, 6000)}`;
    }
  }

  const parts: Array<Record<string, unknown>> = [
    {
      text:
        `Conduct a fresh-context design critique of "${target.title}" (${version.mimeType}). ` +
        `Respond in concise Markdown with sections: ## Summary, ## Strengths, ## Issues, and ## Concrete Fixes.${systemContext}`,
    },
  ];

  if (version.mimeType.startsWith("image/") && version.mimeType !== "image/svg+xml") {
    parts.push({
      inlineData: {
        mimeType: version.mimeType,
        data: Buffer.from(bytes).toString("base64"),
      },
    });
  } else {
    const excerpt = Buffer.from(bytes).toString("utf8").slice(0, 16_000);
    parts.push({ text: `\n\n--- Target (${version.filename}) ---\n${excerpt}` });
  }

  const model = modelOf(host);
  const answer = await callGemini(host, model, resolved.key, parts);
  if (!answer.ok) return answer.response;

  const critiqueMd = answer.text.endsWith("\n") ? answer.text : `${answer.text}\n`;
  const blob = await host.putBlob(req.canvasId, new TextEncoder().encode(critiqueMd), {
    mimeType: "text/markdown",
    filename: `critique-${target.id}.md`,
  });
  const reviewItemId = newItemId();
  await host.submit({
    canvasId: req.canvasId,
    actor,
    op: {
      type: "item.add",
      itemId: reviewItemId,
      title: `Critique: ${target.title}`,
      width: 440,
      height: 360,
      placement: { anchorItemId: target.id },
      version: {
        id: newVersionId(),
        blobHash: blob.blobHash,
        mimeType: "text/markdown",
        filename: `critique-${target.id}.md`,
        size: blob.size,
      },
      properties: {
        [DESIGN_PROPS.role]: "critique",
        parent: target.id,
        [CREDENTIAL_REF_PROP]: resolved.credentialRef,
      },
    },
  });

  return {
    status: 200,
    body: {
      reviewItemId,
      targetItemId: target.id,
      critique: critiqueMd,
      model,
      credentialRef: resolved.credentialRef,
    } satisfies DesignCritiqueResponse,
  };
}

function checkMockups({ body: raw }: { body: unknown }): ModuleResponse | null {
  const body = raw as Partial<DesignMockupsRequest> | null;
  const bad = (error: string): ModuleResponse => ({ status: 400, body: { error, code: BAD_REQUEST } });
  if (!body || typeof body !== "object") return bad("request body must be a JSON object");
  if (typeof body.canvasId !== "string" || !body.canvasId.trim()) return bad("`canvasId` is required");
  if (typeof body.systemItemId !== "string" || !body.systemItemId.trim()) return bad("`systemItemId` is required");
  if (body.count !== undefined && (typeof body.count !== "number" || body.count < 2 || body.count > 4)) {
    return bad("`count` must be between 2 and 4");
  }
  return null;
}

async function handleMockups(req: ModuleRequest, host: ServerHost): Promise<ModuleResponse> {
  const body = req.body as DesignMockupsRequest;
  const resolved = await host.resolveKey("gemini");
  if (!resolved) {
    return { status: 503, body: { error: "this home has no Gemini key", code: UNAVAILABLE } };
  }
  const actor = await resolveActor(body.actor, host);
  if (!actor) {
    return { status: 400, body: { error: "an actor is required to create mockups", code: BAD_REQUEST } };
  }

  const snapshot = await host.canvas(req.canvasId);
  const systemItem = snapshot.canvas.items[body.systemItemId.trim()];
  if (!systemItem) {
    return { status: 404, body: { error: `design system item not found: ${body.systemItemId}`, code: BAD_REQUEST } };
  }
  const sysVer = systemItem.versions.find((v) => v.id === systemItem.currentVersionId) ?? systemItem.versions.at(-1);
  const sysBytes = sysVer ? await host.readBlob(req.canvasId, sysVer.blobHash) : null;
  const sysText = sysBytes ? Buffer.from(sysBytes).toString("utf8").slice(0, 6000) : systemItem.title;

  const count = Math.max(2, Math.min(4, Math.floor(body.count ?? 3)));
  const model = modelOf(host);
  const prompt = [
    `Generate ${count} distinct UI direction mockups adhering to this design system.`,
    'Respond with strict JSON: {"directions": [{"title": string, "html": "<!doctype html>..."}]} where each html is self-contained.',
    body.prompt?.trim() ? `Goal: ${body.prompt.trim()}` : `Goal: Showcase ${systemItem.title}`,
    `Design system:\n${sysText}`,
  ].join("\n");

  const answer = await callGemini(host, model, resolved.key, [{ text: prompt }]);
  if (!answer.ok) return answer.response;

  let parsedDirections: Array<{ title: string; html: string }> = [];
  try {
    const parsed = JSON.parse(stripJsonFences(answer.text)) as {
      directions?: Array<{ title?: unknown; html?: unknown }>;
    };
    if (Array.isArray(parsed.directions)) {
      parsedDirections = parsed.directions
        .filter((d): d is { title: string; html: string } => typeof d?.title === "string" && typeof d?.html === "string")
        .slice(0, count);
    }
  } catch {
    // Fall back to deterministic placeholders carrying the model text below.
  }

  while (parsedDirections.length < count) {
    const idx = parsedDirections.length + 1;
    parsedDirections.push({
      title: `${systemItem.title} — Direction ${idx}`,
      html: `<!doctype html><html><body style="font-family:system-ui;padding:24px"><h1>${systemItem.title} — Direction ${idx}</h1><p>${body.prompt?.trim() || "Direction exploration"}</p></body></html>`,
    });
  }

  const group = newOpId();
  const mockupItemIds: string[] = [];
  const directions: string[] = [];
  let prevAnchor = systemItem.id;

  for (let i = 0; i < parsedDirections.length; i++) {
    const dir = parsedDirections[i]!;
    const filename = `mockup-${i + 1}.html`;
    const blob = await host.putBlob(req.canvasId, new TextEncoder().encode(dir.html), {
      mimeType: "text/html",
      filename,
    });
    const itemId = newItemId();
    await host.submit({
      canvasId: req.canvasId,
      actor,
      group,
      op: {
        type: "item.add",
        itemId,
        title: dir.title,
        width: 480,
        height: 360,
        placement: { anchorItemId: prevAnchor },
        version: {
          id: newVersionId(),
          blobHash: blob.blobHash,
          mimeType: "text/html",
          filename,
          size: blob.size,
        },
        properties: {
          [DESIGN_PROPS.role]: "mockup",
          parent: systemItem.id,
          [CREDENTIAL_REF_PROP]: resolved.credentialRef,
        },
      },
    });
    mockupItemIds.push(itemId);
    directions.push(dir.title);
    prevAnchor = itemId;
  }

  return {
    status: 200,
    body: {
      systemItemId: systemItem.id,
      mockupItemIds,
      directions,
      model,
      credentialRef: resolved.credentialRef,
    } satisfies DesignMockupsResponse,
  };
}

export const designSystemServer: ServerModule = {
  name: "@isocan/design-system",
  routes: [
    {
      method: "POST",
      path: "system",
      spend: "owner",
      provider: "gemini",
      rate: { perMinute: SYSTEM_PER_MINUTE },
      bodyLimit: 32 * 1024,
      says: {
        badRequest: { code: BAD_REQUEST, error: "a design-system request names `canvasId` and `prompt`" },
        ownerOnly: OWNER_ONLY,
        unavailable: { code: UNAVAILABLE, error: "this home has no Gemini key" },
        rateLimited: { code: RATE_LIMITED, error: "design-system rate limit reached — wait a moment" },
      },
      check: checkSystem,
      handler: handleSystem,
    },
    {
      method: "POST",
      path: "critique",
      spend: "owner",
      provider: "gemini",
      rate: { perMinute: CRITIQUE_PER_MINUTE },
      bodyLimit: 32 * 1024,
      says: {
        badRequest: { code: BAD_REQUEST, error: "a critique request names `canvasId` and `itemId`" },
        ownerOnly: OWNER_ONLY,
        unavailable: { code: UNAVAILABLE, error: "this home has no Gemini key" },
        rateLimited: { code: RATE_LIMITED, error: "critique rate limit reached — wait a moment" },
      },
      check: checkCritique,
      handler: handleCritique,
    },
    {
      method: "POST",
      path: "mockups",
      spend: "owner",
      provider: "gemini",
      rate: { perMinute: MOCKUPS_PER_MINUTE },
      bodyLimit: 32 * 1024,
      says: {
        badRequest: { code: BAD_REQUEST, error: "a mockups request names `canvasId` and `systemItemId`" },
        ownerOnly: OWNER_ONLY,
        unavailable: { code: UNAVAILABLE, error: "this home has no Gemini key" },
        rateLimited: { code: RATE_LIMITED, error: "mockups rate limit reached — wait a moment" },
      },
      check: checkMockups,
      handler: handleMockups,
    },
  ],
};

export default designSystemServer;
