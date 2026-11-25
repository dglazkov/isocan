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
  CLIPPER_CAPTURE_ROUTE,
  clipperModule,
  type ClipCaptureResponse,
} from "./core.ts";

function register(host: CliHost): void {
  const clipper = host.program
    .command("clipper")
    .description("Capture web pages, selections, and screenshots onto the canvas");

  clipper
    .command("capture <url>")
    .description("Capture a URL (and optional selection or HTML) onto the canvas")
    .option("--title <title>", "custom title for the clipped item")
    .option("--selection <text>", "selected excerpt to store as Markdown")
    .option("--html <html>", "captured HTML snapshot to store as a site item")
    .option("--canvas <canvas>")
    .action(
      host.run(
        async (
          url: string,
          opts: { title?: string; selection?: string; html?: string; canvas?: string },
          cmd: Command,
        ) => {
          const ctx = await host.ctxOf(cmd);
          const canvas = await host.resolveCanvas(ctx);
          const answer = await ctx.client.moduleRequest<ClipCaptureResponse>("POST", CLIPPER_CAPTURE_ROUTE, {
            canvasId: canvas.id,
            url,
            ...(opts.title ? { title: opts.title } : {}),
            ...(opts.selection ? { selection: opts.selection } : {}),
            ...(opts.html ? { html: opts.html } : {}),
            actor: ctx.actor,
          });
          if (ctx.json) return host.printJson(answer);
          console.log(`clipped ${answer.kind} ${answer.itemId} <- ${answer.sourceUrl}`);
        },
      ),
    );
}

export const clipperCli: CliModule = {
  core: clipperModule,
  register,
  guide: guideText,
  tools: [
    {
      name: "capture",
      title: "Capture a web clip onto the canvas",
      description:
        "Clip an HTTP(S) URL with optional text selection, HTML, or base64 image onto the canvas stamped with clipper.sourceUrl and clipper.capturedAt.",
      inputSchema: {
        url: z.string().url().describe("HTTP(S) URL to capture."),
        title: z.string().trim().min(1).optional().describe("Optional title for the clipped item."),
        selection: z.string().optional().describe("Optional selected text excerpt."),
        html: z.string().optional().describe("Optional captured HTML document."),
      },
      run: async ({ url, title, selection, html }: { url: string; title?: string; selection?: string; html?: string }, host) => {
        const canvas = await host.canvas();
        return canvas.ctx.client.moduleRequest<ClipCaptureResponse>(
          "POST",
          CLIPPER_CAPTURE_ROUTE,
          {
            canvasId: canvas.id,
            url,
            ...(title ? { title } : {}),
            ...(selection !== undefined ? { selection } : {}),
            ...(html !== undefined ? { html } : {}),
            actor: canvas.ctx.actor,
          },
          host.signal,
        );
      },
    },
  ],
};

export default clipperCli;
