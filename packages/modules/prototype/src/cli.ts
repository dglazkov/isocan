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
import type { CliHost, CliModule } from "@isocan/cli/modulehost";
import guideText from "../agent-guide.md";
import {
  PROTOTYPE_BUILD_ROUTE,
  PROTOTYPE_TIERS,
  isPrototypeTier,
  prototypeModule,
  type PrototypeBuildResponse,
  type PrototypeTier,
} from "./core.ts";

function register(host: CliHost): void {
  const proto = host.program
    .command("prototype")
    .description("Build sandboxed HTML prototypes across quick, standard, and app tiers");

  proto
    .command("build <prompt>")
    .description("Build a sandboxed HTML prototype (or delegate app-tier builds to a workbench session)")
    .option("--tier <tier>", `prototype tier (${PROTOTYPE_TIERS.join("|")})`, "quick")
    .option("--title <title>", "custom screen title")
    .option("--canvas <canvas>")
    .action(
      host.run(async (prompt: string, opts: { tier?: string; title?: string; canvas?: string }, cmd: Command) => {
        const tier: PrototypeTier = isPrototypeTier(opts.tier) ? opts.tier : "quick";
        const ctx = await host.ctxOf(cmd);
        const canvas = await host.resolveCanvas(ctx);
        const answer = await ctx.client.moduleRequest<PrototypeBuildResponse>("POST", PROTOTYPE_BUILD_ROUTE, {
          canvasId: canvas.id,
          prompt,
          tier,
          ...(opts.title ? { title: opts.title } : {}),
          actor: ctx.actor,
        });
        if (ctx.json) return host.printJson(answer);
        if (answer.delegated) {
          console.log(`delegated (${answer.tier}) -> ${answer.route}: ${answer.hint}`);
          return;
        }
        console.log(`built ${answer.tier} prototype ${answer.itemId}@${answer.versionId} (${answer.model})`);
      }),
    );
}

export const prototypeCli: CliModule = {
  core: prototypeModule,
  register,
  guide: guideText,
  tools: [
    {
      name: "build",
      title: "Build a sandboxed HTML prototype",
      description:
        "Generate a self-contained HTML screen prototype for quick/standard tiers or return the delegated workbench route for app-tier builds.",
      inputSchema: {
        prompt: z.string().trim().min(1).describe("Product or UI prompt for the prototype."),
        tier: z.enum(PROTOTYPE_TIERS).optional().describe("Prototype tier: quick, standard, or app."),
        title: z.string().trim().min(1).optional().describe("Optional title for the screen item."),
      },
      run: async ({ prompt, tier, title }: { prompt: string; tier?: PrototypeTier; title?: string }, host) => {
        const canvas = await host.canvas();
        return canvas.ctx.client.moduleRequest<PrototypeBuildResponse>(
          "POST",
          PROTOTYPE_BUILD_ROUTE,
          {
            canvasId: canvas.id,
            prompt,
            ...(tier ? { tier } : {}),
            ...(title ? { title } : {}),
            actor: canvas.ctx.actor,
          },
          host.signal,
        );
      },
    },
  ],
};

export default prototypeCli;
