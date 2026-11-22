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

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { DaemonClient, harnessVars } from "@isocan/api";
import { newCanvasId, type Actor } from "@isocan/core";
import { startDaemon } from "@isocan/server/daemon";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

/**
 * **A real module's verb, reached the way a manager reaches it**
 * (`docs/projects/modules/mcp.md`). `isocan mcp` is spawned over stdio, as a
 * host spawns it, so what is proved is the whole chain: the CLI loaded its
 * module list, handed it to the server, and `stickers_drop` — the tool
 * beside `isocan sticker drop` — landed the same item the verb lands: the
 * sticker mime, the sticker's title and size, attributed to the session that
 * called it. The module is named here only by its tool, never by its
 * package: `test/modules.test.ts` holds that a module is imported by the two
 * lists alone, and a tool name is not an import.
 */
it("offers a loaded module's verb as <module>_<verb> over stdio and lands the verb's own item", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-mcp-module-"));
  const work = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-mcp-module-work-"));
  const daemon = await startDaemon({ home, port: 0, contentPort: "off", auth: null, birthHome: null });
  const address = daemon.app.server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  const routes = new DaemonClient(`http://127.0.0.1:${port}`, home);
  const ambient = (await routes.claimActor({ type: "actor.claim", sessionKey: "test:ambient", name: "Acme Owner" })).envelope.actor;
  const canvas = newCanvasId();
  await routes.sendOp(null, ambient, { type: "project.create", canvasId: canvas, title: "Acme stickers", groupMode: "groups" });
  const env: Record<string, string> = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));
  for (const key of harnessVars) delete env[key];
  delete env.ISOCAN_DIRECT;
  Object.assign(env, { ISOCAN_HOME: home, ISOCAN_PORT: String(port), ISOCAN_HARNESS: "test", ISOCAN_SESSION_ID: "ambient" });
  const command = fileURLToPath(new URL("../../cli/bin/isocan.js", import.meta.url));
  let stderr = "";
  const transport = new StdioClientTransport({ command: process.execPath, args: [command, "mcp"], cwd: work, env, stderr: "pipe" });
  transport.stderr?.on("data", (data: Buffer) => { stderr += data.toString(); });
  const client = new Client({ name: "same-manager-application", version: "1" });
  try {
    await client.connect(transport);
    const call = async <T = Record<string, unknown>>(name: string, args: Record<string, unknown> = {}): Promise<T> => {
      const result = await client.callTool({ name, arguments: { canvas, ...args } });
      expect(result.isError, JSON.stringify(result)).toBeUndefined();
      return JSON.parse((result.content as Array<{ text: string }>)[0]!.text) as T;
    };

    // The list a host sees: the sixteen, and then the modules' — every one
    // carrying `session`, every one prefixed by its module.
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);
    expect(names).toContain("create_item");
    expect(names).toContain("stickers_drop");
    expect(names.filter((n) => n.includes("_") && !/^(list|read|create|edit|post|reply|wait|claim)_/.test(n)).every((n) => /^[a-z0-9-]+_[a-z0-9_-]+$/.test(n))).toBe(true);
    for (const tool of tools) expect(tool.inputSchema.properties, tool.name).toHaveProperty("session");
    const drop = tools.find((t) => t.name === "stickers_drop")!;
    expect(drop.description).toContain("isocan sticker drop");
    expect(drop.inputSchema.required).toEqual(["sticker"]);

    // The verb, as an agent in a manager performs it: claim, then drop.
    const { actor } = await call<{ actor: Actor }>("claim_agent", { session: "conversation-a", name: "Cedar" });
    const dropped = await call<{ itemId: string; sticker: string; title: string; x: number; y: number }>("stickers_drop", { session: "conversation-a", sticker: "fire", x: 200, y: 400 });
    expect(dropped).toMatchObject({ sticker: "fire", x: 200, y: 400 });

    // What landed is what `isocan sticker drop fire --at 200,400` lands.
    const snapshot = await routes.snapshot(canvas);
    const item = snapshot.canvas.items[dropped.itemId]!;
    expect(item).toMatchObject({ title: dropped.title, x: 200, y: 400, width: 120, height: 120 });
    expect(item.createdBy.id).toBe(actor.id);
    const version = item.versions.find((v) => v.id === item.currentVersionId)!;
    expect(version.mimeType).toBe("text/vnd.isocan.sticker");
    expect((await routes.downloadBlob(canvas, version.blobHash)).toString("utf8")).toBe("🔥");

    // Ambient identity without a session; a wrong sticker is a sentence, not
    // a stack trace; the item count says nothing landed for it.
    const own = await call<{ itemId: string }>("stickers_drop", { sticker: "🎉" });
    expect(snapshot.canvas.items[own.itemId]).toBeUndefined();
    expect((await routes.snapshot(canvas)).canvas.items[own.itemId]!.createdBy.id).toBe(ambient.id);
    const refused = await client.callTool({ name: "stickers_drop", arguments: { canvas, sticker: "no-such-thing" } });
    expect(refused.isError).toBe(true);
    expect((refused.content as { text: string }[])[0]!.text).toMatch(/no sticker "no-such-thing"/);
    expect(Object.keys((await routes.snapshot(canvas)).canvas.items)).toHaveLength(2);
    expect(stderr).not.toMatch(/SyntaxError|UnhandledPromiseRejection/);
  } finally {
    await client.close().catch(() => {});
    await daemon.close();
    await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    await fs.rm(work, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}, 30_000);
