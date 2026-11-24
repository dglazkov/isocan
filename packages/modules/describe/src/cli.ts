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
import { DESCRIBE_ROUTE, describeModule, type DescribeItemResponse } from "./core.ts";

/** Resolve an item id, `#id`, prefix, or exact title on `canvas` (used by MCP tools). */
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
  const describe = host.program
    .command("describe")
    .description("Generate and store a caption-first agentDescription on a canvas item");

  describe
    .command("item <item>", { isDefault: true })
    .description("Describe an image, video, document, or screen item for agents")
    .option("--canvas <canvas>")
    .action(
      host.run(async (ref: string, _opts: { canvas?: string }, cmd: Command) => {
        const ctx = await host.ctxOf(cmd);
        const canvas = await host.resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(canvas.id);
        const item = host.resolveItem(snapshot, ref.replace(/^#/, ""));
        const answer = await ctx.client.moduleRequest<DescribeItemResponse>("POST", DESCRIBE_ROUTE, {
          canvasId: canvas.id,
          itemId: item.id,
          actor: ctx.actor,
        });
        if (ctx.json) return host.printJson(answer);
        console.log(`${answer.itemId} (${answer.model}, ${answer.credentialRef})`);
        console.log(answer.agentDescription);
      }),
    );
}

export const describeCli: CliModule = {
  core: describeModule,
  register,
  guide: guideText,
  tools: [
    {
      name: "item",
      title: "Describe an item for agents",
      description:
        "Generate a caption-first agentDescription for an image, video, document, or screen item on the canvas and save it on the item's properties. The same act as `isocan describe <item>`.",
      inputSchema: {
        item: z.string().trim().min(1).describe("Item id or unique title to describe."),
      },
      run: async ({ item: ref }: { item: string }, host) => {
        const canvas = await host.canvas();
        const snapshot = await canvas.ctx.client.snapshot(canvas.id);
        const resolved = resolveItemRef(snapshot.canvas, ref);
        return canvas.ctx.client.moduleRequest<DescribeItemResponse>(
          "POST",
          DESCRIBE_ROUTE,
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

export default describeCli;
