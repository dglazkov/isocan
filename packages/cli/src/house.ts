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

import { spawn } from "node:child_process";
import type { Command } from "commander";
import { HOUSE_HANDLE, HOUSE_SESSION_KEY } from "@isocan/core/house-agent";
import { HouseAgent } from "@isocan/house-agent";
import { findBinding, paths } from "@isocan/server";
import type { Ctx } from "./ctx.ts";
import { printJson } from "./output.ts";
import { run } from "./run.ts";

/**
 * Start opt-in laptop custody of `@house` alongside `isocan serve --house`
 * (or `ISOCAN_HOUSE_AGENT=1`), attaching to the bound canvas if present and
 * cleaning up when the daemon exits.
 */
export async function startServeHouseCustody(options: {
  port: number;
  home?: string | undefined;
  cwd?: string | undefined;
}): Promise<{ stop: () => void } | null> {
  const home = options.home ?? paths.isocanHome();
  const cwd = options.cwd ?? process.cwd();
  const binding = await findBinding(cwd, home).catch(() => null);
  if (!binding) return null;

  const child = spawn(
    process.execPath,
    [process.argv[1]!, "house", "--canvas", binding.canvasId, "--port", String(options.port)],
    {
      cwd,
      stdio: "ignore",
      env: { ...process.env },
    },
  );
  const stop = () => {
    if (!child.killed) child.kill("SIGTERM");
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  process.once("exit", stop);
  return { stop };
}

/**
 * Register `isocan house` and the opt-in `--house` custody hook on `serve`.
 */
export function registerHouseCommand(
  program: Command,
  ctxOf: (cmd: Command) => Promise<Ctx>,
): void {
  program
    .command("house")
    .description("Run the @house agent on the bound canvas (yields if another @house is already parked)")
    .option("--once", "process one pending wake (or wait once) and exit")
    .option("--canvas <ref>", "target canvas id (defaults to the directory binding)")
    .action(
      run(async (opts: { once?: boolean; canvas?: string }, cmd: Command) => {
        const ctx = await ctxOf(cmd);
        const canvasId = opts.canvas ?? ctx.canvasRef ?? ctx.binding?.canvasId;
        if (!canvasId) {
          throw new Error("no canvas bound to this directory (pass --canvas <ref> or run `isocan setup`)");
        }
        const actor = ctx.actor ?? { id: "usr_house_local", name: HOUSE_HANDLE };
        const controller = new AbortController();
        const agent = new HouseAgent({
          client: ctx.client,
          canvasId,
          actor,
          onLog: (msg) => {
            if (!ctx.json) console.error(msg);
          },
        });

        const shutdown = () => {
          controller.abort();
          void agent.stop();
        };
        process.once("SIGINT", shutdown);
        process.once("SIGTERM", shutdown);

        try {
          const result = opts.once
            ? await agent.runOnce(controller.signal)
            : await agent.start(controller.signal);

          if (ctx.json) {
            printJson({ ...result, canvasId, sessionKey: HOUSE_SESSION_KEY });
          } else if (result.status === "yielded") {
            console.log(`@house already held by ${result.holderActorId}; yielded.`);
          } else if (result.status === "completed") {
            console.log(result.summary);
          } else if (result.status === "failed") {
            console.error(result.summary);
            process.exitCode = 1;
          } else {
            console.log(`house agent ${result.status}`);
          }
        } finally {
          process.removeListener("SIGINT", shutdown);
          process.removeListener("SIGTERM", shutdown);
          await agent.stop();
        }
      }),
    );

  const serveCmd = program.commands.find((c) => c.name() === "serve");
  if (serveCmd) {
    serveCmd.option(
      "--house",
      "attach local @house agent custody while serving (or set ISOCAN_HOUSE_AGENT=1)",
    );
    serveCmd.hook("preAction", async (thisCommand) => {
      const opts = thisCommand.opts() as { house?: boolean };
      if (!opts.house && process.env.ISOCAN_HOUSE_AGENT !== "1") return;
      const globals = thisCommand.optsWithGlobals() as { port?: string };
      const port = Number(globals.port ?? process.env.ISOCAN_PORT ?? 4321);
      await startServeHouseCustody({ port });
    });
  }
}
