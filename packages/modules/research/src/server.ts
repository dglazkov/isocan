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

import type {
  Actor,
  JobHost,
  JobPollResult,
  JobPollState,
  JobStartInput,
  JobStartResult,
  ModuleRequest,
  ModuleResponse,
  ServerHost,
  ServerJobRunner,
  ServerModule,
} from "@isocan/core";
import { CREDENTIAL_REF_PROP } from "@isocan/core/keys";
import { bareModelId, modelFor } from "@isocan/core/models";
import {
  RESEARCH_JOB_KIND,
  RESEARCH_PROPS,
  formatResearchMarkdown,
  researchFilename,
  validateResearchQuery,
  type ResearchRunRequest,
  type ResearchRunResponse,
  type ResearchSource,
} from "./core.ts";

/**
 * **Research's server half: `POST /api/m/research/run` + home-polled `research` job runner**
 * (Open Stitch phase 3).
 *
 * Starts a durable home-polled grounded research job on a placeholder Markdown
 * item immediately (HTTP 202). The home polls Gemini in the background and
 * lands the cited Markdown report with source links as a new version on the
 * item (`item.addVersion`). Every error path scrubs key material.
 */

const RESEARCH_RUNS_PER_MINUTE = 10;
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

const RESEARCH_BAD_REQUEST = "research-bad-request";
const RESEARCH_OWNER_ONLY = "research-owner-only";
const RESEARCH_UNAVAILABLE = "research-unavailable";
const RESEARCH_RATE_LIMITED = "research-rate-limited";

interface StoredResearchJobRequest {
  query: string;
  deep: boolean;
}

function scrubKey(text: string, key: string): string {
  return key ? text.split(key).join("[key]") : text;
}

function extractErrorMessage(raw: string): string {
  let said = raw.slice(0, 300);
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: unknown }; message?: unknown };
    if (typeof parsed.error?.message === "string" && parsed.error.message) said = parsed.error.message;
    else if (typeof parsed.message === "string" && parsed.message) said = parsed.message;
  } catch {
    // plain text upstream error
  }
  return said;
}

function parseStoredRequest(raw: unknown): StoredResearchJobRequest {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Partial<StoredResearchJobRequest>;
  return {
    query: typeof obj.query === "string" ? obj.query : "",
    deep: obj.deep === true,
  };
}

function extractSources(payload: Record<string, unknown>): ResearchSource[] {
  const seen = new Set<string>();
  const out: ResearchSource[] = [];
  const push = (url: unknown, title?: unknown) => {
    if (typeof url !== "string" || !url.trim()) return;
    const cleanUrl = url.trim();
    if (seen.has(cleanUrl)) return;
    seen.add(cleanUrl);
    const cleanTitle = typeof title === "string" && title.trim() ? title.trim() : cleanUrl;
    out.push({ title: cleanTitle, url: cleanUrl });
  };

  if (Array.isArray(payload.sources)) {
    for (const s of payload.sources) {
      if (s && typeof s === "object") {
        const rec = s as { url?: unknown; uri?: unknown; title?: unknown };
        push(rec.url ?? rec.uri, rec.title);
      }
    }
  }

  const grounding = payload.groundingMetadata as {
    groundingChunks?: Array<{ web?: { uri?: unknown; title?: unknown } }>;
  } | undefined;
  for (const chunk of grounding?.groundingChunks ?? []) {
    push(chunk?.web?.uri, chunk?.web?.title);
  }

  const candidates = payload.candidates as Array<{
    groundingMetadata?: {
      groundingChunks?: Array<{ web?: { uri?: unknown; title?: unknown } }>;
    };
  }> | undefined;
  for (const cand of candidates ?? []) {
    for (const chunk of cand?.groundingMetadata?.groundingChunks ?? []) {
      push(chunk?.web?.uri, chunk?.web?.title);
    }
  }

  if (Array.isArray(payload.outputs)) {
    for (const o of payload.outputs) {
      if (o && typeof o === "object") {
        const rec = o as { sources?: Array<{ url?: unknown; uri?: unknown; title?: unknown }> };
        for (const s of rec.sources ?? []) {
          push(s.url ?? s.uri, s.title);
        }
      }
    }
  }

  return out;
}

function extractReportText(payload: Record<string, unknown>): string {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }
  const chunks: string[] = [];
  if (Array.isArray(payload.outputs)) {
    for (const o of payload.outputs) {
      if (o && typeof o === "object") {
        const rec = o as { type?: unknown; text?: unknown };
        if ((rec.type === undefined || rec.type === "text") && typeof rec.text === "string" && rec.text.trim()) {
          chunks.push(rec.text.trim());
        }
      }
    }
  }
  if (chunks.length > 0) return chunks.join("\n\n");

  const candidates = payload.candidates as Array<{
    content?: { parts?: Array<{ text?: unknown; thought?: unknown }> };
  }> | undefined;
  const parts = candidates?.[0]?.content?.parts ?? [];
  return parts
    .filter((p) => !p.thought && typeof p.text === "string")
    .map((p) => p.text as string)
    .join("")
    .trim();
}

function progressFromPayload(payload: Record<string, unknown>): string | undefined {
  const meta = payload.metadata as Record<string, unknown> | undefined;
  if (meta && typeof meta === "object") {
    if (typeof meta.progress === "string" && meta.progress.trim()) return meta.progress.trim();
    if (typeof meta.stage === "string" && meta.stage.trim()) return meta.stage.trim();
  }
  if (typeof payload.progress === "string" && payload.progress.trim()) return payload.progress.trim();
  if (typeof payload.status === "string" && payload.status.trim() && payload.status !== "in_progress") {
    return payload.status.trim();
  }
  return undefined;
}

/**
 * **Home-polled async job runner for `kind: "research"`** (Phase 0.2 `ServerJobRunner`).
 */
export const researchJobRunner: ServerJobRunner = {
  async start(req: JobStartInput, host: JobHost): Promise<JobStartResult> {
    const key = await host.keyFor("gemini");
    if (!key) {
      throw new Error("this home has no Gemini key — cannot start research job");
    }
    const stored = parseStoredRequest(req.request);
    if (!stored.query) {
      throw new Error("research job is missing a query");
    }
    const model = bareModelId(req.model || modelFor("utility", { env: process.env }).id).replace(/^models\//, "");

    try {
      const res = await host.fetch(`${GEMINI_API_BASE}/interactions`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          model,
          input: [
            {
              type: "text",
              text: stored.deep
                ? `Conduct a thorough, well-cited research brief on: ${stored.query}`
                : `Research and summarize with citations: ${stored.query}`,
            },
          ],
          tools: [{ type: "google_search" }],
          background: true,
          ...(stored.deep ? { deep: true } : {}),
        }),
      });
      const text = await res.text();
      if (!res.ok) {
        throw new Error(scrubKey(`Gemini research start failed (${res.status}): ${extractErrorMessage(text)}`, key));
      }
      const payload = JSON.parse(text) as Record<string, unknown>;
      if (payload.status === "completed" || payload.done === true) {
        const report = extractReportText(payload);
        if (!report) throw new Error("research provider completed without report text");
        const sources = extractSources(payload);
        const markdown = formatResearchMarkdown(stored.query, report, sources);
        return {
          immediate: {
            bytes: new TextEncoder().encode(markdown),
            mimeType: "text/markdown",
            filename: researchFilename(stored.query),
          },
        };
      }
      const rawId =
        typeof payload.id === "string" && payload.id
          ? payload.id
          : typeof payload.name === "string"
            ? payload.name
            : "";
      if (!rawId) {
        throw new Error("Gemini research did not return an interaction id");
      }
      const externalId =
        rawId.startsWith("interactions/") || rawId.includes("/operations/")
          ? rawId
          : `interactions/${rawId}`;
      return { externalId };
    } catch (err) {
      throw new Error(scrubKey(err instanceof Error ? err.message : String(err), key));
    }
  },

  async poll(state: JobPollState, host: JobHost): Promise<JobPollResult> {
    const key = await host.keyFor("gemini");
    if (!key) {
      return { failed: "this home has no Gemini key — cannot poll research job" };
    }
    if (!state.externalId) {
      return { failed: "research job is missing its provider interaction id" };
    }
    const stored = parseStoredRequest(state.request);
    const opPath = state.externalId.replace(/^\/+/, "");
    const url = /^https?:\/\//.test(opPath) ? opPath : `${GEMINI_API_BASE}/${opPath}`;

    try {
      const res = await host.fetch(url, {
        method: "GET",
        headers: { "x-goog-api-key": key },
      });
      const text = await res.text();
      if (!res.ok) {
        return { failed: scrubKey(`research poll failed (${res.status}): ${extractErrorMessage(text)}`, key) };
      }
      const payload = JSON.parse(text) as Record<string, unknown>;

      if (payload.error && typeof payload.error === "object") {
        const msg = (payload.error as { message?: unknown }).message;
        return { failed: scrubKey(typeof msg === "string" && msg ? msg : "research job failed", key) };
      }

      const status = typeof payload.status === "string" ? payload.status : "";
      if (status === "failed" || status === "cancelled") {
        return { failed: scrubKey(`research ${status}: ${extractErrorMessage(text)}`, key) };
      }
      if (status !== "completed" && payload.done !== true) {
        const progress = progressFromPayload(payload);
        return progress ? { done: false, progress } : { done: false };
      }

      const report = extractReportText(payload);
      if (!report) {
        return { failed: "research provider finished without report text" };
      }
      const sources = extractSources(payload);
      const markdown = formatResearchMarkdown(stored.query || "Research Report", report, sources);
      return {
        done: true,
        bytes: new TextEncoder().encode(markdown),
        mimeType: "text/markdown",
        filename: researchFilename(stored.query || "research"),
      };
    } catch (err) {
      return { failed: scrubKey(`research poll error: ${err instanceof Error ? err.message : String(err)}`, key) };
    }
  },

  async abandon(state: JobPollState, host: JobHost): Promise<void> {
    if (!state.externalId) return;
    const key = await host.keyFor("gemini");
    if (!key) return;
    const opPath = state.externalId.replace(/^\/+/, "");
    const cancelUrl = /^https?:\/\//.test(opPath)
      ? `${opPath}:cancel`
      : `${GEMINI_API_BASE}/${opPath}:cancel`;
    try {
      await host.fetch(cancelUrl, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: "{}",
      });
    } catch {
      // Best-effort cancellation; abandoning locally always succeeds.
    }
  },
};

function checkRun({ body: raw }: { body: unknown }): ModuleResponse | null {
  const body = raw as Partial<ResearchRunRequest> | null;
  const bad = (error: string): ModuleResponse => ({ status: 400, body: { error, code: RESEARCH_BAD_REQUEST } });
  if (!body || typeof body !== "object") {
    return bad("a research request must be a JSON object naming `canvasId` and `query`");
  }
  if (typeof body.canvasId !== "string" || !body.canvasId.trim()) {
    return bad("a research request names the canvas it is for (`canvasId`)");
  }
  const queryCheck = validateResearchQuery(body.query);
  if (!queryCheck.ok) return bad(queryCheck.error);
  if (body.deep !== undefined && typeof body.deep !== "boolean") {
    return bad("when supplied, `deep` must be a boolean");
  }
  if (body.model !== undefined && (typeof body.model !== "string" || !body.model.trim())) {
    return bad("when supplied, `model` must be a non-empty model id");
  }
  if (body.actor !== undefined) {
    const a = body.actor;
    if (!a || typeof a !== "object" || typeof a.id !== "string" || !a.id || typeof a.name !== "string") {
      return bad("when supplied, `actor` must carry non-empty `id` and string `name`");
    }
  }
  return null;
}

async function resolveActor(actor: Actor | undefined, host: ServerHost): Promise<Actor | null> {
  if (actor) {
    await host.speaksFor(actor.id);
    return { id: actor.id, name: actor.name };
  }
  return (await host.defaultActor?.()) ?? null;
}

function defaultModelOf(host: ServerHost, explicit?: string): string {
  if (explicit?.trim()) return bareModelId(explicit.trim());
  const seam = host.options.model;
  if (typeof seam === "string" && seam.trim()) return bareModelId(seam.trim());
  return bareModelId(modelFor("utility", { env: process.env }).id);
}

async function runResearch(req: ModuleRequest, host: ServerHost): Promise<ModuleResponse> {
  const body = req.body as ResearchRunRequest;
  const { canvasId } = req;
  const queryCheck = validateResearchQuery(body.query);
  if (!queryCheck.ok) {
    return { status: 400, body: { error: queryCheck.error, code: RESEARCH_BAD_REQUEST } };
  }
  const query = queryCheck.query;
  const deep = body.deep === true;

  const resolved = await host.resolveKey("gemini");
  if (!resolved) {
    return {
      status: 503,
      body: {
        error: "this home has no Gemini key — research jobs cannot start here (`isocan keys set gemini`)",
        code: RESEARCH_UNAVAILABLE,
      },
    };
  }

  const actor = await resolveActor(body.actor, host);
  if (!actor) {
    return {
      status: 400,
      body: {
        error: "an actor is required to start a research job — claim an identity or pass `actor` in the body",
        code: RESEARCH_BAD_REQUEST,
      },
    };
  }

  const model = defaultModelOf(host, body.model);
  const title = query.length > 64 ? `${query.slice(0, 61)}…` : query;
  const placeholderText = `# Researching\n\nQuery: ${query}\nMode: ${deep ? "deep" : "standard"}\nModel: ${model}\n`;
  const properties: Record<string, string> = {
    [RESEARCH_PROPS.query]: query,
    [RESEARCH_PROPS.deep]: deep ? "true" : "false",
    [CREDENTIAL_REF_PROP]: resolved.credentialRef,
  };

  const job = await host.startJob({
    canvasId,
    actor,
    spec: {
      kind: RESEARCH_JOB_KIND,
      provider: "gemini",
      model,
      request: { query, deep } satisfies StoredResearchJobRequest,
      title,
      width: 560,
      height: 420,
      placeholder: {
        bytes: new TextEncoder().encode(placeholderText),
        mimeType: "text/markdown",
        filename: "research-running.md",
      },
      properties,
    },
  });

  return {
    status: 202,
    body: {
      job,
      itemId: job.itemId,
    } satisfies ResearchRunResponse,
  };
}

export const researchServer: ServerModule = {
  name: "@isocan/research",
  jobs: {
    [RESEARCH_JOB_KIND]: researchJobRunner,
  },
  routes: [
    {
      method: "POST",
      path: "run",
      spend: "owner",
      provider: "gemini",
      rate: { perMinute: RESEARCH_RUNS_PER_MINUTE },
      bodyLimit: 16 * 1024,
      says: {
        badRequest: { code: RESEARCH_BAD_REQUEST, error: "a research request names `canvasId` and `query`" },
        ownerOnly: RESEARCH_OWNER_ONLY,
        unavailable: {
          code: RESEARCH_UNAVAILABLE,
          error: "this home has no Gemini key — research can't start here (`isocan keys set gemini`, or Model keys…, on the machine that holds this canvas)",
        },
        rateLimited: {
          code: RESEARCH_RATE_LIMITED,
          error: "this badge has started enough research jobs this minute — wait a moment and ask again",
        },
      },
      check: checkRun,
      handler: runResearch,
    },
  ],
};

export default researchServer;
