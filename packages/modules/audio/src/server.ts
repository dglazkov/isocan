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
  AUDIO_MUSIC_QUALITIES,
  AUDIO_PROPS,
  DEFAULT_AUDIO_VOICE,
  audioFilename,
  isAudioMime,
  pcm16ToWav,
  validateAudioText,
  type AudioMusicQuality,
  type AudioMusicRequest,
  type AudioMusicResponse,
  type AudioSpeakRequest,
  type AudioSpeakResponse,
  type AudioTranscribeRequest,
  type AudioTranscribeResponse,
} from "./core.ts";

/**
 * **Audio's server half: `POST /api/m/audio/{music,speak,transcribe}`**
 * (Open Stitch phase 3).
 *
 * - `POST /music` (12/min): Lyria 3 via Gemini Interactions (`modelFor("music")`),
 *   stores blob via `host.putBlob`, adds item with `audio.kind="music"`,
 *   `audio.prompt`, and `credentialRef`.
 * - `POST /speak` (20/min): Gemini TTS (`modelFor("tts")`, default
 *   `gemini-3.8-flash-tts`), wraps raw PCM16 (`audio/l16`) into RIFF/WAV when
 *   needed, stores blob, adds item with `audio.kind="speech"`, `audio.voice`,
 *   and `credentialRef`.
 * - `POST /transcribe` (20/min): reads the item's blob via `host.readBlob`,
 *   calls `modelFor("transcribe")`, writes `audio.transcript`,
 *   `agentDescription`, and `credentialRef` via `item.update`.
 *
 * Every error path scrubs key material before responding.
 */

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const MUSIC_PER_MINUTE = 12;
const SPEAK_PER_MINUTE = 20;
const TRANSCRIBE_PER_MINUTE = 20;
const MAX_AUDIO_INLINE_BYTES = 18 * 1024 * 1024;
const AUDIO_CARD_SIZE = { width: 360, height: 148 } as const;

const AUDIO_BAD_REQUEST = "audio-bad-request";
const AUDIO_OWNER_ONLY = "audio-owner-only";
const AUDIO_UNAVAILABLE = "audio-unavailable";
const AUDIO_RATE_LIMITED = "audio-rate-limited";
const AUDIO_UPSTREAM = "audio-upstream";

interface RawAudioBlock {
  data?: unknown;
  mime_type?: unknown;
  mimeType?: unknown;
  channels?: unknown;
  sample_rate?: unknown;
  sampleRate?: unknown;
}

interface GeminiGenerateResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: unknown;
        thought?: unknown;
        inlineData?: { data?: unknown; mimeType?: unknown };
      }>;
    };
  }>;
  error?: { message?: unknown };
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
    // non-JSON upstream error
  }
  return said;
}

function checkActor(actor: unknown): string | null {
  if (actor === undefined) return null;
  const a = actor as Partial<Actor> | null;
  if (!a || typeof a !== "object" || typeof a.id !== "string" || !a.id || typeof a.name !== "string") {
    return "when supplied, `actor` must carry non-empty `id` and string `name`";
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

function nextAudioPlacement(canvas: CanvasContents): { x: number; y: number } {
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

function extractAudioFromPayload(payload: Record<string, unknown>): { audio: RawAudioBlock; text?: string } | null {
  const outputText = typeof payload.output_text === "string" && payload.output_text.trim()
    ? payload.output_text.trim()
    : undefined;

  const direct = payload.output_audio as RawAudioBlock | undefined;
  if (direct && typeof direct === "object" && typeof direct.data === "string" && direct.data) {
    return { audio: direct, ...(outputText ? { text: outputText } : {}) };
  }

  // Interactions API `outputs` / `steps[].content` array shape.
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
  let textFromBlocks: string | undefined;
  let audioFromBlocks: RawAudioBlock | undefined;
  for (const block of blocks) {
    if (block.type === "audio" && typeof block.data === "string" && block.data && !audioFromBlocks) {
      audioFromBlocks = block as RawAudioBlock;
    } else if (block.type === "text" && typeof block.text === "string" && block.text.trim() && !textFromBlocks) {
      textFromBlocks = block.text.trim();
    }
  }
  if (audioFromBlocks) {
    const text = outputText ?? textFromBlocks;
    return { audio: audioFromBlocks, ...(text ? { text } : {}) };
  }

  // Fallback: generateContent candidates[].content.parts[].inlineData
  const gen = payload as GeminiGenerateResponse;
  const parts = gen.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    const inline = part.inlineData;
    if (inline && typeof inline.data === "string" && inline.data) {
      const mime = typeof inline.mimeType === "string" ? inline.mimeType : undefined;
      if (!mime || mime.toLowerCase().startsWith("audio/")) {
        return {
          audio: { data: inline.data, ...(mime ? { mimeType: mime } : {}) },
          ...(outputText ? { text: outputText } : {}),
        };
      }
    }
  }
  return null;
}

function decodeDeliveredAudio(
  raw: RawAudioBlock,
  defaultMime: string,
): { bytes: Uint8Array; mimeType: string; ext: string } | { error: string } {
  if (typeof raw.data !== "string" || !raw.data) {
    return { error: "provider returned empty audio data" };
  }
  const bytes = new Uint8Array(Buffer.from(raw.data, "base64"));
  if (bytes.byteLength === 0) {
    return { error: "provider returned empty audio bytes" };
  }
  const rawMime =
    (typeof raw.mime_type === "string" && raw.mime_type.trim()) ||
    (typeof raw.mimeType === "string" && raw.mimeType.trim()) ||
    defaultMime;
  const baseMime = rawMime.toLowerCase().split(";")[0]?.trim() || defaultMime;

  if (/l16|pcm/i.test(baseMime)) {
    const sampleRateMatch = /rate=(\d+)/i.exec(rawMime);
    const sampleRate =
      typeof raw.sample_rate === "number"
        ? raw.sample_rate
        : typeof raw.sampleRate === "number"
          ? raw.sampleRate
          : sampleRateMatch
            ? Number(sampleRateMatch[1])
            : 24000;
    const channels = typeof raw.channels === "number" ? raw.channels : 1;
    if (
      !Number.isInteger(sampleRate) ||
      sampleRate < 1 ||
      sampleRate > 192000 ||
      !Number.isInteger(channels) ||
      channels < 1 ||
      channels > 8 ||
      bytes.byteLength % (channels * 2) !== 0
    ) {
      return { error: "generated PCM audio has unsupported format metadata" };
    }
    return { bytes: pcm16ToWav(bytes, sampleRate, channels), mimeType: "audio/wav", ext: "wav" };
  }

  if (baseMime === "audio/mp3" || baseMime === "audio/mpeg") {
    return { bytes, mimeType: "audio/mpeg", ext: "mp3" };
  }
  if (baseMime === "audio/ogg") {
    return { bytes, mimeType: "audio/ogg", ext: "ogg" };
  }
  if (baseMime === "audio/mp4" || baseMime === "audio/m4a") {
    return { bytes, mimeType: "audio/mp4", ext: "m4a" };
  }
  if (baseMime === "audio/webm") {
    return { bytes, mimeType: "audio/webm", ext: "webm" };
  }
  return { bytes, mimeType: baseMime === "audio/wav" || baseMime === "audio/x-wav" ? "audio/wav" : baseMime, ext: "wav" };
}

function extractGeminiText(payload: GeminiGenerateResponse): string {
  const parts = payload.candidates?.[0]?.content?.parts ?? [];
  return parts
    .filter((p) => !p.thought && typeof p.text === "string")
    .map((p) => p.text as string)
    .join("")
    .trim();
}

function musicModelOf(host: ServerHost, quality?: AudioMusicQuality): string {
  const seam = host.options.musicModel;
  if (typeof seam === "string" && seam.trim()) return bareModelId(seam.trim());
  const resolved = modelFor("music", { env: process.env });
  if (quality === "pro" && resolved.fallbacks[0]) {
    return bareModelId(resolved.fallbacks[0]);
  }
  return bareModelId(resolved.id);
}

function ttsModelOf(host: ServerHost): string {
  const seam = host.options.ttsModel;
  if (typeof seam === "string" && seam.trim()) return bareModelId(seam.trim());
  return bareModelId(modelFor("tts", { env: process.env }).id);
}

function transcribeModelOf(host: ServerHost): string {
  const seam = host.options.transcribeModel;
  if (typeof seam === "string" && seam.trim()) return bareModelId(seam.trim());
  return bareModelId(modelFor("transcribe", { env: process.env }).id);
}

function checkMusic({ body: raw }: { body: unknown }): ModuleResponse | null {
  const body = raw as Partial<AudioMusicRequest> | null;
  const bad = (error: string): ModuleResponse => ({ status: 400, body: { error, code: AUDIO_BAD_REQUEST } });
  if (!body || typeof body !== "object") {
    return bad("a music request must be a JSON object naming `canvasId` and `prompt`");
  }
  if (typeof body.canvasId !== "string" || !body.canvasId.trim()) {
    return bad("a music request names the canvas it is for (`canvasId`)");
  }
  const promptCheck = validateAudioText(body.prompt, "prompt");
  if (!promptCheck.ok) return bad(promptCheck.error);
  if (body.quality !== undefined && !(AUDIO_MUSIC_QUALITIES as readonly string[]).includes(body.quality)) {
    return bad(`\`quality\` must be one of ${AUDIO_MUSIC_QUALITIES.join(", ")}`);
  }
  const actorErr = checkActor(body.actor);
  if (actorErr) return bad(actorErr);
  return null;
}

function checkSpeak({ body: raw }: { body: unknown }): ModuleResponse | null {
  const body = raw as Partial<AudioSpeakRequest> | null;
  const bad = (error: string): ModuleResponse => ({ status: 400, body: { error, code: AUDIO_BAD_REQUEST } });
  if (!body || typeof body !== "object") {
    return bad("a speech request must be a JSON object naming `canvasId` and `text`");
  }
  if (typeof body.canvasId !== "string" || !body.canvasId.trim()) {
    return bad("a speech request names the canvas it is for (`canvasId`)");
  }
  const textCheck = validateAudioText(body.text, "text");
  if (!textCheck.ok) return bad(textCheck.error);
  if (body.voice !== undefined && (typeof body.voice !== "string" || !body.voice.trim() || body.voice.length > 64)) {
    return bad("when supplied, `voice` must be a non-empty voice name (at most 64 characters)");
  }
  if (body.style !== undefined && (typeof body.style !== "string" || body.style.length > 240)) {
    return bad("when supplied, `style` must be a string of at most 240 characters");
  }
  const actorErr = checkActor(body.actor);
  if (actorErr) return bad(actorErr);
  return null;
}

function checkTranscribe({ body: raw }: { body: unknown }): ModuleResponse | null {
  const body = raw as Partial<AudioTranscribeRequest> | null;
  const bad = (error: string): ModuleResponse => ({ status: 400, body: { error, code: AUDIO_BAD_REQUEST } });
  if (!body || typeof body !== "object") {
    return bad("a transcribe request must be a JSON object naming `canvasId` and `itemId`");
  }
  if (typeof body.canvasId !== "string" || !body.canvasId.trim()) {
    return bad("a transcribe request names the canvas it is for (`canvasId`)");
  }
  if (typeof body.itemId !== "string" || !body.itemId.trim()) {
    return bad("a transcribe request names the audio item to transcribe (`itemId`)");
  }
  const actorErr = checkActor(body.actor);
  if (actorErr) return bad(actorErr);
  return null;
}

async function generateMusic(req: ModuleRequest, host: ServerHost): Promise<ModuleResponse> {
  const body = req.body as AudioMusicRequest;
  const { canvasId } = req;
  const prompt = body.prompt.trim();

  const resolved = await host.resolveKey("gemini");
  if (!resolved) {
    return {
      status: 503,
      body: {
        error: "this home has no Gemini key — music generation cannot run here (`isocan keys set gemini`)",
        code: AUDIO_UNAVAILABLE,
      },
    };
  }
  const { key, credentialRef } = resolved;

  const actor = await resolveActor(body.actor, host);
  if (!actor) {
    return {
      status: 400,
      body: {
        error: "an actor is required to add generated music — claim an identity or pass `actor` in the body",
        code: AUDIO_BAD_REQUEST,
      },
    };
  }

  const model = musicModelOf(host, body.quality);
  let payload: Record<string, unknown>;
  try {
    const res = await host.fetch(`${GEMINI_API_BASE}/interactions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        model,
        store: false,
        input: prompt,
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      return {
        status: 502,
        body: {
          error: scrubKey(`Gemini refused the music request (${res.status}): ${extractUpstreamError(text)}`, key),
          code: AUDIO_UPSTREAM,
        },
      };
    }
    payload = JSON.parse(text) as Record<string, unknown>;
  } catch (err) {
    return {
      status: 502,
      body: {
        error: scrubKey(`Gemini could not be reached for music generation: ${err instanceof Error ? err.message : String(err)}`, key),
        code: AUDIO_UPSTREAM,
      },
    };
  }

  const extracted = extractAudioFromPayload(payload);
  if (!extracted) {
    return {
      status: 502,
      body: { error: "music model returned no audio output", code: AUDIO_UPSTREAM },
    };
  }
  const decoded = decodeDeliveredAudio(extracted.audio, "audio/mpeg");
  if ("error" in decoded) {
    return { status: 502, body: { error: scrubKey(decoded.error, key), code: AUDIO_UPSTREAM } };
  }

  const snapshot = await host.canvas(canvasId);
  const filename = audioFilename("music", prompt, decoded.ext);
  const put = await host.putBlob(canvasId, decoded.bytes, { mimeType: decoded.mimeType, filename });
  const itemId = newItemId();
  const title = prompt.length > 60 ? `${prompt.slice(0, 57)}…` : prompt;

  await host.submit({
    canvasId,
    actor,
    op: {
      type: "item.add",
      itemId,
      version: {
        id: newVersionId(),
        blobHash: put.blobHash,
        mimeType: put.mimeType,
        filename,
        size: put.size,
      },
      width: AUDIO_CARD_SIZE.width,
      height: AUDIO_CARD_SIZE.height,
      placement: nextAudioPlacement(snapshot.canvas),
      title,
      properties: {
        [AUDIO_PROPS.kind]: "music",
        [AUDIO_PROPS.prompt]: prompt,
        [CREDENTIAL_REF_PROP]: credentialRef,
      },
    },
  });

  const lyrics = extracted.text ? scrubKey(extracted.text, key) : undefined;
  return {
    status: 200,
    body: {
      itemId,
      blobHash: put.blobHash,
      mimeType: put.mimeType,
      model,
      ...(lyrics ? { lyrics } : {}),
      credentialRef,
    } satisfies AudioMusicResponse,
  };
}

async function synthesizeSpeech(req: ModuleRequest, host: ServerHost): Promise<ModuleResponse> {
  const body = req.body as AudioSpeakRequest;
  const { canvasId } = req;
  const text = body.text.trim();
  const voice = body.voice?.trim() || DEFAULT_AUDIO_VOICE;
  const style = body.style?.trim() || undefined;

  const resolved = await host.resolveKey("gemini");
  if (!resolved) {
    return {
      status: 503,
      body: {
        error: "this home has no Gemini key — speech synthesis cannot run here (`isocan keys set gemini`)",
        code: AUDIO_UNAVAILABLE,
      },
    };
  }
  const { key, credentialRef } = resolved;

  const actor = await resolveActor(body.actor, host);
  if (!actor) {
    return {
      status: 400,
      body: {
        error: "an actor is required to add synthesized speech — claim an identity or pass `actor` in the body",
        code: AUDIO_BAD_REQUEST,
      },
    };
  }

  const model = ttsModelOf(host);
  let payload: Record<string, unknown>;
  try {
    const res = await host.fetch(`${GEMINI_API_BASE}/interactions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        model,
        store: false,
        input: [
          {
            type: "user_input",
            content: [
              {
                type: "text",
                text,
                ...(style ? { annotations: [{ type: "speech_metadata", style }] } : {}),
              },
            ],
          },
        ],
        response_format: { type: "audio", mime_type: "audio/l16" },
        generation_config: { speech_config: [{ voice }] },
      }),
    });
    const rawText = await res.text();
    if (!res.ok) {
      return {
        status: 502,
        body: {
          error: scrubKey(`Gemini refused the speech request (${res.status}): ${extractUpstreamError(rawText)}`, key),
          code: AUDIO_UPSTREAM,
        },
      };
    }
    payload = JSON.parse(rawText) as Record<string, unknown>;
  } catch (err) {
    return {
      status: 502,
      body: {
        error: scrubKey(`Gemini could not be reached for speech synthesis: ${err instanceof Error ? err.message : String(err)}`, key),
        code: AUDIO_UPSTREAM,
      },
    };
  }

  const extracted = extractAudioFromPayload(payload);
  if (!extracted) {
    return {
      status: 502,
      body: { error: "TTS model returned no audio output", code: AUDIO_UPSTREAM },
    };
  }
  const decoded = decodeDeliveredAudio(extracted.audio, "audio/l16");
  if ("error" in decoded) {
    return { status: 502, body: { error: scrubKey(decoded.error, key), code: AUDIO_UPSTREAM } };
  }

  const snapshot = await host.canvas(canvasId);
  const filename = audioFilename("speech", text, decoded.ext);
  const put = await host.putBlob(canvasId, decoded.bytes, { mimeType: decoded.mimeType, filename });
  const itemId = newItemId();
  const title = text.length > 60 ? `${text.slice(0, 57)}…` : text;

  await host.submit({
    canvasId,
    actor,
    op: {
      type: "item.add",
      itemId,
      version: {
        id: newVersionId(),
        blobHash: put.blobHash,
        mimeType: put.mimeType,
        filename,
        size: put.size,
      },
      width: AUDIO_CARD_SIZE.width,
      height: AUDIO_CARD_SIZE.height,
      placement: nextAudioPlacement(snapshot.canvas),
      title,
      properties: {
        [AUDIO_PROPS.kind]: "speech",
        [AUDIO_PROPS.voice]: voice,
        [AUDIO_PROPS.prompt]: text,
        [CREDENTIAL_REF_PROP]: credentialRef,
      },
    },
  });

  return {
    status: 200,
    body: {
      itemId,
      blobHash: put.blobHash,
      mimeType: put.mimeType,
      voice,
      model,
      credentialRef,
    } satisfies AudioSpeakResponse,
  };
}

async function transcribeAudio(req: ModuleRequest, host: ServerHost): Promise<ModuleResponse> {
  const body = req.body as AudioTranscribeRequest;
  const { canvasId } = req;
  const itemId = body.itemId.trim();

  const resolved = await host.resolveKey("gemini");
  if (!resolved) {
    return {
      status: 503,
      body: {
        error: "this home has no Gemini key — audio transcription cannot run here (`isocan keys set gemini`)",
        code: AUDIO_UNAVAILABLE,
      },
    };
  }
  const { key, credentialRef } = resolved;

  const actor = await resolveActor(body.actor, host);
  if (!actor) {
    return {
      status: 400,
      body: {
        error: "an actor is required to write `audio.transcript` — claim an identity or pass `actor` in the body",
        code: AUDIO_BAD_REQUEST,
      },
    };
  }

  const snapshot = await host.canvas(canvasId);
  const item = snapshot.canvas.items[itemId];
  if (!item) {
    return { status: 404, body: { error: `item not found on ${canvasId}: ${itemId}`, code: AUDIO_BAD_REQUEST } };
  }
  const version = item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions.at(-1);
  if (!version) {
    return { status: 400, body: { error: `item ${itemId} has no version bytes to transcribe`, code: AUDIO_BAD_REQUEST } };
  }
  if (!isAudioMime(version.mimeType)) {
    return {
      status: 400,
      body: {
        error: `item ${itemId} has mimeType "${version.mimeType}" — transcribe supports audio items only`,
        code: AUDIO_BAD_REQUEST,
      },
    };
  }

  const bytes = await host.readBlob(canvasId, version.blobHash);
  if (!bytes) {
    return { status: 404, body: { error: `blob ${version.blobHash} for item ${itemId} is not at this home`, code: AUDIO_BAD_REQUEST } };
  }
  if (bytes.byteLength > MAX_AUDIO_INLINE_BYTES) {
    return {
      status: 413,
      body: {
        error: `audio item ${itemId} (${bytes.byteLength} bytes) exceeds the ${MAX_AUDIO_INLINE_BYTES}-byte inline transcription limit`,
        code: AUDIO_BAD_REQUEST,
      },
    };
  }

  const model = transcribeModelOf(host);
  const endpoint = `${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:generateContent`;
  let transcript: string;
  try {
    const res = await host.fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: "Transcribe this audio accurately verbatim. Respond with the transcript text only." },
              {
                inlineData: {
                  mimeType: version.mimeType,
                  data: Buffer.from(bytes).toString("base64"),
                },
              },
            ],
          },
        ],
      }),
    });
    const rawText = await res.text();
    if (!res.ok) {
      return {
        status: 502,
        body: {
          error: scrubKey(`Gemini refused the transcribe request (${res.status}): ${extractUpstreamError(rawText)}`, key),
          code: AUDIO_UPSTREAM,
        },
      };
    }
    const parsed = JSON.parse(rawText) as GeminiGenerateResponse;
    transcript = extractGeminiText(parsed);
    if (!transcript) {
      return {
        status: 502,
        body: { error: "Gemini answered without a transcript", code: AUDIO_UPSTREAM },
      };
    }
    transcript = scrubKey(transcript, key);
  } catch (err) {
    return {
      status: 502,
      body: {
        error: scrubKey(`Gemini could not be reached to transcribe ${itemId}: ${err instanceof Error ? err.message : String(err)}`, key),
        code: AUDIO_UPSTREAM,
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
          [AUDIO_PROPS.transcript]: transcript,
          agentDescription: transcript,
          [CREDENTIAL_REF_PROP]: credentialRef,
        },
      },
    },
  });

  return {
    status: 200,
    body: {
      itemId,
      transcript,
      model,
      credentialRef,
    } satisfies AudioTranscribeResponse,
  };
}

export const audioServer: ServerModule = {
  name: "@isocan/audio",
  routes: [
    {
      method: "POST",
      path: "music",
      spend: "owner",
      provider: "gemini",
      rate: { perMinute: MUSIC_PER_MINUTE },
      bodyLimit: 32 * 1024,
      says: {
        badRequest: { code: AUDIO_BAD_REQUEST, error: "a music request names `canvasId` and `prompt`" },
        ownerOnly: AUDIO_OWNER_ONLY,
        unavailable: {
          code: AUDIO_UNAVAILABLE,
          error: "this home has no Gemini key — music generation can't run here (`isocan keys set gemini`, or Model keys…, on the machine that holds this canvas)",
        },
        rateLimited: {
          code: AUDIO_RATE_LIMITED,
          error: "this badge has generated enough music clips this minute — wait a moment and ask again",
        },
      },
      check: checkMusic,
      handler: generateMusic,
    },
    {
      method: "POST",
      path: "speak",
      spend: "owner",
      provider: "gemini",
      rate: { perMinute: SPEAK_PER_MINUTE },
      bodyLimit: 32 * 1024,
      says: {
        badRequest: { code: AUDIO_BAD_REQUEST, error: "a speech request names `canvasId` and `text`" },
        ownerOnly: AUDIO_OWNER_ONLY,
        unavailable: {
          code: AUDIO_UNAVAILABLE,
          error: "this home has no Gemini key — speech synthesis can't run here (`isocan keys set gemini`, or Model keys…, on the machine that holds this canvas)",
        },
        rateLimited: {
          code: AUDIO_RATE_LIMITED,
          error: "this badge has synthesized enough speech clips this minute — wait a moment and ask again",
        },
      },
      check: checkSpeak,
      handler: synthesizeSpeech,
    },
    {
      method: "POST",
      path: "transcribe",
      spend: "owner",
      provider: "gemini",
      rate: { perMinute: TRANSCRIBE_PER_MINUTE },
      bodyLimit: 16 * 1024,
      says: {
        badRequest: { code: AUDIO_BAD_REQUEST, error: "a transcribe request names `canvasId` and `itemId`" },
        ownerOnly: AUDIO_OWNER_ONLY,
        unavailable: {
          code: AUDIO_UNAVAILABLE,
          error: "this home has no Gemini key — audio transcription can't run here (`isocan keys set gemini`, or Model keys…, on the machine that holds this canvas)",
        },
        rateLimited: {
          code: AUDIO_RATE_LIMITED,
          error: "this badge has transcribed enough audio clips this minute — wait a moment and ask again",
        },
      },
      check: checkTranscribe,
      handler: transcribeAudio,
    },
  ],
};

export default audioServer;
