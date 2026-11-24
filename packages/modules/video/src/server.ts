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
  isOmniVideoModel,
  validateVideoAspectRatio,
  validateVideoDuration,
  validateVideoPrompt,
  VIDEO_JOB_KIND,
  VIDEO_PROPS,
  videoFilename,
  type VideoAspectRatio,
  type VideoDuration,
  type VideoGenerateRequest,
  type VideoGenerateResponse,
} from "./core.ts";

/**
 * **Video's server half: `POST /api/m/video/generate` + home-polled `video` job runner**
 * (Open Stitch phase 3).
 *
 * Starts a durable home-polled job on a placeholder item immediately (HTTP 202).
 * The home polls Veo (`predictLongRunning`) or Gemini Omni (`interactions`) in
 * the background — never the browser tab — and lands the finished MP4 bytes as
 * a new version on the item (`item.addVersion`). Retry re-runs the stored
 * request on the same item, optionally with another `--model`.
 */

const VIDEO_GENERATES_PER_MINUTE = 6;
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

const VIDEO_BAD_REQUEST = "video-bad-request";
const VIDEO_OWNER_ONLY = "video-owner-only";
const VIDEO_UNAVAILABLE = "video-unavailable";
const VIDEO_RATE_LIMITED = "video-rate-limited";

/** Durable request payload serialized into `job.request` on the canvas item. */
interface StoredVideoJobRequest {
  prompt: string;
  fromItem?: string;
  sourceBlobHash?: string;
  sourceMimeType?: string;
  durationSeconds?: VideoDuration;
  aspectRatio?: VideoAspectRatio;
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

function parseStoredRequest(raw: unknown): StoredVideoJobRequest {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Partial<StoredVideoJobRequest>;
  return {
    prompt: typeof obj.prompt === "string" ? obj.prompt : "",
    ...(typeof obj.fromItem === "string" && obj.fromItem ? { fromItem: obj.fromItem } : {}),
    ...(typeof obj.sourceBlobHash === "string" && obj.sourceBlobHash ? { sourceBlobHash: obj.sourceBlobHash } : {}),
    ...(typeof obj.sourceMimeType === "string" && obj.sourceMimeType ? { sourceMimeType: obj.sourceMimeType } : {}),
    ...(typeof obj.durationSeconds === "number" ? { durationSeconds: obj.durationSeconds } : {}),
    ...(typeof obj.aspectRatio === "string" ? { aspectRatio: obj.aspectRatio } : {}),
  };
}

interface ExtractedVideo {
  uri?: string;
  base64?: string;
  mimeType: string;
}

function extractVideoFromPayload(payload: Record<string, unknown>): ExtractedVideo | null {
  const response = (payload.response && typeof payload.response === "object"
    ? payload.response
    : payload) as Record<string, unknown>;

  // Veo predictLongRunning response shapes:
  // 1) response.generateVideoResponse.generatedSamples[0].video
  // 2) response.generatedVideos[0].video
  // 3) response.videos[0]
  const genVideoResp = response.generateVideoResponse as { generatedSamples?: Array<{ video?: Record<string, unknown> }> } | undefined;
  const candidates: Array<Record<string, unknown> | undefined> = [
    genVideoResp?.generatedSamples?.[0]?.video,
    (response.generatedVideos as Array<{ video?: Record<string, unknown> }> | undefined)?.[0]?.video,
    (response.videos as Array<Record<string, unknown>> | undefined)?.[0],
  ];

  for (const vid of candidates) {
    if (!vid || typeof vid !== "object") continue;
    const mimeType = typeof vid.mimeType === "string" && vid.mimeType ? vid.mimeType : "video/mp4";
    if (typeof vid.bytesBase64Encoded === "string" && vid.bytesBase64Encoded) {
      return { base64: vid.bytesBase64Encoded, mimeType };
    }
    if (typeof vid.data === "string" && vid.data) {
      return { base64: vid.data, mimeType };
    }
    if (typeof vid.uri === "string" && vid.uri) {
      return { uri: vid.uri, mimeType };
    }
  }

  // Omni Interactions API response shapes: outputs[] or steps[].content[]
  const blocks: Array<Record<string, unknown>> = [];
  if (Array.isArray(payload.outputs)) {
    for (const o of payload.outputs) if (o && typeof o === "object") blocks.push(o as Record<string, unknown>);
  }
  if (Array.isArray(payload.steps)) {
    for (const step of payload.steps as Array<{ content?: unknown }>) {
      if (Array.isArray(step?.content)) {
        for (const c of step.content) if (c && typeof c === "object") blocks.push(c as Record<string, unknown>);
      }
    }
  }
  for (const block of blocks) {
    if (block.type !== "video") continue;
    const mimeType =
      typeof block.mime_type === "string" && block.mime_type
        ? block.mime_type
        : typeof block.mimeType === "string" && block.mimeType
          ? block.mimeType
          : "video/mp4";
    if (typeof block.data === "string" && block.data) {
      return { base64: block.data, mimeType };
    }
    if (typeof block.uri === "string" && block.uri) {
      return { uri: block.uri, mimeType };
    }
  }

  return null;
}

async function resolveVideoBytes(
  extracted: ExtractedVideo,
  key: string,
  host: JobHost,
): Promise<{ bytes: Uint8Array; mimeType: string }> {
  if (extracted.base64) {
    return {
      bytes: new Uint8Array(Buffer.from(extracted.base64, "base64")),
      mimeType: extracted.mimeType || "video/mp4",
    };
  }
  if (!extracted.uri) {
    throw new Error("video provider finished without video bytes or download URI");
  }
  const res = await host.fetch(extracted.uri, {
    method: "GET",
    headers: { "x-goog-api-key": key },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(scrubKey(`failed to download generated video (${res.status}): ${extractErrorMessage(body)}`, key));
  }
  const arr = await res.arrayBuffer();
  return {
    bytes: new Uint8Array(arr),
    mimeType: res.headers.get("content-type")?.split(";")[0]?.trim() || extracted.mimeType || "video/mp4",
  };
}

function progressFromMetadata(payload: Record<string, unknown>): string | undefined {
  const meta = payload.metadata as Record<string, unknown> | undefined;
  if (meta && typeof meta === "object") {
    if (typeof meta.progressPercent === "number" && Number.isFinite(meta.progressPercent)) {
      return `${Math.round(meta.progressPercent)}%`;
    }
    if (typeof meta.progress === "string" && meta.progress.trim()) return meta.progress.trim();
    if (typeof meta.state === "string" && meta.state.trim()) return meta.state.trim();
  }
  if (typeof payload.progress === "string" && payload.progress.trim()) return payload.progress.trim();
  if (typeof payload.status === "string" && payload.status.trim() && payload.status !== "in_progress") {
    return payload.status.trim();
  }
  return undefined;
}

/**
 * **Home-polled async job runner for `kind: "video"`** (Phase 0.2 `ServerJobRunner`).
 * Supports Veo (`:predictLongRunning`) and Gemini Omni (`/v1beta/interactions`).
 */
export const videoJobRunner: ServerJobRunner = {
  async start(req: JobStartInput, host: JobHost): Promise<JobStartResult> {
    const key = await host.keyFor("gemini");
    if (!key) {
      throw new Error("this home has no Gemini key — cannot start video generation");
    }
    const stored = parseStoredRequest(req.request);
    if (!stored.prompt) {
      throw new Error("video job is missing a prompt");
    }
    const model = bareModelId(req.model || modelFor("video", { env: process.env }).id).replace(/^models\//, "");

    let sourceImage: { base64: string; mimeType: string } | undefined;
    if (stored.sourceBlobHash && stored.sourceMimeType) {
      const bytes = await host.readBlob(req.canvasId, stored.sourceBlobHash);
      if (bytes) {
        sourceImage = {
          base64: Buffer.from(bytes).toString("base64"),
          mimeType: stored.sourceMimeType,
        };
      }
    }

    try {
      if (isOmniVideoModel(model)) {
        const input: unknown[] = [{ type: "text", text: stored.prompt }];
        if (sourceImage) {
          input.push({ type: "image", mime_type: sourceImage.mimeType, data: sourceImage.base64 });
        }
        const res = await host.fetch(`${GEMINI_API_BASE}/interactions`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({
            model,
            input,
            response_modalities: ["video"],
            background: true,
            ...(stored.aspectRatio ? { aspect_ratio: stored.aspectRatio } : {}),
            ...(stored.durationSeconds ? { duration_seconds: stored.durationSeconds } : {}),
          }),
        });
        const text = await res.text();
        if (!res.ok) {
          throw new Error(scrubKey(`Gemini video start failed (${res.status}): ${extractErrorMessage(text)}`, key));
        }
        const payload = JSON.parse(text) as Record<string, unknown>;
        const immediateVideo = extractVideoFromPayload(payload);
        if (immediateVideo && (payload.status === "completed" || payload.done === true)) {
          const downloaded = await resolveVideoBytes(immediateVideo, key, host);
          return {
            immediate: {
              bytes: downloaded.bytes,
              mimeType: downloaded.mimeType,
              filename: videoFilename(stored.prompt, model),
            },
          };
        }
        const rawId = typeof payload.id === "string" && payload.id ? payload.id : typeof payload.name === "string" ? payload.name : "";
        if (!rawId) {
          throw new Error("Gemini Omni did not return an interaction id");
        }
        const externalId = rawId.startsWith("interactions/") || rawId.includes("/operations/") ? rawId : `interactions/${rawId}`;
        return { externalId };
      }

      // Veo / default predictLongRunning shape
      const instance: Record<string, unknown> = { prompt: stored.prompt };
      if (sourceImage) {
        instance.image = {
          bytesBase64Encoded: sourceImage.base64,
          mimeType: sourceImage.mimeType,
        };
      }
      const parameters: Record<string, unknown> = {};
      if (stored.aspectRatio) parameters.aspectRatio = stored.aspectRatio;
      if (stored.durationSeconds) parameters.durationSeconds = Math.min(8, stored.durationSeconds);

      const endpoint = `${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:predictLongRunning`;
      const res = await host.fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          instances: [instance],
          ...(Object.keys(parameters).length > 0 ? { parameters } : {}),
        }),
      });
      const text = await res.text();
      if (!res.ok) {
        throw new Error(scrubKey(`Veo video start failed (${res.status}): ${extractErrorMessage(text)}`, key));
      }
      const payload = JSON.parse(text) as Record<string, unknown>;
      if (payload.done === true) {
        const immediateVideo = extractVideoFromPayload(payload);
        if (immediateVideo) {
          const downloaded = await resolveVideoBytes(immediateVideo, key, host);
          return {
            immediate: {
              bytes: downloaded.bytes,
              mimeType: downloaded.mimeType,
              filename: videoFilename(stored.prompt, model),
            },
          };
        }
      }
      const opName = typeof payload.name === "string" ? payload.name.trim() : "";
      if (!opName) {
        throw new Error("Veo did not return an operation name");
      }
      return { externalId: opName };
    } catch (err) {
      throw new Error(scrubKey(err instanceof Error ? err.message : String(err), key));
    }
  },

  async poll(state: JobPollState, host: JobHost): Promise<JobPollResult> {
    const key = await host.keyFor("gemini");
    if (!key) {
      return { failed: "this home has no Gemini key — cannot poll video generation" };
    }
    if (!state.externalId) {
      return { failed: "video job is missing its provider operation id" };
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
        return { failed: scrubKey(`video poll failed (${res.status}): ${extractErrorMessage(text)}`, key) };
      }
      const payload = JSON.parse(text) as Record<string, unknown>;

      // Provider error payload
      if (payload.error && typeof payload.error === "object") {
        const msg = (payload.error as { message?: unknown }).message;
        return { failed: scrubKey(typeof msg === "string" && msg ? msg : "video generation failed", key) };
      }

      // Omni Interactions polling
      if (opPath.startsWith("interactions/")) {
        const status = typeof payload.status === "string" ? payload.status : "";
        if (status === "failed" || status === "cancelled") {
          const errText = extractErrorMessage(text);
          return { failed: scrubKey(`video generation ${status}: ${errText}`, key) };
        }
        if (status !== "completed" && payload.done !== true) {
          const progress = progressFromMetadata(payload);
          return progress ? { done: false, progress } : { done: false };
        }
      } else if (payload.done !== true) {
        // Veo operation still running
        const progress = progressFromMetadata(payload);
        return progress ? { done: false, progress } : { done: false };
      }

      const extracted = extractVideoFromPayload(payload);
      if (!extracted) {
        return { failed: "video provider finished without a playable video output" };
      }
      const downloaded = await resolveVideoBytes(extracted, key, host);
      return {
        done: true,
        bytes: downloaded.bytes,
        mimeType: downloaded.mimeType || "video/mp4",
        filename: videoFilename(stored.prompt || "video", state.model),
      };
    } catch (err) {
      return { failed: scrubKey(`video poll error: ${err instanceof Error ? err.message : String(err)}`, key) };
    }
  },

  async abandon(state: JobPollState, host: JobHost): Promise<void> {
    if (!state.externalId) return;
    const key = await host.keyFor("gemini");
    if (!key) return;
    const opPath = state.externalId.replace(/^\/+/, "");
    const cancelUrl = /^https?:\/\//.test(opPath)
      ? `${opPath}:cancel`
      : opPath.startsWith("interactions/")
        ? `${GEMINI_API_BASE}/${opPath}:cancel`
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

function checkGenerate({ body: raw }: { body: unknown }): ModuleResponse | null {
  const body = raw as Partial<VideoGenerateRequest> | null;
  const bad = (error: string): ModuleResponse => ({ status: 400, body: { error, code: VIDEO_BAD_REQUEST } });
  if (!body || typeof body !== "object") {
    return bad("a video request must be a JSON object naming `canvasId` and `prompt`");
  }
  if (typeof body.canvasId !== "string" || !body.canvasId.trim()) {
    return bad("a video request names the canvas it is for (`canvasId`)");
  }
  const promptCheck = validateVideoPrompt(body.prompt);
  if (!promptCheck.ok) return bad(promptCheck.error);
  const durationCheck = validateVideoDuration(body.durationSeconds);
  if (!durationCheck.ok) return bad(durationCheck.error);
  const aspectCheck = validateVideoAspectRatio(body.aspectRatio);
  if (!aspectCheck.ok) return bad(aspectCheck.error);
  if (body.fromItem !== undefined && (typeof body.fromItem !== "string" || !body.fromItem.trim())) {
    return bad("when supplied, `fromItem` must name an item id on this canvas");
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

async function resolveActor(body: VideoGenerateRequest, host: ServerHost): Promise<Actor | null> {
  if (body.actor) {
    await host.speaksFor(body.actor.id);
    return { id: body.actor.id, name: body.actor.name };
  }
  return (await host.defaultActor?.()) ?? null;
}

function defaultModelOf(host: ServerHost, explicit?: string): string {
  if (explicit?.trim()) return bareModelId(explicit.trim());
  const seam = host.options.model;
  if (typeof seam === "string" && seam.trim()) return bareModelId(seam.trim());
  return bareModelId(modelFor("video", { env: process.env }).id);
}

async function generateVideo(req: ModuleRequest, host: ServerHost): Promise<ModuleResponse> {
  const body = req.body as VideoGenerateRequest;
  const { canvasId } = req;
  const promptCheck = validateVideoPrompt(body.prompt);
  if (!promptCheck.ok) {
    return { status: 400, body: { error: promptCheck.error, code: VIDEO_BAD_REQUEST } };
  }
  const prompt = promptCheck.prompt;
  const durationCheck = validateVideoDuration(body.durationSeconds);
  const aspectCheck = validateVideoAspectRatio(body.aspectRatio);

  const resolved = await host.resolveKey("gemini");
  if (!resolved) {
    return {
      status: 503,
      body: {
        error: "this home has no Gemini key — video generation cannot start here (`isocan keys set gemini`)",
        code: VIDEO_UNAVAILABLE,
      },
    };
  }

  const actor = await resolveActor(body, host);
  if (!actor) {
    return {
      status: 400,
      body: {
        error: "an actor is required to start a video job — claim an identity or pass `actor` in the body",
        code: VIDEO_BAD_REQUEST,
      },
    };
  }

  const model = defaultModelOf(host, body.model);
  const fromItemId = body.fromItem?.trim();

  let sourceBlobHash: string | undefined;
  let sourceMimeType: string | undefined;
  if (fromItemId) {
    const snapshot = await host.canvas(canvasId);
    const source = snapshot.canvas.items[fromItemId];
    if (!source) {
      return {
        status: 404,
        body: { error: `source item not found on ${canvasId}: ${fromItemId}`, code: VIDEO_BAD_REQUEST },
      };
    }
    const ver = source.versions.find((v) => v.id === source.currentVersionId) ?? source.versions.at(-1);
    if (ver) {
      sourceBlobHash = ver.blobHash;
      sourceMimeType = ver.mimeType;
    }
  }

  const storedRequest: StoredVideoJobRequest = {
    prompt,
    ...(fromItemId ? { fromItem: fromItemId } : {}),
    ...(sourceBlobHash ? { sourceBlobHash } : {}),
    ...(sourceMimeType ? { sourceMimeType } : {}),
    ...(durationCheck.ok && durationCheck.durationSeconds !== undefined ? { durationSeconds: durationCheck.durationSeconds } : {}),
    ...(aspectCheck.ok && aspectCheck.aspectRatio !== undefined ? { aspectRatio: aspectCheck.aspectRatio } : {}),
  };

  const title = prompt.length > 64 ? `${prompt.slice(0, 61)}…` : prompt;
  const placeholderText = `# Generating video\n\nPrompt: ${prompt}\nModel: ${model}\n`;
  const properties: Record<string, string> = {
    [VIDEO_PROPS.prompt]: prompt,
    [CREDENTIAL_REF_PROP]: resolved.credentialRef,
    ...(fromItemId ? { [VIDEO_PROPS.sourceItem]: fromItemId, "derived-from": fromItemId } : {}),
  };

  const job = await host.startJob({
    canvasId,
    actor,
    spec: {
      kind: VIDEO_JOB_KIND,
      provider: "gemini",
      model,
      request: storedRequest,
      title,
      width: 640,
      height: 360,
      placeholder: {
        bytes: new TextEncoder().encode(placeholderText),
        mimeType: "text/markdown",
        filename: "video-generating.md",
      },
      properties,
    },
  });

  return {
    status: 202,
    body: {
      job,
      itemId: job.itemId,
    } satisfies VideoGenerateResponse,
  };
}

export const videoServer: ServerModule = {
  name: "@isocan/video",
  jobs: {
    [VIDEO_JOB_KIND]: videoJobRunner,
  },
  routes: [
    {
      method: "POST",
      path: "generate",
      spend: "owner",
      provider: "gemini",
      rate: { perMinute: VIDEO_GENERATES_PER_MINUTE },
      bodyLimit: 16 * 1024,
      says: {
        badRequest: { code: VIDEO_BAD_REQUEST, error: "a video request names `canvasId` and `prompt`" },
        ownerOnly: VIDEO_OWNER_ONLY,
        unavailable: {
          code: VIDEO_UNAVAILABLE,
          error: "this home has no Gemini key — video generation can't start here (`isocan keys set gemini`, or Model keys…, on the machine that holds this canvas)",
        },
        rateLimited: {
          code: VIDEO_RATE_LIMITED,
          error: "this badge has started enough video generations this minute — wait a moment and ask again",
        },
      },
      check: checkGenerate,
      handler: generateVideo,
    },
  ],
};

export default videoServer;
