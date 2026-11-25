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

import { readFileSync } from "node:fs";
import { z } from "zod";
import type { Command } from "commander";
import type { CliHost, CliModule } from "@isocan/cli/modulehost";
import guideText from "../agent-guide.md";
import {
  WORKBENCH_APPROVE_ROUTE,
  WORKBENCH_CANCEL_ROUTE,
  WORKBENCH_DEBUG_ROUTE,
  WORKBENCH_DRIVERS_ROUTE,
  WORKBENCH_EMIT_ROUTE,
  WORKBENCH_SEND_ROUTE,
  WORKBENCH_SESSIONS_ROUTE,
  WORKBENCH_START_ROUTE,
  workbenchModule,
  type WorkbenchDebugResponse,
  type WorkbenchDriversResponse,
  type WorkbenchEmitResponse,
  type WorkbenchSessionsResponse,
  type WorkbenchStartResponse,
} from "./core.ts";

function register(host: CliHost): void {
  const wb = host.program
    .command("workbench")
    .description("Manage local agent sessions, terminals, and OpenNode batches on this canvas");

  wb.command("drivers")
    .description("List available session drivers and models")
    .option("--canvas <canvas>")
    .action(
      host.run(async (_opts: { canvas?: string }, cmd: Command) => {
        const ctx = await host.ctxOf(cmd);
        const canvas = await host.resolveCanvas(ctx);
        const answer = await ctx.client.moduleRequest<WorkbenchDriversResponse>(
          "GET",
          `${WORKBENCH_DRIVERS_ROUTE}?canvasId=${encodeURIComponent(canvas.id)}`,
        );
        if (ctx.json) return host.printJson(answer);
        for (const d of answer.drivers) {
          console.log(`${d.id}\t${d.available ? "available" : "unavailable"}\t${d.label}`);
        }
      }),
    );

  wb.command("sessions")
    .description("List active and recent workbench sessions")
    .option("--driver <id>", "filter by driver id")
    .option("--workspace <path>", "filter by workspace path")
    .option("--canvas <canvas>")
    .action(
      host.run(async (opts: { driver?: string; workspace?: string; canvas?: string }, cmd: Command) => {
        const ctx = await host.ctxOf(cmd);
        const canvas = await host.resolveCanvas(ctx);
        const params = new URLSearchParams({ canvasId: canvas.id });
        if (opts.driver) params.set("driver", opts.driver);
        if (opts.workspace) params.set("workspace", opts.workspace);
        const answer = await ctx.client.moduleRequest<WorkbenchSessionsResponse>(
          "GET",
          `${WORKBENCH_SESSIONS_ROUTE}?${params.toString()}`,
        );
        if (ctx.json) return host.printJson(answer);
        if (answer.sessions.length === 0) {
          console.log("no active workbench sessions");
          return;
        }
        for (const s of answer.sessions) {
          console.log(`${s.id}\t${s.driver}\t${s.status}\t${s.title}`);
        }
      }),
    );

  wb.command("start")
    .description("Start a session or terminal item on this canvas")
    .requiredOption("--driver <id>", "driver id (antigravity|gemini-cli|claude-code|pty)")
    .option("--kind <kind>", "item kind (session|terminal)", "session")
    .option("--workspace <path>", "workspace directory")
    .option("--prompt <text>", "initial prompt")
    .option("--command <cmd>", "command for pty terminal")
    .option("--model <id>", "model id override")
    .option("--title <title>", "canvas item title")
    .option("--no-auto-preview", "disable automatic site item creation for dev servers")
    .option("--canvas <canvas>")
    .action(
      host.run(
        async (
          opts: {
            driver: string;
            kind?: string;
            workspace?: string;
            prompt?: string;
            command?: string;
            model?: string;
            title?: string;
            autoPreview?: boolean;
            canvas?: string;
          },
          cmd: Command,
        ) => {
          const ctx = await host.ctxOf(cmd);
          const canvas = await host.resolveCanvas(ctx);
          const answer = await ctx.client.moduleRequest<WorkbenchStartResponse>("POST", WORKBENCH_START_ROUTE, {
            canvasId: canvas.id,
            driver: opts.driver,
            kind: opts.kind === "terminal" ? "terminal" : "session",
            ...(opts.workspace ? { workspace: opts.workspace } : {}),
            ...(opts.prompt ? { prompt: opts.prompt } : {}),
            ...(opts.command ? { command: opts.command } : {}),
            ...(opts.model ? { model: opts.model } : {}),
            ...(opts.title ? { title: opts.title } : {}),
            autoPreview: opts.autoPreview !== false,
            actor: ctx.actor,
          });
          if (ctx.json) return host.printJson(answer);
          console.log(`started ${answer.driver} session ${answer.session.id} → item ${answer.itemId}`);
        },
      ),
    );

  wb.command("send <sessionId> <text>")
    .description("Send text or a prompt to a running session")
    .requiredOption("--driver <id>", "driver id")
    .option("--canvas <canvas>")
    .action(
      host.run(async (sessionId: string, text: string, opts: { driver: string; canvas?: string }, cmd: Command) => {
        const ctx = await host.ctxOf(cmd);
        const canvas = await host.resolveCanvas(ctx);
        const answer = await ctx.client.moduleRequest<{ ok: boolean }>("POST", WORKBENCH_SEND_ROUTE, {
          canvasId: canvas.id,
          driver: opts.driver,
          sessionId,
          text,
        });
        if (ctx.json) return host.printJson(answer);
        console.log(`sent input to ${sessionId}`);
      }),
    );

  wb.command("approve <sessionId> <interactionId>")
    .description("Approve or deny a pending session interaction")
    .requiredOption("--driver <id>", "driver id")
    .option("--deny", "deny the interaction instead of approving")
    .option("--canvas <canvas>")
    .action(
      host.run(
        async (sessionId: string, interactionId: string, opts: { driver: string; deny?: boolean; canvas?: string }, cmd: Command) => {
          const ctx = await host.ctxOf(cmd);
          const canvas = await host.resolveCanvas(ctx);
          const answer = await ctx.client.moduleRequest<{ ok: boolean }>("POST", WORKBENCH_APPROVE_ROUTE, {
            canvasId: canvas.id,
            driver: opts.driver,
            sessionId,
            interactionId,
            decision: !opts.deny,
          });
          if (ctx.json) return host.printJson(answer);
          console.log(`${opts.deny ? "denied" : "approved"} ${interactionId} on ${sessionId}`);
        },
      ),
    );

  wb.command("cancel <sessionId>")
    .description("Cancel a running session")
    .requiredOption("--driver <id>", "driver id")
    .option("--canvas <canvas>")
    .action(
      host.run(async (sessionId: string, opts: { driver: string; canvas?: string }, cmd: Command) => {
        const ctx = await host.ctxOf(cmd);
        const canvas = await host.resolveCanvas(ctx);
        const answer = await ctx.client.moduleRequest<{ ok: boolean }>("POST", WORKBENCH_CANCEL_ROUTE, {
          canvasId: canvas.id,
          driver: opts.driver,
          sessionId,
        });
        if (ctx.json) return host.printJson(answer);
        console.log(`cancelled ${sessionId}`);
      }),
    );

  wb.command("emit")
    .description("Validate and materialize an OpenNode envelope onto the canvas")
    .option("--file <path>", "path to JSON file (or '-' for stdin)", "-")
    .option("--canvas <canvas>")
    .action(
      host.run(async (opts: { file?: string; canvas?: string }, cmd: Command) => {
        const ctx = await host.ctxOf(cmd);
        const canvas = await host.resolveCanvas(ctx);
        const rawText = opts.file && opts.file !== "-" ? readFileSync(opts.file, "utf8") : readFileSync(0, "utf8");
        const spec = JSON.parse(rawText) as unknown;
        const answer = await ctx.client.moduleRequest<WorkbenchEmitResponse>("POST", WORKBENCH_EMIT_ROUTE, {
          canvasId: canvas.id,
          spec,
          actor: ctx.actor,
        });
        if (ctx.json) return host.printJson(answer);
        console.log(`emitted ${answer.itemIds.length} new, ${answer.updatedIds.length} updated, ${answer.edgeCount} edges`);
      }),
    );

  wb.command("debug <item>")
    .description("Start a debug session on a canvas item error")
    .requiredOption("--driver <id>", "driver id")
    .option("--mode <mode>", "debug mode (plan|fix)", "fix")
    .option("--workspace <path>", "workspace directory")
    .option("--canvas <canvas>")
    .action(
      host.run(async (itemRef: string, opts: { driver: string; mode?: string; workspace?: string; canvas?: string }, cmd: Command) => {
        const ctx = await host.ctxOf(cmd);
        const canvas = await host.resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(canvas.id);
        const item = host.resolveItem(snapshot, itemRef.replace(/^#/, ""));
        const answer = await ctx.client.moduleRequest<WorkbenchDebugResponse>("POST", WORKBENCH_DEBUG_ROUTE, {
          canvasId: canvas.id,
          itemId: item.id,
          driver: opts.driver,
          mode: opts.mode === "plan" ? "plan" : "fix",
          ...(opts.workspace ? { workspace: opts.workspace } : {}),
          actor: ctx.actor,
        });
        if (ctx.json) return host.printJson(answer);
        console.log(`started debug session ${answer.session.id} (${answer.itemId}) for ${answer.targetItemId}`);
      }),
    );
}

export const workbenchCli: CliModule = {
  core: workbenchModule,
  register,
  guide: guideText,
  tools: [
    {
      name: "drivers",
      title: "List workbench drivers",
      description: "List available session drivers (antigravity, gemini-cli, claude-code, pty) and their models.",
      inputSchema: {},
      run: async (_args, host) => {
        const canvas = await host.canvas();
        return canvas.ctx.client.moduleRequest<WorkbenchDriversResponse>(
          "GET",
          `${WORKBENCH_DRIVERS_ROUTE}?canvasId=${encodeURIComponent(canvas.id)}`,
          undefined,
          host.signal,
        );
      },
    },
    {
      name: "sessions",
      title: "List workbench sessions",
      description: "List active and recent workbench agent or terminal sessions, optionally filtered by driver or workspace.",
      inputSchema: {
        driver: z.string().trim().min(1).optional().describe("Optional driver id filter."),
        workspace: z.string().trim().min(1).optional().describe("Optional workspace path filter."),
      },
      run: async ({ driver, workspace }: { driver?: string; workspace?: string }, host) => {
        const canvas = await host.canvas();
        const params = new URLSearchParams({ canvasId: canvas.id });
        if (driver) params.set("driver", driver);
        if (workspace) params.set("workspace", workspace);
        return canvas.ctx.client.moduleRequest<WorkbenchSessionsResponse>(
          "GET",
          `${WORKBENCH_SESSIONS_ROUTE}?${params.toString()}`,
          undefined,
          host.signal,
        );
      },
    },
    {
      name: "start",
      title: "Start a workbench session",
      description: "Start a local agent or terminal session on this canvas and tail dev-server URLs into live site items.",
      inputSchema: {
        driver: z.string().trim().min(1).describe("Session driver id (antigravity, gemini-cli, claude-code, pty)."),
        kind: z.enum(["session", "terminal"]).optional().describe("Canvas item kind: session or terminal."),
        workspace: z.string().trim().min(1).optional().describe("Workspace directory path."),
        prompt: z.string().optional().describe("Initial prompt for the session."),
        command: z.string().optional().describe("Shell command when kind is terminal."),
        title: z.string().optional().describe("Optional item title."),
      },
      run: async (
        input: { driver: string; kind?: "session" | "terminal"; workspace?: string; prompt?: string; command?: string; title?: string },
        host,
      ) => {
        const canvas = await host.canvas();
        return canvas.ctx.client.moduleRequest<WorkbenchStartResponse>(
          "POST",
          WORKBENCH_START_ROUTE,
          {
            canvasId: canvas.id,
            ...input,
            actor: canvas.ctx.actor,
          },
          host.signal,
        );
      },
    },
    {
      name: "emit",
      title: "Emit OpenNode envelope",
      description: "Validate and materialize an OpenNode (openstitch.node.v1/v2) batch of nodes, edges, and patches onto the canvas.",
      inputSchema: {
        spec: z.record(z.string(), z.unknown()).describe("OpenNode envelope object with $schema, nodes, edges, and patches."),
      },
      run: async ({ spec }: { spec: Record<string, unknown> }, host) => {
        const canvas = await host.canvas();
        return canvas.ctx.client.moduleRequest<WorkbenchEmitResponse>(
          "POST",
          WORKBENCH_EMIT_ROUTE,
          {
            canvasId: canvas.id,
            spec,
            actor: canvas.ctx.actor,
          },
          host.signal,
        );
      },
    },
  ],
};

export default workbenchCli;
