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
  DESIGN_CRITIQUE_ROUTE,
  DESIGN_MOCKUPS_ROUTE,
  DESIGN_SYSTEM_ROUTE,
  designSystemModule,
  type DesignCritiqueResponse,
  type DesignMockupsResponse,
  type DesignSystemResponse,
} from "./core.ts";

function resolveItemRef(canvas: CanvasContents, rawRef: string): Item {
  const ref = rawRef.trim().replace(/^#/, "");
  if (canvas.items[ref]) return canvas.items[ref]!;
  const items = Object.values(canvas.items);
  const byTitle = items.filter((i) => i.title.toLowerCase() === ref.toLowerCase());
  if (byTitle.length === 1) return byTitle[0]!;
  const byPrefix = items.filter((i) => i.id.startsWith(ref));
  if (byPrefix.length === 1) return byPrefix[0]!;
  throw new Error(`no unique item "${rawRef}" on this canvas`);
}

function register(host: CliHost): void {
  const ds = host.program
    .command("design-system")
    .description("Generate design systems, run fresh-context critiques, and create direction mockups");

  ds.command("system <prompt>")
    .description("Generate a DesignSystemSpec sticker sheet and DESIGN.md item")
    .option("--title <title>", "custom design system title")
    .option("--canvas <canvas>")
    .action(
      host.run(async (prompt: string, opts: { title?: string; canvas?: string }, cmd: Command) => {
        const ctx = await host.ctxOf(cmd);
        const canvas = await host.resolveCanvas(ctx);
        const answer = await ctx.client.moduleRequest<DesignSystemResponse>("POST", DESIGN_SYSTEM_ROUTE, {
          canvasId: canvas.id,
          prompt,
          ...(opts.title ? { title: opts.title } : {}),
          actor: ctx.actor,
        });
        if (ctx.json) return host.printJson(answer);
        console.log(`system ${answer.systemItemId} · DESIGN.md ${answer.designMdItemId} (${answer.model})`);
      }),
    );

  ds.command("critique <item>")
    .description("Run a fresh-context design critique of an item and add a derived review item")
    .option("--system <item>", "optional design system item to critique against")
    .option("--canvas <canvas>")
    .action(
      host.run(async (ref: string, opts: { system?: string; canvas?: string }, cmd: Command) => {
        const ctx = await host.ctxOf(cmd);
        const canvas = await host.resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(canvas.id);
        const item = host.resolveItem(snapshot, ref.replace(/^#/, ""));
        const systemItem = opts.system ? host.resolveItem(snapshot, opts.system.replace(/^#/, "")) : undefined;
        const answer = await ctx.client.moduleRequest<DesignCritiqueResponse>("POST", DESIGN_CRITIQUE_ROUTE, {
          canvasId: canvas.id,
          itemId: item.id,
          ...(systemItem ? { systemItemId: systemItem.id } : {}),
          actor: ctx.actor,
        });
        if (ctx.json) return host.printJson(answer);
        console.log(`critique ${answer.reviewItemId} -> ${answer.targetItemId} (${answer.model})`);
      }),
    );

  ds.command("mockups <systemItem>")
    .description("Generate 2-4 HTML direction mockups linked to a design system item")
    .option("--count <n>", "number of directions (2-4)", "3")
    .option("--prompt <prompt>", "optional screen goal")
    .option("--canvas <canvas>")
    .action(
      host.run(async (ref: string, opts: { count?: string; prompt?: string; canvas?: string }, cmd: Command) => {
        const ctx = await host.ctxOf(cmd);
        const canvas = await host.resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(canvas.id);
        const systemItem = host.resolveItem(snapshot, ref.replace(/^#/, ""));
        const answer = await ctx.client.moduleRequest<DesignMockupsResponse>("POST", DESIGN_MOCKUPS_ROUTE, {
          canvasId: canvas.id,
          systemItemId: systemItem.id,
          count: Number(opts.count ?? 3),
          ...(opts.prompt ? { prompt: opts.prompt } : {}),
          actor: ctx.actor,
        });
        if (ctx.json) return host.printJson(answer);
        console.log(`mockups (${answer.mockupItemIds.length}): ${answer.mockupItemIds.join(", ")}`);
      }),
    );
}

export const designSystemCli: CliModule = {
  core: designSystemModule,
  register,
  guide: guideText,
  tools: [
    {
      name: "system",
      title: "Generate a design system and DESIGN.md",
      description:
        "Generate a structured DesignSystemSpec sticker-sheet item and compiled DESIGN.md markdown item on the canvas from a brief.",
      inputSchema: {
        prompt: z.string().trim().min(1).describe("Design direction brief for the system."),
        title: z.string().trim().min(1).optional().describe("Optional title for the design system."),
      },
      run: async ({ prompt, title }: { prompt: string; title?: string }, host) => {
        const canvas = await host.canvas();
        return canvas.ctx.client.moduleRequest<DesignSystemResponse>(
          "POST",
          DESIGN_SYSTEM_ROUTE,
          { canvasId: canvas.id, prompt, ...(title ? { title } : {}), actor: canvas.ctx.actor },
          host.signal,
        );
      },
    },
    {
      name: "critique",
      title: "Run a fresh-context design critique",
      description:
        "Run a fresh-context design review of an item on the canvas and land a derived Markdown critique item with parent provenance.",
      inputSchema: {
        item: z.string().trim().min(1).describe("Item id or unique title to critique."),
        systemItem: z.string().trim().min(1).optional().describe("Optional design system item id or title."),
      },
      run: async ({ item: ref, systemItem }: { item: string; systemItem?: string }, host) => {
        const canvas = await host.canvas();
        const snapshot = await canvas.ctx.client.snapshot(canvas.id);
        const target = resolveItemRef(snapshot.canvas, ref);
        const sys = systemItem ? resolveItemRef(snapshot.canvas, systemItem) : undefined;
        return canvas.ctx.client.moduleRequest<DesignCritiqueResponse>(
          "POST",
          DESIGN_CRITIQUE_ROUTE,
          {
            canvasId: canvas.id,
            itemId: target.id,
            ...(sys ? { systemItemId: sys.id } : {}),
            actor: canvas.ctx.actor,
          },
          host.signal,
        );
      },
    },
    {
      name: "mockups",
      title: "Generate design direction mockups",
      description:
        "Generate 2 to 4 HTML direction mockup screens linked to an existing design system item on the canvas.",
      inputSchema: {
        systemItem: z.string().trim().min(1).describe("Design system item id or unique title."),
        prompt: z.string().trim().min(1).optional().describe("Optional product or screen goal."),
        count: z.number().int().min(2).max(4).optional().describe("Number of mockups (2-4)."),
      },
      run: async ({ systemItem: ref, prompt, count }: { systemItem: string; prompt?: string; count?: number }, host) => {
        const canvas = await host.canvas();
        const snapshot = await canvas.ctx.client.snapshot(canvas.id);
        const sys = resolveItemRef(snapshot.canvas, ref);
        return canvas.ctx.client.moduleRequest<DesignMockupsResponse>(
          "POST",
          DESIGN_MOCKUPS_ROUTE,
          {
            canvasId: canvas.id,
            systemItemId: sys.id,
            ...(prompt ? { prompt } : {}),
            ...(count !== undefined ? { count } : {}),
            actor: canvas.ctx.actor,
          },
          host.signal,
        );
      },
    },
  ],
};

export default designSystemCli;
