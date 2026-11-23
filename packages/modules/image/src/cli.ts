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
  IMAGE_GENERATE_ROUTE,
  imageModule,
  validateImagePrompt,
  type ImageGenerateResponse,
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

interface ImageGenerateOpts {
  edit?: string;
  model?: string;
  idempotencyKey?: string;
  canvas?: string;
}

function register(host: CliHost): void {
  const image = host.program
    .command("image")
    .description("Generate or edit a single image on this canvas");

  image
    .command("generate <prompt>", { isDefault: true })
    .description("Generate a new image or edit an existing item in place")
    .option("--edit <item>", "existing image item to edit (stacks a new version)")
    .option("--model <id>", "override the default image model")
    .option("--idempotency-key <key>", "optional deduplication key for retries")
    .option("--canvas <canvas>")
    .action(
      host.run(async (rawPrompt: string, opts: ImageGenerateOpts, cmd: Command) => {
        const promptCheck = validateImagePrompt(rawPrompt);
        if (!promptCheck.ok) throw new Error(promptCheck.error);

        const ctx = await host.ctxOf(cmd);
        const canvas = await host.resolveCanvas(ctx);
        let editItem: string | undefined;
        if (opts.edit) {
          const snapshot = await ctx.client.snapshot(canvas.id);
          editItem = host.resolveItem(snapshot, opts.edit.replace(/^#/, "")).id;
        }

        const answer = await ctx.client.moduleRequest<ImageGenerateResponse>("POST", IMAGE_GENERATE_ROUTE, {
          canvasId: canvas.id,
          prompt: promptCheck.prompt,
          ...(editItem ? { editItem } : {}),
          ...(opts.model?.trim() ? { model: opts.model.trim() } : {}),
          ...(opts.idempotencyKey?.trim() ? { idempotencyKey: opts.idempotencyKey.trim() } : {}),
          actor: ctx.actor,
        });

        if (ctx.json) return host.printJson(answer);
        console.log(`${answer.itemId} (${answer.versionId}, ${answer.mimeType}, ${answer.model}, ${answer.credentialRef})`);
      }),
    );
}

export const imageCli: CliModule = {
  core: imageModule,
  register,
  guide: guideText,
  tools: [
    {
      name: "generate",
      title: "Generate or edit an image",
      description:
        "Generate a single image on this canvas from a prompt, or pass `editItem` to stack an edited version onto an existing image item. The same act as `isocan image`.",
      inputSchema: {
        prompt: z.string().trim().min(1).describe("Prompt describing the image to generate or the edit to apply."),
        editItem: z.string().trim().min(1).optional().describe("Optional item id or unique title to edit in place."),
        model: z.string().trim().min(1).optional().describe("Optional image model id override."),
        idempotencyKey: z.string().trim().min(1).optional().describe("Optional idempotency key to deduplicate retries."),
      },
      run: async (
        {
          prompt,
          editItem,
          model,
          idempotencyKey,
        }: { prompt: string; editItem?: string; model?: string; idempotencyKey?: string },
        host,
      ) => {
        const promptCheck = validateImagePrompt(prompt);
        if (!promptCheck.ok) throw new Error(promptCheck.error);
        const canvas = await host.canvas();
        let resolvedEdit: string | undefined;
        if (editItem) {
          const snapshot = await canvas.ctx.client.snapshot(canvas.id);
          resolvedEdit = resolveItemRef(snapshot.canvas, editItem).id;
        }
        return canvas.ctx.client.moduleRequest<ImageGenerateResponse>(
          "POST",
          IMAGE_GENERATE_ROUTE,
          {
            canvasId: canvas.id,
            prompt: promptCheck.prompt,
            ...(resolvedEdit ? { editItem: resolvedEdit } : {}),
            ...(model ? { model } : {}),
            ...(idempotencyKey ? { idempotencyKey } : {}),
            actor: canvas.ctx.actor,
          },
          host.signal,
        );
      },
    },
  ],
};

export default imageCli;
