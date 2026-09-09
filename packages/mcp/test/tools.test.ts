import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { connect, DaemonClient, harnessVars, type Home } from "@isocan/api";
import { newCanvasId } from "@isocan/core";
import { startDaemon, stopDaemons, type Daemon } from "@isocan/server";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.ts";

/**
 * **The MCP surface, driven the way a host drives it** (#220, phase 2).
 *
 * Not by calling the handlers: through a real MCP `Client` over the SDK's
 * in-memory transport, so what is asserted is what a manager actually
 * receives — the tool list it can see, the JSON in a content block, and an
 * `isError` result rather than a thrown exception. A test that called the
 * handlers directly would pass with a server no host could speak to.
 *
 * The daemon is real for the same reason. `@isocan/api` is the whole of what
 * these tools do, and a mocked home would assert that this file's own mock
 * agrees with itself.
 */

let home: string;
let work: string;
let daemon: Daemon;
let port: number;
let base: string;
let cwdBefore: string;
const saved: Record<string, string | undefined> = {};

/** The connection the tools get, prepared once per test the way a script's
 * identity is: an actor claimed under a stated session key. */
let connected: Home;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-mcp-"));
  work = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-mcp-work-"));
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
  await client.claimActor({ type: "actor.claim", sessionKey: "mcp:t-1", name: "Ada" });
  connected = await connect({ port, identity: { session: "t-1", harness: "mcp" } });
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

/** A host, connected to the server over the in-memory pair. */
async function host(deps?: { home?: () => Promise<Home> }): Promise<Client> {
  const server = createServer({ home: deps?.home ?? (async () => connected) });
  const client = new Client({ name: "test-host", version: "0" });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  return client;
}

/** What a tool answered, as the value it encoded — the text block is the one
 * every host can render, so it is the one held here. */
function payload(result: unknown): Record<string, unknown> {
  const blocks = (result as { content: { type: string; text: string }[] }).content;
  return JSON.parse(blocks[0]!.text) as Record<string, unknown>;
}

/** The text of a refusal, for the two tests that read one. */
function errorText(result: unknown): string {
  return (result as { content: { text: string }[] }).content[0]!.text;
}

/** A canvas with something on it, made through the same API the tools read.
 * The scratch cwd carries no marker, so the canvas is born explicitly and is
 * then the only one — which makes it the default reach, exactly as it would
 * be for a server started in a project directory. */
async function aCanvasWith(title: string, note: string): Promise<string> {
  const canvasId = newCanvasId();
  await connected.ctx.client.sendOp(null, connected.actor, {
    type: "project.create",
    canvasId,
    title: "Work",
  });
  const canvas = await connected.canvas(canvasId);
  await canvas.add({ title, content: note, mime: "text/markdown" });
  return canvas.id;
}

describe("what a host can see", () => {
  it("lists every tool with a description a model can act on", async () => {
    const client = await host();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "list_canvases",
      "read_activity",
      "read_canvas",
      "read_item",
      "read_threads",
      "who",
    ]);
    // A tool with no description is a tool a model will not call, or will
    // call wrongly. Cheap to assert, and the thing most likely to rot.
    for (const tool of tools) {
      expect(tool.description, `${tool.name} has no description`).toBeTruthy();
      expect(tool.description!.length).toBeGreaterThan(30);
    }
  });

  it("is read-only — phase 2 ships no verb that changes a canvas", async () => {
    // The gate is deliberate and named in phases.md: an agent over MCP is the
    // machine's PERSON by default, and writing as them would put a person's
    // face on an agent's work. This holds the boundary until that is settled,
    // so a write verb cannot arrive by extension without somebody deleting a
    // test that says why.
    const { tools } = await host().then((c) => c.listTools());
    for (const tool of tools) {
      expect(tool.name, `${tool.name} sounds like a write`).not.toMatch(
        /^(add|edit|remove|set|move|comment|reply|notify|create|delete|update)/,
      );
    }
  });
});

describe("reading a canvas", () => {
  it("lists the canvases this home holds, and who you are on them", async () => {
    await aCanvasWith("Roadmap", "the plan");
    const client = await host();
    const answer = payload(await client.callTool({ name: "list_canvases", arguments: {} }));
    expect(answer.you).toBe("Ada");
    const canvases = answer.canvases as { id: string; title: string }[];
    expect(canvases.length).toBeGreaterThan(0);
    expect(canvases[0]!.id).toMatch(/^prj_/);
  });

  it("reads the items on the directory's canvas with no argument at all", async () => {
    // The case worth making free: a server started in a project directory
    // answers about that project's canvas, resolved the way every CLI command
    // resolves it.
    await aCanvasWith("Roadmap", "the plan");
    const client = await host();
    const answer = payload(await client.callTool({ name: "read_canvas", arguments: {} }));
    const items = answer.items as { title: string; kind: string }[];
    expect(items.map((i) => i.title)).toContain("Roadmap");
    expect(items[0]!.kind).toBeTruthy();
  });

  it("reads one item's own content", async () => {
    await aCanvasWith("Roadmap", "the plan");
    const client = await host();
    const listed = payload(await client.callTool({ name: "read_canvas", arguments: {} }));
    const id = (listed.items as { id: string }[])[0]!.id;
    const item = payload(await client.callTool({ name: "read_item", arguments: { item: id } }));
    expect(item.id).toBe(id);
    expect(item.title).toBe("Roadmap");
  });

  it("reaches another canvas by id", async () => {
    const first = await aCanvasWith("Roadmap", "the plan");
    const client = await host();
    const answer = payload(
      await client.callTool({ name: "read_canvas", arguments: { canvas: first } }),
    );
    expect((answer.canvas as { id: string }).id).toBe(first);
  });

  it("answers who is here, so an agent knows what an @mention resolves to", async () => {
    await aCanvasWith("Roadmap", "the plan");
    const client = await host();
    const answer = payload(await client.callTool({ name: "who", arguments: {} }));
    expect(JSON.stringify(answer.who)).toContain("Ada");
  });

  it("answers what has been going on", async () => {
    await aCanvasWith("Roadmap", "the plan");
    const client = await host();
    const answer = payload(await client.callTool({ name: "read_activity", arguments: {} }));
    expect(Array.isArray(answer.activity)).toBe(true);
  });

  it("answers the threads, empty ones included", async () => {
    await aCanvasWith("Roadmap", "the plan");
    const client = await host();
    const answer = payload(await client.callTool({ name: "read_threads", arguments: {} }));
    expect(Array.isArray(answer.threads)).toBe(true);
  });
});

describe("when it cannot answer", () => {
  it("returns the refusal as a readable result, never as a thrown exception", async () => {
    // A tool that throws hands the model a stack trace; a tool that returns
    // `isError` with a sentence hands it something to act on. This is the
    // whole reason `answering()` exists.
    await aCanvasWith("Roadmap", "the plan");
    const client = await host();
    const result = await client.callTool({ name: "read_item", arguments: { item: "itm_nope" } });
    expect(result.isError).toBe(true);
    expect(errorText(result)).toBeTruthy();
  });

  it("says so when the home cannot be reached, rather than dying at startup", async () => {
    // The connection is made per call on purpose: a daemon that is not up
    // yet, or a machine with no name yet, must be a refusal the caller can
    // fix and retry — not a server that is up and permanently broken.
    const client = await host({
      home: () => Promise.reject(new Error("no identity configured here")),
    });
    const result = await client.callTool({ name: "read_canvas", arguments: {} });
    expect(result.isError).toBe(true);
    expect(errorText(result)).toContain("no identity configured");
  });
});
