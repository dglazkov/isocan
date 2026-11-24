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

import { z } from "zod";
import type { Command } from "commander";
import type { CanvasContents, Item } from "@isocan/core";
import type { CliHost, CliModule } from "@isocan/cli/modulehost";
import guideText from "../agent-guide.md";
import {
  AUDIO_MUSIC_QUALITIES,
  AUDIO_MUSIC_ROUTE,
  AUDIO_SPEAK_ROUTE,
  AUDIO_TRANSCRIBE_ROUTE,
  DEFAULT_AUDIO_VOICE,
  audioModule,
  validateAudioText,
  type AudioMusicQuality,
  type AudioMusicResponse,
  type AudioSpeakResponse,
  type AudioTranscribeResponse,
} from "./core.ts";

function resolveItemRef(canvas: CanvasContents, rawRef: string): Item {
  const ref = rawRef.trim().replace(/^#/, "");
  if (canvas.items[ref]) return canvas.items[ref]!;
  const items = Object.values(canvas.items);
  const byTitle = items.filter((i) => i.title.toLowerCase() === ref.toLowerCase());
  if (byTitle.length === 1) return byTitle[0]!;
  const byPrefix = items.filter((i) => i.id.startsWith(ref));
  if (byPrefix.length === 1) return byPrefix[0]!;
  if (byTitle.length > 1 || byPrefix.length > 1) {
    throw new Error(`ambiguous item reference "${rawRef}" — pass the full item id`);
  }
  throw new Error(`no item "${rawRef}" on this canvas`);
}

function register(host: CliHost): void {
  const audio = host.program
    .command("audio")
    .description("Generate music or spoken audio clips and transcribe audio items on this canvas");

  audio
    .command("music <prompt>")
    .description("Generate a music clip with Lyria 3 and place it on the canvas")
    .option("--quality <clip|pro>", `music quality tier (${AUDIO_MUSIC_QUALITIES.join("|")})`)
    .option("--canvas <canvas>")
    .action(
      host.run(async (rawPrompt: string, opts: { quality?: string; canvas?: string }, cmd: Command) => {
        const check = validateAudioText(rawPrompt, "prompt");
        if (!check.ok) throw new Error(check.error);
        if (opts.quality && !(AUDIO_MUSIC_QUALITIES as readonly string[]).includes(opts.quality)) {
          throw new Error(`--quality must be one of ${AUDIO_MUSIC_QUALITIES.join(", ")}`);
        }
        const ctx = await host.ctxOf(cmd);
        const canvas = await host.resolveCanvas(ctx);
        const answer = await ctx.client.moduleRequest<AudioMusicResponse>("POST", AUDIO_MUSIC_ROUTE, {
          canvasId: canvas.id,
          prompt: check.value,
          ...(opts.quality ? { quality: opts.quality as AudioMusicQuality } : {}),
          actor: ctx.actor,
        });
        if (ctx.json) return host.printJson(answer);
        console.log(`${answer.itemId} (${answer.mimeType}, ${answer.model}, ${answer.credentialRef})`);
      }),
    );

  audio
    .command("speak <text>")
    .description("Synthesize spoken audio with Gemini TTS and place it on the canvas")
    .option("--voice <name>", `voice name (default: ${DEFAULT_AUDIO_VOICE})`)
    .option("--style <style>", "optional delivery style instruction")
    .option("--canvas <canvas>")
    .action(
      host.run(async (rawText: string, opts: { voice?: string; style?: string; canvas?: string }, cmd: Command) => {
        const check = validateAudioText(rawText, "text");
        if (!check.ok) throw new Error(check.error);
        const ctx = await host.ctxOf(cmd);
        const canvas = await host.resolveCanvas(ctx);
        const answer = await ctx.client.moduleRequest<AudioSpeakResponse>("POST", AUDIO_SPEAK_ROUTE, {
          canvasId: canvas.id,
          text: check.value,
          ...(opts.voice?.trim() ? { voice: opts.voice.trim() } : {}),
          ...(opts.style?.trim() ? { style: opts.style.trim() } : {}),
          actor: ctx.actor,
        });
        if (ctx.json) return host.printJson(answer);
        console.log(`${answer.itemId} (${answer.voice}, ${answer.mimeType}, ${answer.model}, ${answer.credentialRef})`);
      }),
    );

  audio
    .command("transcribe <item>")
    .description("Transcribe an audio item and store audio.transcript + agentDescription")
    .option("--canvas <canvas>")
    .action(
      host.run(async (ref: string, _opts: { canvas?: string }, cmd: Command) => {
        const ctx = await host.ctxOf(cmd);
        const canvas = await host.resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(canvas.id);
        const item = host.resolveItem(snapshot, ref.replace(/^#/, ""));
        const answer = await ctx.client.moduleRequest<AudioTranscribeResponse>("POST", AUDIO_TRANSCRIBE_ROUTE, {
          canvasId: canvas.id,
          itemId: item.id,
          actor: ctx.actor,
        });
        if (ctx.json) return host.printJson(answer);
        console.log(`${answer.itemId} (${answer.model}, ${answer.credentialRef})`);
        console.log(answer.transcript);
      }),
    );
}

export const audioCli: CliModule = {
  core: audioModule,
  register,
  guide: guideText,
  tools: [
    {
      name: "music",
      title: "Generate a music clip",
      description:
        "Generate a music clip with Lyria 3 from a text prompt and place it on the canvas as an audio item. The same act as `isocan audio music`.",
      inputSchema: {
        prompt: z.string().trim().min(1).describe("Prompt describing the music style, mood, instruments, or tempo."),
        quality: z.enum(AUDIO_MUSIC_QUALITIES).optional().describe("Optional quality tier: clip (default) or pro."),
      },
      run: async ({ prompt, quality }: { prompt: string; quality?: AudioMusicQuality }, host) => {
        const check = validateAudioText(prompt, "prompt");
        if (!check.ok) throw new Error(check.error);
        const canvas = await host.canvas();
        return canvas.ctx.client.moduleRequest<AudioMusicResponse>(
          "POST",
          AUDIO_MUSIC_ROUTE,
          {
            canvasId: canvas.id,
            prompt: check.value,
            ...(quality ? { quality } : {}),
            actor: canvas.ctx.actor,
          },
          host.signal,
        );
      },
    },
    {
      name: "speak",
      title: "Synthesize speech audio",
      description:
        "Synthesize spoken text using Gemini TTS and place the resulting audio clip on the canvas. The same act as `isocan audio speak`.",
      inputSchema: {
        text: z.string().trim().min(1).describe("Exact words to speak verbatim."),
        voice: z.string().trim().min(1).optional().describe(`Optional Gemini TTS voice name (default: ${DEFAULT_AUDIO_VOICE}).`),
        style: z.string().trim().min(1).optional().describe("Optional delivery style instruction."),
      },
      run: async ({ text, voice, style }: { text: string; voice?: string; style?: string }, host) => {
        const check = validateAudioText(text, "text");
        if (!check.ok) throw new Error(check.error);
        const canvas = await host.canvas();
        return canvas.ctx.client.moduleRequest<AudioSpeakResponse>(
          "POST",
          AUDIO_SPEAK_ROUTE,
          {
            canvasId: canvas.id,
            text: check.value,
            ...(voice ? { voice } : {}),
            ...(style ? { style } : {}),
            actor: canvas.ctx.actor,
          },
          host.signal,
        );
      },
    },
    {
      name: "transcribe",
      title: "Transcribe an audio item",
      description:
        "Transcribe an audio item on the canvas and save audio.transcript and agentDescription onto its properties. The same act as `isocan audio transcribe`.",
      inputSchema: {
        item: z.string().trim().min(1).describe("Audio item id or unique title to transcribe."),
      },
      run: async ({ item: ref }: { item: string }, host) => {
        const canvas = await host.canvas();
        const snapshot = await canvas.ctx.client.snapshot(canvas.id);
        const resolved = resolveItemRef(snapshot.canvas, ref);
        return canvas.ctx.client.moduleRequest<AudioTranscribeResponse>(
          "POST",
          AUDIO_TRANSCRIBE_ROUTE,
          {
            canvasId: canvas.id,
            itemId: resolved.id,
            actor: canvas.ctx.actor,
          },
          host.signal,
        );
      },
    },
  ],
};

export default audioCli;
