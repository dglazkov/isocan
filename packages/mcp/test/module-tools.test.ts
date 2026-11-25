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
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { connect, DaemonClient, harnessVars, type ExplicitIdentity, type Home } from "@isocan/api";
import { newCanvasId } from "@isocan/core";
import { type Daemon } from "@isocan/server";
import { startDaemon, stopDaemons } from "@isocan/server/daemon";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.ts";
import { BUILT_IN_TOOLS, moduleToolPrefix, type McpModule } from "../src/tools.ts";

/**
 * **A module's verb, offered as a tool** (`docs/projects/modules/mcp.md`).
 *
 * Driven as `tools.test.ts` drives the built-ins — a real MCP `Client` over
 * the in-memory pair, a real daemon — with a SYNTHETIC module, because this
 * package may not name a real one (`test/modules.test.ts`). What is asserted
 * is the contract the server keeps for every module: the prefixed name, the
 * spliced `session`/`canvas` arguments, attribution under an explicit
 * session, the handle arriving already opened, and the refusals at build
 * time. The real module proof is `stdio-module-tools.test.ts`.
 */

let home: string;
let work: string;
let daemon: Daemon;
let port: number;
let base: string;
let cwdBefore: string;
const saved: Record<string, string | undefined> = {};
let ambient: Home;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-mcp-mod-"));
  work = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-mcp-mod-work-"));
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  port = typeof address === "object" && address ? address.port : 0;
  base = `http://127.0.0.1:${port}`;
  saved.ISOCAN_HOME = process.env.ISOCAN_HOME;
  process.env.ISOCAN_HOME = home;
  for (const v of harnessVars) {
    saved[v] = process.env[v];
    delete process.env[v];
  }
  saved.ISOCAN_DIRECT = process.env.ISOCAN_DIRECT;
  delete process.env.ISOCAN_DIRECT;
  cwdBefore = process.cwd();
  process.chdir(work);
  const client = new DaemonClient(base, home);
  await client.claimActor({ type: "actor.claim", sessionKey: "mcp:ambient", name: "Acme Owner" });
  await client.claimActor({ type: "actor.claim", sessionKey: "mcp:conversation-a", name: "Cedar" });
  ambient = await connect({ port, identity: { session: "ambient", harness: "mcp" } });
});

afterEach(async () => {
  process.chdir(cwdBefore);
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  await daemon.close().catch(() => {});
  await stopDaemons(port, home).catch(() => {});
  await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  await fs.rm(work, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

/** Identity per call, the way `serveStdio` connects: no session is the
 * ambient actor; a session is whoever claimed it. */
const homeOf = async (identity?: ExplicitIdentity) => (identity ? connect({ port, identity }) : ambient);

async function host(modules: readonly McpModule[]): Promise<Client> {
  const server = createServer({ home: homeOf, modules });
  const client = new Client({ name: "test-host", version: "0" });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  return client;
}

function payload(result: unknown): Record<string, unknown> {
  const blocks = (result as { content: { type: string; text: string }[] }).content;
  return JSON.parse(blocks[0]!.text) as Record<string, unknown>;
}

async function aCanvas(): Promise<string> {
  const canvasId = newCanvasId();
  await ambient.ctx.client.sendOp(null, ambient.actor, { type: "project.create", canvasId, title: "Acme board" });
  return canvasId;
}

/** A synthetic module with one writing verb and one reading verb. */
const acme: McpModule = {
  name: "@acme/badge",
  tools: [
    {
      name: "pin",
      title: "Pin a badge",
      description: "Put a badge item on the canvas with the given label, as this call's identity.",
      inputSchema: { label: z.string().min(1), x: z.number().optional(), y: z.number().optional() },
      run: async ({ label, x, y }: { label: string; x?: number; y?: number }, host) => {
        const canvas = await host.canvas();
        const item = await canvas.add({ content: label, mime: "text/plain", title: `Badge ${label}`, ...(x !== undefined && y !== undefined ? { at: { x, y } } : {}) });
        return { itemId: item.id, by: item.createdBy.name, session: host.session ?? null };
      },
    },
    {
      name: "count",
      description: "How many badge items the canvas holds, read without writing anything at all.",
      inputSchema: {},
      readOnly: true,
      run: async (_args, host) => ({ badges: (await host.canvas().then((c) => c.items())).filter((i) => i.title?.startsWith("Badge ")).length }),
    },
  ],
};

describe("module tools beside the built-ins", () => {
  it("lists them under <module>_<verb>, with session and canvas spliced in and the built-ins unchanged", async () => {
    const client = await host([acme]);
    try {
      const { tools } = await client.listTools();
      const names = tools.map((t) => t.name);
      expect(names.filter((n) => BUILT_IN_TOOLS.includes(n)).sort()).toEqual([...BUILT_IN_TOOLS].sort());
      expect(names).toContain("badge_pin");
      expect(names).toContain("badge_count");
      const pin = tools.find((t) => t.name === "badge_pin")!;
      expect(pin.title).toBe("Pin a badge");
      expect(Object.keys(pin.inputSchema.properties ?? {}).sort()).toEqual(["canvas", "label", "session", "x", "y"]);
      expect(pin.inputSchema.required).toEqual(["label"]);
      const count = tools.find((t) => t.name === "badge_count")!;
      expect(count.annotations?.readOnlyHint).toBe(true);
      expect(Object.keys(count.inputSchema.properties ?? {}).sort()).toEqual(["canvas", "session"]);
      // The rule every built-in keeps, kept for every module tool too.
      for (const tool of tools) expect(tool.inputSchema.properties, tool.name).toHaveProperty("session");
    } finally { await client.close(); }
  });

  it("runs the verb's body as the call's identity: ambient without a session, the claimed actor with one", async () => {
    const canvas = await aCanvas();
    const client = await host([acme]);
    try {
      const asAmbient = payload(await client.callTool({ name: "badge_pin", arguments: { canvas, label: "one" } }));
      expect(asAmbient).toMatchObject({ by: "Acme Owner", session: null });
      const asCedar = payload(await client.callTool({ name: "badge_pin", arguments: { canvas, session: "conversation-a", label: "two", x: 2000, y: 50 } }));
      expect(asCedar).toMatchObject({ by: "Cedar", session: "conversation-a" });
      // What the tool made is an ordinary item, read back by the built-in.
      const item = payload(await client.callTool({ name: "read_item", arguments: { canvas, item: asCedar.itemId as string } }));
      // Far from the first badge, so the engine's overlap nudge leaves it where it was asked.
      expect(item).toMatchObject({ title: "Badge two", x: 2000, y: 50 });
      expect((item.createdBy as { name: string }).name).toBe("Cedar");
      expect(payload(await client.callTool({ name: "badge_count", arguments: { canvas } }))).toEqual({ badges: 2 });
    } finally { await client.close(); }
  });

  it("answers a thrown refusal and an unclaimed session as readable errors, like a built-in", async () => {
    const canvas = await aCanvas();
    const client = await host([acme]);
    try {
      const unclaimed = await client.callTool({ name: "badge_pin", arguments: { canvas, session: "nobody", label: "x" } });
      expect(unclaimed.isError).toBe(true);
      expect((unclaimed.content as { text: string }[])[0]!.text).toContain("no actor is claimed");
      const badArgs = await client.callTool({ name: "badge_pin", arguments: { canvas, label: "" } });
      expect(badArgs.isError).toBe(true);
    } finally { await client.close(); }
  });

  it("refuses, when built, a tool that takes a built-in's name, another module's, or a reserved argument", () => {
    const tool = (name: string, inputSchema: Record<string, z.ZodTypeAny> = {}) => ({ name, description: "a tool whose description is long enough to be a description", inputSchema, run: async () => ({}) });
    expect(() => createServer({ home: homeOf, modules: [{ name: "@isocan/create", tools: [tool("item")] }] })).toThrow(/create_item.*already taken/);
    expect(() => createServer({ home: homeOf, modules: [{ name: "@isocan/read", tools: [tool("canvas")] }] })).toThrow(/read_canvas.*already taken/);
    expect(() => createServer({ home: homeOf, modules: [acme, { name: "badge", tools: [tool("pin")] }] })).toThrow(/badge_pin.*already taken/);
    expect(() => createServer({ home: homeOf, modules: [{ name: "@acme/x", tools: [tool("go", { session: z.string() })] }] })).toThrow(/redeclares "session"/);
    expect(() => createServer({ home: homeOf, modules: [{ name: "@acme/x", tools: [tool("Go Now")] }] })).toThrow(/lowercase/);
    expect(moduleToolPrefix("@acme/two-words")).toBe("two-words");
    expect(moduleToolPrefix("@acme/Design Lab")).toBe("design-lab");
  });
});
