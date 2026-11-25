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
  WORKSPACE_IMPORT_ROUTE,
  WORKSPACE_SYNC_ROUTE,
  workspaceModule,
  type WorkspaceImportResponse,
  type WorkspaceSyncResponse,
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
  const ws = host.program
    .command("workspace")
    .description("Import and sync Google Docs, Sheets, and Slides on the canvas");

  ws.command("import <url>")
    .description("Import a Google Docs, Sheets, or Slides URL as a canvas item")
    .option("--title <title>", "custom item title")
    .option("--token <oauth>", "optional OAuth bearer token")
    .option("--canvas <canvas>")
    .action(
      host.run(async (url: string, opts: { title?: string; token?: string; canvas?: string }, cmd: Command) => {
        const ctx = await host.ctxOf(cmd);
        const canvas = await host.resolveCanvas(ctx);
        const answer = await ctx.client.moduleRequest<WorkspaceImportResponse>("POST", WORKSPACE_IMPORT_ROUTE, {
          canvasId: canvas.id,
          url,
          ...(opts.title ? { title: opts.title } : {}),
          ...(opts.token ? { oauthToken: opts.token } : {}),
          actor: ctx.actor,
        });
        if (ctx.json) return host.printJson(answer);
        console.log(`imported ${answer.kind} ${answer.itemId}@${answer.versionId} (${answer.syncedAt})`);
      }),
    );

  ws.command("sync <item>")
    .description("Re-fetch a workspace-linked item and stack a new version")
    .option("--token <oauth>", "optional OAuth bearer token")
    .option("--canvas <canvas>")
    .action(
      host.run(async (ref: string, opts: { token?: string; canvas?: string }, cmd: Command) => {
        const ctx = await host.ctxOf(cmd);
        const canvas = await host.resolveCanvas(ctx);
        const snapshot = await ctx.client.snapshot(canvas.id);
        const item = host.resolveItem(snapshot, ref.replace(/^#/, ""));
        const answer = await ctx.client.moduleRequest<WorkspaceSyncResponse>("POST", WORKSPACE_SYNC_ROUTE, {
          canvasId: canvas.id,
          itemId: item.id,
          ...(opts.token ? { oauthToken: opts.token } : {}),
          actor: ctx.actor,
        });
        if (ctx.json) return host.printJson(answer);
        console.log(`synced ${answer.itemId}@${answer.versionId} (${answer.syncedAt})`);
      }),
    );
}

export const workspaceCli: CliModule = {
  core: workspaceModule,
  register,
  guide: guideText,
  tools: [
    {
      name: "import",
      title: "Import a Google Workspace document",
      description:
        "Import a Google Docs, Sheets, or Slides URL onto the canvas as a Markdown, CSV, or HTML item with workspace provenance.",
      inputSchema: {
        url: z.string().url().describe("Google Docs, Sheets, or Slides URL to import."),
        title: z.string().trim().min(1).optional().describe("Optional item title."),
      },
      run: async ({ url, title }: { url: string; title?: string }, host) => {
        const canvas = await host.canvas();
        return canvas.ctx.client.moduleRequest<WorkspaceImportResponse>(
          "POST",
          WORKSPACE_IMPORT_ROUTE,
          { canvasId: canvas.id, url, ...(title ? { title } : {}), actor: canvas.ctx.actor },
          host.signal,
        );
      },
    },
    {
      name: "sync",
      title: "Sync a workspace-linked item",
      description:
        "Re-fetch a workspace-linked Google Doc, Sheet, or Slide and stack a fresh version onto the item via item.addVersion.",
      inputSchema: {
        item: z.string().trim().min(1).describe("Item id or unique title carrying workspace.url."),
      },
      run: async ({ item: ref }: { item: string }, host) => {
        const canvas = await host.canvas();
        const snapshot = await canvas.ctx.client.snapshot(canvas.id);
        const target = resolveItemRef(snapshot.canvas, ref);
        return canvas.ctx.client.moduleRequest<WorkspaceSyncResponse>(
          "POST",
          WORKSPACE_SYNC_ROUTE,
          { canvasId: canvas.id, itemId: target.id, actor: canvas.ctx.actor },
          host.signal,
        );
      },
    },
  ],
};

export default workspaceCli;
