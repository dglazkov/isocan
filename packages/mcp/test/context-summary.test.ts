import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, it, vi } from "vitest";
import { CanvasHandle, DaemonClient, Home, type Ctx, type ExplicitIdentity } from "@isocan/api";
import { canvasItemOf, designSystemProperties, newCanvasId, type Actor, type ContextLayer } from "@isocan/core";
import { startDaemon } from "@isocan/server";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.ts";

it("reads live local/inherited layers without leaking private memory or unadmitted resources", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-mcp-context-"));
  const otherHome = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-mcp-private-"));
  const daemon = await startDaemon({ home, port: 0, servesWorld: true, contentPort: "off", auth: null, birthHome: null });
  const address = daemon.app.server.address();
  const base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  const routes = new DaemonClient(base, home);
  const otherRoutes = new DaemonClient(base, otherHome);
  const owner = (await routes.claimActor({ type: "actor.claim", sessionKey: "test:owner", name: "Acme Owner" })).envelope.actor;
  const stranger = (await otherRoutes.claimActor({ type: "actor.claim", sessionKey: "test:private", name: "Acme Other" })).envelope.actor;
  const make = async (client: DaemonClient, actor: Actor, title: string) => {
    const id = newCanvasId();
    await client.sendOp(null, actor, { type: "project.create", canvasId: id, title, groupMode: "groups" });
    return new CanvasHandle({ client, actor, home, homeOf: async () => null } as unknown as Ctx, (await client.snapshot(id)).project);
  };
  const here = await make(routes, owner, "Acme Work");
  const library = await make(routes, owner, "Acme Library");
  const personal = await make(routes, owner, "Acme Personal");
  const excludedLibrary = await make(routes, owner, "Acme excluded library");
  const locked = await make(otherRoutes, stranger, "Confidential source title");
  const linkGrant = (await otherRoutes.grants(locked.id)).grants.find((grant) => grant.subject === "link")!;
  await otherRoutes.revokeGrant(locked.id, linkGrant.id, stranger.id);
  const context = { client: routes, actor: owner, home, homeOf: async () => null } as unknown as Ctx;
  const connections: Array<ExplicitIdentity | undefined> = [];
  const server = createServer({ home: async (identity) => { connections.push(identity); return new Home(context); } });
  const host = new Client({ name: "acme-summary-host", version: "1" });
  const [c, s] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(s), host.connect(c)]);
  try {
    const add = (handle: CanvasHandle, title: string, properties: Record<string, string> = {}, group?: string) => handle.add({ title, content: title, mime: "text/markdown", properties, ...(group ? { in: group } : {}) });
    await add(here, "Acme local design", designSystemProperties());
    await add(library, "Acme inherited design", designSystemProperties());
    const pin = await add(library, "Acme inherited brief", { context: "pinned" });
    const excluded = (await library.groups.new("Acme skipped group")).itemId!;
    await library.set(excluded, { properties: { context: "excluded" } });
    await add(library, "Acme excluded nested pin", { context: "pinned" }, excluded);
    await add(personal, "Personal memory must not be assembled", { context: "pinned" });
    await add(excludedLibrary, "Excluded inherited memory", { context: "pinned" });
    await add(locked, "Confidential pin title", { context: "pinned" });
    const localExcluded = (await here.groups.new("Acme local excluded group")).itemId!;
    await here.set(localExcluded, { properties: { context: "excluded" } });
    await add(here, "Acme local excluded pin", { context: "pinned" }, localExcluded);
    let linkY = 0;
    const link = async (id: string, title: string, memory = "inherit", origin = base) => {
      const card = canvasItemOf(origin, id);
      return here.add({ title, at: { x: 5000, y: linkY += 1000 }, content: card.blob, mime: card.mimeType, properties: { ...card.properties, memory } });
    };
    await link(library.id, "Library card");
    await link(locked.id, "Unavailable card");
    await link(personal.id, "Personal card", "personal");
    await link(newCanvasId(), "Elsewhere card", "inherit", "https://elsewhere.invalid");
    const excludedCard = await link(excludedLibrary.id, "Excluded inheritance edge");
    await here.groups.add(localExcluded, [excludedCard.id]);
    const read = async (session: string | undefined = "explicit-caller"): Promise<{ layers: ContextLayer[] }> => {
      const result = await host.callTool({ name: "read_context_summary", arguments: { canvas: here.id, ...(session ? { session } : {}) } });
      expect(result.isError, JSON.stringify(result)).toBeUndefined();
      return JSON.parse((result.content as Array<{ text: string }>)[0]!.text);
    };
    const seen = await routes.seen();
    const seq = (await routes.snapshot(here.id)).lastSeq;
    const asked = vi.spyOn(daemon.engine, "getSnapshot");
    const first = await read();
    expect(first.layers.map((layer) => layer.heading)).toEqual(["This canvas", "Acme Library", "Unavailable card", "Elsewhere card", "Personal card"]);
    const local = first.layers[0]!;
    expect(local.pieces.find((piece) => piece.name === "Pinned items")?.present).toBe(false);
    expect(local.pieces.find((piece) => piece.name === "Excluded items")?.size).toContain("Acme local excluded group");
    expect(local.pieces.filter((piece) => piece.source === "machine")).toEqual([]);
    const inherited = first.layers[1]!;
    expect(inherited.pieces.find((piece) => piece.name === "Design system")).toMatchObject({ overridden: "this canvas's wins", stale: expect.stringContaining("items have changed") });
    expect(inherited.pieces.find((piece) => piece.name === "Pinned items")?.size).toBe("Acme inherited brief");
    expect(inherited.pieces.find((piece) => piece.name === "Excluded items")?.size).toContain("Acme skipped group");
    expect(first.layers[2]).toMatchObject({ pieces: [], refused: expect.any(String) });
    expect(first.layers[3]).toMatchObject({ pieces: [], refused: expect.stringContaining("not read from here") });
    expect(first.layers[4]).toMatchObject({ kind: "personal", owner: null, pieces: [], refused: expect.any(String) });
    expect(asked.mock.calls.some(([id]) => id === personal.id)).toBe(false);
    expect(asked.mock.calls.some(([id]) => id === excludedLibrary.id)).toBe(false);
    expect(JSON.stringify(first)).not.toMatch(/Confidential|Personal memory|excluded nested pin|local excluded pin/);
    await library.set(pin.id, { removeProperties: ["context"] });
    expect((await read()).layers[1]!.pieces.some((piece) => piece.name === "Pinned items")).toBe(false);

    const listed = await host.listResources();
    expect(listed.resources.some((resource) => resource.uri.includes(locked.id))).toBe(false);
    expect(JSON.stringify(listed)).not.toContain("Confidential");
    for (const suffix of ["", "/context"]) {
      await expect(host.readResource({ uri: `isocan://canvas/${locked.id}${suffix}` })).rejects.toThrow(/not admitted/);
    }
    const resource = await host.readResource({ uri: `isocan://canvas/${here.id}/context` });
    expect(connections.at(-1)).toBeUndefined();
    expect(JSON.parse((resource.contents[0] as { text: string }).text)).toEqual(await read(""));
    expect(await routes.seen()).toEqual(seen);
    expect((await routes.snapshot(here.id)).lastSeq).toBe(seq);
  } finally {
    await host.close(); await server.close(); await daemon.close();
    await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    await fs.rm(otherHome, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}, 15_000);
