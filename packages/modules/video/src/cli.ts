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
  validateVideoDuration,
  validateVideoPrompt,
  VIDEO_DURATIONS,
  VIDEO_GENERATE_ROUTE,
  videoModule,
  type VideoGenerateResponse,
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

interface VideoGenerateOpts {
  from?: string;
  model?: string;
  duration?: string;
  canvas?: string;
}

function register(host: CliHost): void {
  const video = host.program
    .command("video")
    .description("Start home-polled async video generation jobs on this canvas");

  video
    .command("generate <prompt>", { isDefault: true })
    .description("Generate a video clip as a home-polled async job (returns immediately)")
    .option("--from <item>", "source image or item to animate or derive from")
    .option("--model <id>", "override the default video model")
    .option("--duration <seconds>", `clip length in seconds (${VIDEO_DURATIONS.join("|")})`)
    .option("--canvas <canvas>")
    .action(
      host.run(async (rawPrompt: string, opts: VideoGenerateOpts, cmd: Command) => {
        const promptCheck = validateVideoPrompt(rawPrompt);
        if (!promptCheck.ok) throw new Error(promptCheck.error);
        const durationCheck = validateVideoDuration(opts.duration);
        if (!durationCheck.ok) throw new Error(durationCheck.error);

        const ctx = await host.ctxOf(cmd);
        const canvas = await host.resolveCanvas(ctx);
        let fromItem: string | undefined;
        if (opts.from) {
          const snapshot = await ctx.client.snapshot(canvas.id);
          fromItem = host.resolveItem(snapshot, opts.from.replace(/^#/, "")).id;
        }

        const answer = await ctx.client.moduleRequest<VideoGenerateResponse>("POST", VIDEO_GENERATE_ROUTE, {
          canvasId: canvas.id,
          prompt: promptCheck.prompt,
          ...(fromItem ? { fromItem } : {}),
          ...(opts.model?.trim() ? { model: opts.model.trim() } : {}),
          ...(durationCheck.durationSeconds !== undefined ? { durationSeconds: durationCheck.durationSeconds } : {}),
          actor: ctx.actor,
        });

        if (ctx.json) return host.printJson(answer);
        console.log(`video job started: ${answer.job.id} (${answer.job.state}, model ${answer.job.model})`);
        console.log(`  item:   ${answer.itemId}`);
        console.log(`  check:  isocan job status ${answer.job.id}`);
      }),
    );
}

export const videoCli: CliModule = {
  core: videoModule,
  register,
  guide: guideText,
  tools: [
    {
      name: "generate",
      title: "Generate a video clip",
      description:
        "Start a home-polled async video generation job on this canvas. Immediately creates a placeholder item and returns `{ job, itemId }`; the home polls in the background and lands the finished MP4 as a new version. The same act as `isocan video`.",
      inputSchema: {
        prompt: z.string().trim().min(1).describe("Prompt describing the video clip to generate."),
        fromItem: z.string().trim().min(1).optional().describe("Optional item id or title to animate or derive from."),
        model: z.string().trim().min(1).optional().describe("Optional video model id override."),
      },
      run: async (
        { prompt, fromItem, model }: { prompt: string; fromItem?: string; model?: string },
        host,
      ) => {
        const promptCheck = validateVideoPrompt(prompt);
        if (!promptCheck.ok) throw new Error(promptCheck.error);
        const canvas = await host.canvas();
        let resolvedFrom: string | undefined;
        if (fromItem) {
          const snapshot = await canvas.ctx.client.snapshot(canvas.id);
          resolvedFrom = resolveItemRef(snapshot.canvas, fromItem).id;
        }
        return canvas.ctx.client.moduleRequest<VideoGenerateResponse>(
          "POST",
          VIDEO_GENERATE_ROUTE,
          {
            canvasId: canvas.id,
            prompt: promptCheck.prompt,
            ...(resolvedFrom ? { fromItem: resolvedFrom } : {}),
            ...(model ? { model } : {}),
            actor: canvas.ctx.actor,
          },
          host.signal,
        );
      },
    },
  ],
};

export default videoCli;
