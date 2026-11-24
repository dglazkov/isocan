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
  RESEARCH_RUN_ROUTE,
  researchModule,
  validateResearchQuery,
  type ResearchRunResponse,
} from "./core.ts";

interface ResearchRunOpts {
  deep?: boolean;
  model?: string;
  canvas?: string;
}

function register(host: CliHost): void {
  const research = host.program
    .command("research")
    .description("Start home-polled grounded research jobs on this canvas");

  research
    .command("run <query>", { isDefault: true })
    .description("Run a grounded research job and land a cited Markdown report (returns immediately)")
    .option("--deep", "run a deeper multi-step research synthesis")
    .option("--model <id>", "override the default utility model")
    .option("--canvas <canvas>")
    .action(
      host.run(async (rawQuery: string, opts: ResearchRunOpts, cmd: Command) => {
        const queryCheck = validateResearchQuery(rawQuery);
        if (!queryCheck.ok) throw new Error(queryCheck.error);

        const ctx = await host.ctxOf(cmd);
        const canvas = await host.resolveCanvas(ctx);
        const answer = await ctx.client.moduleRequest<ResearchRunResponse>("POST", RESEARCH_RUN_ROUTE, {
          canvasId: canvas.id,
          query: queryCheck.query,
          ...(opts.deep ? { deep: true } : {}),
          ...(opts.model?.trim() ? { model: opts.model.trim() } : {}),
          actor: ctx.actor,
        });

        if (ctx.json) return host.printJson(answer);
        console.log(`research job started: ${answer.job.id} (${answer.job.state}, model ${answer.job.model})`);
        console.log(`  item:   ${answer.itemId}`);
        console.log(`  check:  isocan job status ${answer.job.id}`);
      }),
    );
}

export const researchCli: CliModule = {
  core: researchModule,
  register,
  guide: guideText,
  tools: [
    {
      name: "run",
      title: "Run a grounded research job",
      description:
        "Start a home-polled grounded research job on this canvas. Immediately creates a placeholder item and returns `{ job, itemId }`; the home polls in the background and lands a cited Markdown report as a new version. The same act as `isocan research`.",
      inputSchema: {
        query: z.string().trim().min(1).describe("Research question or topic to investigate."),
        deep: z.boolean().optional().describe("Set true for a deeper multi-step research synthesis."),
      },
      run: async ({ query, deep }: { query: string; deep?: boolean }, host) => {
        const queryCheck = validateResearchQuery(query);
        if (!queryCheck.ok) throw new Error(queryCheck.error);
        const canvas = await host.canvas();
        return canvas.ctx.client.moduleRequest<ResearchRunResponse>(
          "POST",
          RESEARCH_RUN_ROUTE,
          {
            canvasId: canvas.id,
            query: queryCheck.query,
            ...(deep ? { deep: true } : {}),
            actor: canvas.ctx.actor,
          },
          host.signal,
        );
      },
    },
  ],
};

export default researchCli;
