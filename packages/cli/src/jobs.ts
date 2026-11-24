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

import type { Command } from "commander";
import type { Ctx } from "./ctx.ts";
import { printJson, printTable } from "./output.ts";
import { onCanvas } from "./run.ts";

/**
 * **`isocan job` — inspect, cancel, and retry home-polled async jobs**
 * (Open Stitch phase 0.2; both surfaces rule).
 *
 * Jobs live on canvas items as `job.*` properties and are polled by the home
 * daemon rather than a browser tab. Retrying re-runs the stored `job.request`
 * on the same item (optionally swapping `--model`) so the new result stacks
 * as a new version without an agent turn.
 */
export function registerJobs(program: Command, ctxOf: (cmd: Command) => Promise<Ctx>): void {
  const job = program
    .command("job")
    .description("List, inspect, cancel, and retry home-polled async jobs on this canvas")
    .option("--canvas <canvas>")
    .addHelpText(
      "after",
      `
Slow generations run as home-polled jobs whose state lives on the item's \`job.*\`
properties so closing a tab never kills them.

  isocan job ls [--json]                # list jobs on the bound canvas
  isocan job status <jobId> [--json]    # inspect one job
  isocan job cancel <jobId>             # abandon an active job
  isocan job retry <jobId> [--model id] # re-run on the same item (stacks a version)`,
    );

  job
    .command("ls", { isDefault: true })
    .description("List async jobs on this canvas")
    .option("--canvas <canvas>")
    .action(
      onCanvas(ctxOf, async (handle, ctx) => {
        const res = await ctx.client.listJobs(handle.id);
        if (ctx.json) {
          printJson(res);
          return;
        }
        if (res.jobs.length === 0) {
          console.log(`no jobs on ${handle.id}`);
          return;
        }
        printTable(
          res.jobs.map((j) => ({
            id: j.id,
            state: j.state,
            kind: j.kind,
            model: j.model,
            progress: j.progress ?? (j.state === "done" ? "100%" : "—"),
            item: j.itemId,
            started: j.startedAt,
          })),
        );
      }),
    );

  job
    .command("status <jobId>")
    .description("Inspect one async job")
    .option("--canvas <canvas>")
    .action(
      onCanvas(ctxOf, async (handle, ctx, args) => {
        const jobId = String(args[0] ?? "").trim();
        const res = await ctx.client.getJob(handle.id, jobId);
        if (ctx.json) {
          printJson(res);
          return;
        }
        const j = res.job;
        console.log(`${j.id}  ${j.state}${j.progress ? ` (${j.progress})` : ""}`);
        console.log(`  item:     ${j.itemId}${j.title ? ` (${j.title})` : ""}`);
        console.log(`  kind:     ${j.kind}  provider: ${j.provider}  model: ${j.model}`);
        console.log(`  started:  ${j.startedAt}`);
        if (j.finishedAt) console.log(`  finished: ${j.finishedAt}`);
        if (j.error) console.log(`  error:    ${j.error}`);
      }),
    );

  job
    .command("cancel <jobId>")
    .description("Abandon an active async job")
    .option("--canvas <canvas>")
    .action(
      onCanvas(ctxOf, async (handle, ctx, args) => {
        const jobId = String(args[0] ?? "").trim();
        const res = await ctx.client.abandonJob(handle.id, jobId, { actor: ctx.actor });
        if (ctx.json) {
          printJson(res);
          return;
        }
        console.log(`abandoned ${res.job.id} on item ${res.job.itemId}`);
      }),
    );

  job
    .command("retry <jobId>")
    .description("Retry a finished, failed, or abandoned job on the same item")
    .option("--model <id>", "override the model for the retry")
    .option("--canvas <canvas>")
    .action(
      onCanvas(ctxOf, async (handle, ctx, args) => {
        const jobId = String(args[0] ?? "").trim();
        const opts = (args[1] ?? {}) as { model?: string };
        const res = await ctx.client.retryJob(handle.id, jobId, {
          actor: ctx.actor,
          ...(opts.model ? { model: opts.model } : {}),
        });
        if (ctx.json) {
          printJson(res);
          return;
        }
        console.log(
          `retrying ${jobId} as ${res.job.id} (${res.job.state}, model ${res.job.model}) on item ${res.job.itemId}`,
        );
      }),
    );
}
