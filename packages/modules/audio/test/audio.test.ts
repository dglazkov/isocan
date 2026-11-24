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

import { afterEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import {
  CLIENT_FEATURES_HEADER,
  CURRENT_CLIENT_FEATURES,
  askTheDoor,
  bearerHeader,
  itemKind,
  mimeFromName,
  newCanvasId,
  registerModule,
  unregisterModule,
  type Actor,
  type Item,
  type StoredBadge,
} from "@isocan/core";
import { CREDENTIAL_REF_PROP, USER_KEYS_ROUTE } from "@isocan/core/keys";
import { modelFor } from "@isocan/core/models";
import { startDaemon, type Daemon } from "../../../server/src/daemon.ts";
import {
  AUDIO_MUSIC_ROUTE,
  AUDIO_PROPS,
  AUDIO_SPEAK_ROUTE,
  AUDIO_TRANSCRIBE_ROUTE,
  audioModule,
  pcm16ToWav,
  type AudioMusicResponse,
  type AudioSpeakResponse,
  type AudioTranscribeResponse,
} from "../src/core.ts";

const cleanup: Array<() => Promise<void>> = [];

afterEach(async () => {
  unregisterModule(audioModule.name);
  while (cleanup.length > 0) {
    const fn = cleanup.pop()!;
    await fn();
  }
});

async function mkHome(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-audio-test-"));
  cleanup.push(() => fs.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));
  return dir;
}

function daemonBase(d: Daemon): string {
  const addr = d.app.server.address() as AddressInfo;
  return `http://127.0.0.1:${addr.port}`;
}

async function boot(home: string, opts: Parameters<typeof startDaemon>[0] = {}): Promise<Daemon> {
  const d = await startDaemon({
    home,
    port: 0,
    contentPort: "off",
    gcIntervalMs: 0,
    blobCheckIntervalMs: 0,
    ...opts,
  });
  cleanup.push(() => d.close());
  return d;
}

function authHeaders(badge: StoredBadge, json = false): Record<string, string> {
  return {
    ...bearerHeader(badge),
    [CLIENT_FEATURES_HEADER]: CURRENT_CLIENT_FEATURES,
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}

async function mintEditor(base: string, sessionKey = "test:acme-audio"): Promise<{ badge: StoredBadge; actor: Actor }> {
  const knocked = await askTheDoor(base);
  if (!("badge" in knocked)) throw new Error(`door refused: ${knocked.refused.error}`);
  const { badge } = knocked;
  const claimRes = await fetch(`${base}/api/ops`, {
    method: "POST",
    headers: authHeaders(badge, true),
    body: JSON.stringify({
      canvasId: null,
      actor: { id: "", name: "Acme Audio Editor" },
      op: { type: "actor.claim", sessionKey, name: "Acme Audio Editor" },
    }),
  });
  expect(claimRes.status).toBe(200);
  const claimed = (await claimRes.json()) as { envelope: { actor: Actor } };
  return { badge, actor: claimed.envelope.actor };
}

async function createCanvas(base: string, badge: StoredBadge, actor: Actor): Promise<string> {
  const canvasId = newCanvasId();
  const res = await fetch(`${base}/api/ops`, {
    method: "POST",
    headers: authHeaders(badge, true),
    body: JSON.stringify({
      canvasId: null,
      actor,
      op: { type: "project.create", canvasId, title: "Acme Audio Canvas" },
    }),
  });
  expect(res.status).toBe(200);
  return canvasId;
}

function fakeAudioItem(mimeType: string): Item {
  return {
    id: "itm_acme_audio",
    title: "Acme Jingle",
    description: "",
    x: 0,
    y: 0,
    width: 360,
    height: 148,
    versions: [
      {
        id: "ver_1",
        blobHash: "sha256_acme",
        mimeType,
        filename: "acme-jingle.mp3",
        size: 128,
        createdAt: "2026-11-20T00:00:00.000Z",
        createdBy: { id: "usr_acme", name: "Acme Editor" },
      },
    ],
    currentVersionId: "ver_1",
    properties: {},
    reactions: {},
    createdBy: { id: "usr_acme", name: "Acme Editor" },
    updatedBy: { id: "usr_acme", name: "Acme Editor" },
    createdAt: "2026-11-20T00:00:00.000Z",
    updatedAt: "2026-11-20T00:00:00.000Z",
  };
}

describe("@isocan/audio core", () => {
  it("registers the audio kind for all supported MIME types and extensions without hijacking .webm video", () => {
    expect(itemKind(fakeAudioItem("audio/mpeg"))).toBe("other");

    registerModule(audioModule);
    for (const mime of ["audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4", "audio/webm"]) {
      expect(itemKind(fakeAudioItem(mime))).toBe("audio");
    }
    expect(mimeFromName("acme-theme.mp3")).toBe("audio/mpeg");
    expect(mimeFromName("acme-voice.wav")).toBe("audio/wav");
    expect(mimeFromName("acme-loop.ogg")).toBe("audio/ogg");
    expect(mimeFromName("acme-memo.m4a")).toBe("audio/mp4");
    expect(mimeFromName("acme-video.webm")).toBe("video/webm");

    unregisterModule(audioModule.name);
    expect(itemKind(fakeAudioItem("audio/mpeg"))).toBe("other");
  });

  it("wraps 16-bit PCM bytes into a valid RIFF/WAVE header", () => {
    const pcm = new Uint8Array([0x00, 0x00, 0xff, 0x7f, 0x00, 0x80, 0x10, 0x20]);
    const wav = pcm16ToWav(pcm, 24000, 1);
    expect(wav.byteLength).toBe(44 + pcm.byteLength);
    expect(new TextDecoder().decode(wav.subarray(0, 4))).toBe("RIFF");
    expect(new TextDecoder().decode(wav.subarray(8, 12))).toBe("WAVE");
    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
    expect(view.getUint32(4, true)).toBe(36 + pcm.byteLength);
    expect(view.getUint32(24, true)).toBe(24000);
    expect(view.getUint32(40, true)).toBe(pcm.byteLength);
  });
});

describe("@isocan/audio server routes", () => {
  it("handles POST /music, POST /speak (PCM->WAV + BYOK), and POST /transcribe end-to-end", async () => {
    const home = await mkHome();
    const FAKE_ENV_KEY = "acme-gemini-audio-ENV-KEY-111111";
    const FAKE_USER_KEY = "acme-gemini-audio-BYOK-KEY-222222";
    const calls: Array<{ url: string; key: string | null; body: Record<string, unknown> }> = [];

    const fakeMp3 = new Uint8Array([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00]);
    const fakePcm = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]);

    const fakeFetch: typeof fetch = async (input, init) => {
      const url = String(input);
      const headers = new Headers(init?.headers);
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      calls.push({ url, key: headers.get("x-goog-api-key"), body });

      if (url.endsWith("/interactions")) {
        const model = String(body.model ?? "");
        if (model.startsWith("lyria-")) {
          return new Response(
            JSON.stringify({
              id: "int_acme_music_1",
              output_audio: {
                data: Buffer.from(fakeMp3).toString("base64"),
                mime_type: "audio/mpeg",
              },
              output_text: "Acme instrumental cue",
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        return new Response(
          JSON.stringify({
            id: "int_acme_tts_1",
            output_audio: {
              data: Buffer.from(fakePcm).toString("base64"),
              mime_type: "audio/l16",
              sample_rate: 24000,
              channels: 1,
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (url.includes(":generateContent")) {
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    { text: "ignored thought", thought: true },
                    { text: "Welcome to the Acme studio tour." },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      return new Response("unexpected route", { status: 404 });
    };

    const daemon = await boot(home, {
      modules: {
        audio: {
          key: () => FAKE_ENV_KEY,
          fetch: fakeFetch,
        },
      },
    });
    const base = daemonBase(daemon);
    const editor = await mintEditor(base);
    const canvasId = await createCanvas(base, editor.badge, editor.actor);

    // 1) POST /api/m/audio/music with env key
    const musicRes = await fetch(`${base}${AUDIO_MUSIC_ROUTE}`, {
      method: "POST",
      headers: authHeaders(editor.badge, true),
      body: JSON.stringify({
        canvasId,
        prompt: "Warm acoustic guitar loop for Acme intro",
        actor: editor.actor,
      }),
    });
    expect(musicRes.status).toBe(200);
    const music = (await musicRes.json()) as AudioMusicResponse;
    expect(music.model).toBe(modelFor("music").id);
    expect(music.mimeType).toBe("audio/mpeg");
    expect(music.credentialRef).toBe("env:gemini");
    expect(music.lyrics).toBe("Acme instrumental cue");
    expect(calls[0]!.key).toBe(FAKE_ENV_KEY);
    expect(calls[0]!.body.model).toBe(modelFor("music").id);

    const snap1 = await daemon.engine.getSnapshot(canvasId);
    const musicItem = snap1.canvas.items[music.itemId]!;
    expect(musicItem.properties[AUDIO_PROPS.kind]).toBe("music");
    expect(musicItem.properties[AUDIO_PROPS.prompt]).toBe("Warm acoustic guitar loop for Acme intro");
    expect(musicItem.properties[CREDENTIAL_REF_PROP]).toBe("env:gemini");

    // 2) Store per-user BYOK key and POST /api/m/audio/speak -> PCM wrapped to WAV + BYOK credentialRef
    const putKeyRes = await fetch(`${base}${USER_KEYS_ROUTE}/gemini`, {
      method: "PUT",
      headers: authHeaders(editor.badge, true),
      body: JSON.stringify({ key: FAKE_USER_KEY }),
    });
    expect(putKeyRes.status).toBe(200);

    const speakRes = await fetch(`${base}${AUDIO_SPEAK_ROUTE}`, {
      method: "POST",
      headers: authHeaders(editor.badge, true),
      body: JSON.stringify({
        canvasId,
        text: "Welcome to the Acme studio tour.",
        voice: "Puck",
      }),
    });
    expect(speakRes.status).toBe(200);
    const speech = (await speakRes.json()) as AudioSpeakResponse;
    expect(speech.model).toBe(modelFor("tts").id);
    expect(speech.voice).toBe("Puck");
    expect(speech.mimeType).toBe("audio/wav");
    expect(speech.credentialRef).toBe(`user:${editor.actor.id}:gemini:v1`);
    expect(calls[1]!.key).toBe(FAKE_USER_KEY);
    expect(calls[1]!.body.model).toBe(modelFor("tts").id);

    // Verify stored WAV blob starts with RIFF/WAVE.
    const wavBlobRes = await fetch(`${base}/api/projects/${canvasId}/blobs/${speech.blobHash}`, {
      headers: authHeaders(editor.badge),
    });
    expect(wavBlobRes.status).toBe(200);
    const wavBytes = new Uint8Array(await wavBlobRes.arrayBuffer());
    expect(new TextDecoder().decode(wavBytes.subarray(0, 4))).toBe("RIFF");
    expect(new TextDecoder().decode(wavBytes.subarray(8, 12))).toBe("WAVE");

    const snap2 = await daemon.engine.getSnapshot(canvasId);
    const speechItem = snap2.canvas.items[speech.itemId]!;
    expect(speechItem.properties[AUDIO_PROPS.kind]).toBe("speech");
    expect(speechItem.properties[AUDIO_PROPS.voice]).toBe("Puck");
    expect(speechItem.properties[CREDENTIAL_REF_PROP]).toBe(`user:${editor.actor.id}:gemini:v1`);

    // 3) POST /api/m/audio/transcribe on the speech item
    const transRes = await fetch(`${base}${AUDIO_TRANSCRIBE_ROUTE}`, {
      method: "POST",
      headers: authHeaders(editor.badge, true),
      body: JSON.stringify({
        canvasId,
        itemId: speech.itemId,
        actor: editor.actor,
      }),
    });
    expect(transRes.status).toBe(200);
    const trans = (await transRes.json()) as AudioTranscribeResponse;
    expect(trans.itemId).toBe(speech.itemId);
    expect(trans.model).toBe(modelFor("transcribe").id);
    expect(trans.transcript).toBe("Welcome to the Acme studio tour.");
    expect(trans.credentialRef).toBe(`user:${editor.actor.id}:gemini:v1`);
    expect(calls[2]!.url).toContain(`/models/${encodeURIComponent(modelFor("transcribe").id)}:generateContent`);

    const snap3 = await daemon.engine.getSnapshot(canvasId);
    const updatedSpeech = snap3.canvas.items[speech.itemId]!;
    expect(updatedSpeech.properties[AUDIO_PROPS.transcript]).toBe("Welcome to the Acme studio tour.");
    expect(updatedSpeech.properties["agentDescription"]).toBe("Welcome to the Acme studio tour.");
    expect(updatedSpeech.properties[CREDENTIAL_REF_PROP]).toBe(`user:${editor.actor.id}:gemini:v1`);

    const pieces = audioModule.contextPieces?.(snap3.canvas) ?? [];
    expect(pieces).toHaveLength(1);
    expect(pieces[0]!.name).toBe("Audio transcripts");
    expect(pieces[0]!.size).toContain("Welcome to the Acme studio tour.");
  });

  it("scrubs Gemini API keys from upstream HTTP errors and network failures", async () => {
    const home = await mkHome();
    const SECRET_KEY = "acme-SECRET-AUDIO-KEY-NEVER-LEAK-999";
    let mode: "http" | "throw" = "http";

    const fakeFetch: typeof fetch = async () => {
      if (mode === "http") {
        return new Response(
          JSON.stringify({ error: { message: `quota exceeded for key ${SECRET_KEY}` } }),
          { status: 429, headers: { "content-type": "application/json" } },
        );
      }
      throw new Error(`connection dropped sending key=${SECRET_KEY}`);
    };

    const daemon = await boot(home, {
      modules: {
        audio: {
          key: () => SECRET_KEY,
          fetch: fakeFetch,
        },
      },
    });
    const base = daemonBase(daemon);
    const editor = await mintEditor(base, "test:acme-audio-scrub");
    const canvasId = await createCanvas(base, editor.badge, editor.actor);

    const err1 = await fetch(`${base}${AUDIO_MUSIC_ROUTE}`, {
      method: "POST",
      headers: authHeaders(editor.badge, true),
      body: JSON.stringify({ canvasId, prompt: "Acme lo-fi beat", actor: editor.actor }),
    });
    expect(err1.status).toBe(502);
    const text1 = await err1.text();
    expect(text1).not.toContain(SECRET_KEY);
    expect(text1).toContain("[key]");

    mode = "throw";
    const err2 = await fetch(`${base}${AUDIO_SPEAK_ROUTE}`, {
      method: "POST",
      headers: authHeaders(editor.badge, true),
      body: JSON.stringify({ canvasId, text: "Acme voice line", actor: editor.actor }),
    });
    expect(err2.status).toBe(502);
    const text2 = await err2.text();
    expect(text2).not.toContain(SECRET_KEY);
    expect(text2).toContain("[key]");
  });
});
