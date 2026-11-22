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

import { titleSlug, type Actor, type CanvasContents, type ContextPiece, type CoreModule, type ModuleKind } from "@isocan/core";
import type { CredentialRef } from "@isocan/core/keys";

/** Supported audio MIME types claimed by the `audio` kind. */
export const AUDIO_MIMES = [
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/mp4",
  "audio/webm",
] as const;

/** Bare lowercase extensions paired 1:1 with the first four `AUDIO_MIMES`. */
export const AUDIO_EXTENSIONS = ["mp3", "wav", "ogg", "m4a"] as const;

/** Audio item kind registered with core. */
export const AUDIO_KIND: ModuleKind = {
  id: "audio",
  mimes: [...AUDIO_MIMES],
  extensions: [...AUDIO_EXTENSIONS],
  label: "Audio",
  noun: "audio clip",
  icon: "video",
};

/** Item property keys owned by this module. */
export const AUDIO_PROPS = {
  kind: "audio.kind",
  prompt: "audio.prompt",
  voice: "audio.voice",
  transcript: "audio.transcript",
} as const;

/** Home routes mounted by the audio server half. */
export const AUDIO_MUSIC_ROUTE = "/api/m/audio/music";
export const AUDIO_SPEAK_ROUTE = "/api/m/audio/speak";
export const AUDIO_TRANSCRIBE_ROUTE = "/api/m/audio/transcribe";

/** Default TTS voice when the caller omits `voice`. */
export const DEFAULT_AUDIO_VOICE = "Kore";

/** Maximum character length for a music prompt or speech text. */
export const AUDIO_MAX_TEXT_LENGTH = 4000;

/** Music generation quality tier (`clip` = primary Lyria 3 clip, `pro` = fallback pro checkpoint). */
export const AUDIO_MUSIC_QUALITIES = ["clip", "pro"] as const;
export type AudioMusicQuality = (typeof AUDIO_MUSIC_QUALITIES)[number];

/** Request payload for `POST /api/m/audio/music`. */
export interface AudioMusicRequest {
  canvasId: string;
  prompt: string;
  quality?: AudioMusicQuality;
  actor?: Actor;
}

/** Response payload for `POST /api/m/audio/music`. */
export interface AudioMusicResponse {
  itemId: string;
  blobHash: string;
  mimeType: string;
  model: string;
  lyrics?: string;
  credentialRef: CredentialRef;
}

/** Request payload for `POST /api/m/audio/speak`. */
export interface AudioSpeakRequest {
  canvasId: string;
  text: string;
  voice?: string;
  style?: string;
  actor?: Actor;
}

/** Response payload for `POST /api/m/audio/speak`. */
export interface AudioSpeakResponse {
  itemId: string;
  blobHash: string;
  mimeType: string;
  voice: string;
  model: string;
  credentialRef: CredentialRef;
}

/** Request payload for `POST /api/m/audio/transcribe`. */
export interface AudioTranscribeRequest {
  canvasId: string;
  itemId: string;
  actor?: Actor;
}

/** Response payload for `POST /api/m/audio/transcribe`. */
export interface AudioTranscribeResponse {
  itemId: string;
  transcript: string;
  model: string;
  credentialRef: CredentialRef;
}

/** Whether `mimeType` is an audio MIME type supported by this module. */
export function isAudioMime(mimeType: string): boolean {
  const lower = mimeType.toLowerCase().split(";")[0]?.trim() ?? "";
  return (AUDIO_MIMES as readonly string[]).includes(lower) || lower.startsWith("audio/");
}

/** Validate a non-empty prompt or speech text input. */
export function validateAudioText(
  raw: unknown,
  field: "prompt" | "text",
): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof raw !== "string") {
    return { ok: false, error: `an audio request carries a non-empty \`${field}\`` };
  }
  const value = raw.trim();
  if (!value) {
    return { ok: false, error: `an audio request carries a non-empty \`${field}\`` };
  }
  if (value.length > AUDIO_MAX_TEXT_LENGTH) {
    return {
      ok: false,
      error: `audio \`${field}\` is at most ${AUDIO_MAX_TEXT_LENGTH} characters (got ${value.length})`,
    };
  }
  return { ok: true, value };
}

/** Safe audio filename derived from a prefix, label, and extension. */
export function audioFilename(prefix: "music" | "speech", label: string, ext: string): string {
  const slug = titleSlug(label, { max: 36, ascii: true });
  const safeExt = ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "wav";
  return `${prefix}-${slug || "clip"}.${safeExt}`;
}

/**
 * Wrap raw 16-bit signed little-endian PCM bytes in a standard 44-byte RIFF/WAV
 * header so `<audio>` elements play Gemini TTS `audio/l16` output natively.
 */
export function pcm16ToWav(pcm: Uint8Array, sampleRate = 24000, channels = 1): Uint8Array {
  const blockAlign = channels * 2;
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const writeAscii = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + pcm.byteLength, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeAscii(36, "data");
  view.setUint32(40, pcm.byteLength, true);

  const out = new Uint8Array(44 + pcm.byteLength);
  out.set(new Uint8Array(header), 0);
  out.set(pcm, 44);
  return out;
}

/** Compact single-line excerpt for canvas context summaries. */
export function transcriptPreview(transcript: string, maxLen = 120): string {
  const cleaned = transcript.trim().replace(/\s+/g, " ");
  if (cleaned.length <= maxLen) return cleaned;
  return `${cleaned.slice(0, maxLen - 1)}…`;
}

/**
 * **The record both surfaces register** (Open Stitch phase 3).
 *
 * Adds the `audio` kind (`mp3`, `wav`, `ogg`, `m4a`, plus `audio/webm` MIME),
 * owns `audio.kind`, `audio.prompt`, `audio.voice`, and `audio.transcript`, and
 * exposes transcripts in canvas context so agents can read spoken clips.
 */
export const audioModule: CoreModule = {
  name: "@isocan/audio",
  kinds: [AUDIO_KIND],
  propertyKeys: [
    AUDIO_PROPS.kind,
    AUDIO_PROPS.prompt,
    AUDIO_PROPS.voice,
    AUDIO_PROPS.transcript,
  ],
  contextPieces(canvas: CanvasContents): ContextPiece[] {
    const transcribed = Object.values(canvas.items)
      .filter((item) => Boolean(item.properties?.[AUDIO_PROPS.transcript]?.trim()))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    if (transcribed.length === 0) return [];
    const previews = transcribed
      .slice(0, 5)
      .map((item) => `${item.title}: ${transcriptPreview(item.properties[AUDIO_PROPS.transcript]!)}`)
      .join(" · ");
    const suffix = transcribed.length > 5 ? ` (+${transcribed.length - 5} more)` : "";
    return [
      {
        name: "Audio transcripts",
        source: "canvas",
        present: true,
        size: `${transcribed.length} clip${transcribed.length === 1 ? "" : "s"} — ${previews}${suffix}`,
        updatedAt: transcribed[0]!.updatedAt,
      },
    ];
  },
};

export default audioModule;
