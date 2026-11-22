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
  MEDIA_EDIT_FRAMES_ROUTE,
  MEDIA_EDIT_MUX_ROUTE,
  MEDIA_EDIT_STITCH_ROUTE,
  MEDIA_EDIT_TRIM_ROUTE,
  mediaEditModule,
  type ClipFramesResponse,
  type ClipOutputResponse,
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
  const clip = host.program
    .command("clip")
    .description("Trim, stitch, mux, or extract frames from video and audio items on this canvas");

  clip
    .command("trim <item>")
    .description("Trim a video or audio item between --start and --end seconds")
    .requiredOption("--start <seconds>", "start timestamp in seconds")
    .requiredOption("--end <seconds>", "end timestamp in seconds")
    .option("--canvas <canvas>")
    .action(
      host.run(async (ref: string, opts: { start: string; end: string; canvas?: string }, cmd: Command) => {
        const startSec = Number(opts.start);
        const endSec = Number(opts.end);
        if (!Number.isFinite(startSec) || startSec < 0) throw new Error("--start must be a non-negative number");
        if (!Number.isFinite(endSec) || endSec <= startSec) throw new Error("--end must be greater than --start");

        const ctx = await host.ctxOf(cmd);
        const canvas = await host.resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(canvas.id);
        const item = host.resolveItem(snapshot, ref.replace(/^#/, ""));

        const answer = await ctx.client.moduleRequest<ClipOutputResponse>("POST", MEDIA_EDIT_TRIM_ROUTE, {
          canvasId: canvas.id,
          itemId: item.id,
          startSec,
          endSec,
          actor: ctx.actor,
        });
        if (ctx.json) return host.printJson(answer);
        console.log(`${answer.itemId} (trimmed ${startSec}s–${endSec}s, ${answer.mimeType})`);
      }),
    );

  clip
    .command("stitch <items...>")
    .description("Concatenate two or more video or audio items in order")
    .option("--canvas <canvas>")
    .action(
      host.run(async (refs: string[], _opts: { canvas?: string }, cmd: Command) => {
        if (refs.length < 2) throw new Error("stitch requires at least two items");
        const ctx = await host.ctxOf(cmd);
        const canvas = await host.resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(canvas.id);
        const itemIds = refs.map((r) => host.resolveItem(snapshot, r.replace(/^#/, "")).id);

        const answer = await ctx.client.moduleRequest<ClipOutputResponse>("POST", MEDIA_EDIT_STITCH_ROUTE, {
          canvasId: canvas.id,
          itemIds,
          actor: ctx.actor,
        });
        if (ctx.json) return host.printJson(answer);
        console.log(`${answer.itemId} (stitched ${itemIds.length} clips, ${answer.mimeType})`);
      }),
    );

  clip
    .command("mux <video> <audio>")
    .description("Mux a video item and an audio item into a single clip")
    .option("--canvas <canvas>")
    .action(
      host.run(async (videoRef: string, audioRef: string, _opts: { canvas?: string }, cmd: Command) => {
        const ctx = await host.ctxOf(cmd);
        const canvas = await host.resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(canvas.id);
        const videoItemId = host.resolveItem(snapshot, videoRef.replace(/^#/, "")).id;
        const audioItemId = host.resolveItem(snapshot, audioRef.replace(/^#/, "")).id;

        const answer = await ctx.client.moduleRequest<ClipOutputResponse>("POST", MEDIA_EDIT_MUX_ROUTE, {
          canvasId: canvas.id,
          videoItemId,
          audioItemId,
          actor: ctx.actor,
        });
        if (ctx.json) return host.printJson(answer);
        console.log(`${answer.itemId} (muxed ${videoItemId} + ${audioItemId}, ${answer.mimeType})`);
      }),
    );

  clip
    .command("frames <item>")
    .description("Extract still PNG frames from a video item onto the canvas")
    .option("--fps <number>", "frames per second to extract (default: 1)")
    .option("--canvas <canvas>")
    .action(
      host.run(async (ref: string, opts: { fps?: string; canvas?: string }, cmd: Command) => {
        const fps = opts.fps !== undefined ? Number(opts.fps) : undefined;
        if (fps !== undefined && (!Number.isFinite(fps) || fps <= 0 || fps > 30)) {
          throw new Error("--fps must be a number between 0 and 30");
        }
        const ctx = await host.ctxOf(cmd);
        const canvas = await host.resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(canvas.id);
        const item = host.resolveItem(snapshot, ref.replace(/^#/, ""));

        const answer = await ctx.client.moduleRequest<ClipFramesResponse>("POST", MEDIA_EDIT_FRAMES_ROUTE, {
          canvasId: canvas.id,
          itemId: item.id,
          ...(fps !== undefined ? { fps } : {}),
          actor: ctx.actor,
        });
        if (ctx.json) return host.printJson(answer);
        console.log(`extracted ${answer.itemIds.length} frame(s): ${answer.itemIds.join(", ")}`);
      }),
    );
}

export const mediaEditCli: CliModule = {
  core: mediaEditModule,
  register,
  guide: guideText,
  tools: [
    {
      name: "trim",
      title: "Trim a media clip",
      description:
        "Trim a video or audio item on this canvas between `startSec` and `endSec`, landing a derived clip with `parent` provenance. The same act as `isocan clip trim`.",
      inputSchema: {
        item: z.string().trim().min(1).describe("Item id or unique title of the video or audio clip to trim."),
        startSec: z.number().min(0).describe("Start timestamp in seconds."),
        endSec: z.number().positive().describe("End timestamp in seconds (must be greater than startSec)."),
      },
      run: async ({ item, startSec, endSec }: { item: string; startSec: number; endSec: number }, host) => {
        const canvas = await host.canvas();
        const snapshot = await canvas.ctx.client.snapshot(canvas.id);
        const resolved = resolveItemRef(snapshot.canvas, item);
        return canvas.ctx.client.moduleRequest<ClipOutputResponse>(
          "POST",
          MEDIA_EDIT_TRIM_ROUTE,
          { canvasId: canvas.id, itemId: resolved.id, startSec, endSec, actor: canvas.ctx.actor },
          host.signal,
        );
      },
    },
    {
      name: "stitch",
      title: "Stitch media clips",
      description:
        "Concatenate two or more video or audio items on this canvas in order into one derived clip with `parent` provenance. The same act as `isocan clip stitch`.",
      inputSchema: {
        items: z.array(z.string().trim().min(1)).min(2).describe("Ordered list of two or more item ids or unique titles to stitch."),
      },
      run: async ({ items }: { items: string[] }, host) => {
        const canvas = await host.canvas();
        const snapshot = await canvas.ctx.client.snapshot(canvas.id);
        const itemIds = items.map((r) => resolveItemRef(snapshot.canvas, r).id);
        return canvas.ctx.client.moduleRequest<ClipOutputResponse>(
          "POST",
          MEDIA_EDIT_STITCH_ROUTE,
          { canvasId: canvas.id, itemIds, actor: canvas.ctx.actor },
          host.signal,
        );
      },
    },
    {
      name: "mux",
      title: "Mux video and audio",
      description:
        "Combine a video item and an audio item on this canvas into one derived MP4 clip with `parent` provenance. The same act as `isocan clip mux`.",
      inputSchema: {
        videoItem: z.string().trim().min(1).describe("Video item id or unique title."),
        audioItem: z.string().trim().min(1).describe("Audio item id or unique title."),
      },
      run: async ({ videoItem, audioItem }: { videoItem: string; audioItem: string }, host) => {
        const canvas = await host.canvas();
        const snapshot = await canvas.ctx.client.snapshot(canvas.id);
        const videoItemId = resolveItemRef(snapshot.canvas, videoItem).id;
        const audioItemId = resolveItemRef(snapshot.canvas, audioItem).id;
        return canvas.ctx.client.moduleRequest<ClipOutputResponse>(
          "POST",
          MEDIA_EDIT_MUX_ROUTE,
          { canvasId: canvas.id, videoItemId, audioItemId, actor: canvas.ctx.actor },
          host.signal,
        );
      },
    },
    {
      name: "frames",
      title: "Extract video frames",
      description:
        "Extract still PNG frames from a video item onto the canvas at the requested frame rate, each carrying `parent` provenance. The same act as `isocan clip frames`.",
      inputSchema: {
        item: z.string().trim().min(1).describe("Video item id or unique title."),
        fps: z.number().positive().max(30).optional().describe("Optional frames per second to extract (default: 1)."),
      },
      run: async ({ item, fps }: { item: string; fps?: number }, host) => {
        const canvas = await host.canvas();
        const snapshot = await canvas.ctx.client.snapshot(canvas.id);
        const resolved = resolveItemRef(snapshot.canvas, item);
        return canvas.ctx.client.moduleRequest<ClipFramesResponse>(
          "POST",
          MEDIA_EDIT_FRAMES_ROUTE,
          { canvasId: canvas.id, itemId: resolved.id, ...(fps !== undefined ? { fps } : {}), actor: canvas.ctx.actor },
          host.signal,
        );
      },
    },
  ],
};

export default mediaEditCli;
