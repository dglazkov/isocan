import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { expect, it } from "vitest";
import { CanvasHandle, DaemonClient, Home, harnessVars, type Ctx } from "@isocan/api";
import { newCanvasId } from "@isocan/core";
import { startDaemon } from "@isocan/server";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.ts";

it("admits known addresses through API, MCP and CLI without discovering other link-only canvases", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-address-owner-"));
  const visitorHome = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-address-visitor-"));
  const work = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-address-work-"));
  const daemon = await startDaemon({ home, port: 0, servesWorld: true, contentPort: "off", auth: null, birthHome: null });
  let host: Client | undefined;
  let server: ReturnType<typeof createServer> | undefined;
  try {
    const address = daemon.app.server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    const base = `http://127.0.0.1:${port}`;
    const ownerRoutes = new DaemonClient(base, home);
    const visitorRoutes = new DaemonClient(base, visitorHome);
    const owner = (await ownerRoutes.claimActor({ type: "actor.claim", sessionKey: "test:owner", name: "Acme Owner" })).envelope.actor;
    const visitor = (await visitorRoutes.claimActor({ type: "actor.claim", sessionKey: "test:visitor", name: "Acme Visitor" })).envelope.actor;
    const make = async (title: string) => {
      const id = newCanvasId();
      await ownerRoutes.sendOp(null, owner, { type: "project.create", canvasId: id, title, groupMode: "groups" });
      const handle = new CanvasHandle({ client: ownerRoutes, actor: owner } as unknown as Ctx, (await ownerRoutes.snapshot(id)).project);
      await handle.add({ title: `${title} item`, content: title, mime: "text/markdown" });
      return handle;
    };
    const linked = await make("Acme Link");
    const explicit = await make("Acme Explicit");
    const fallback = await make("Acme Default");
    const bound = await make("Acme Bound");
    const closed = await make("Confidential title");
    const grant = (await ownerRoutes.grants(closed.id)).grants.find((row) => row.subject === "link")!;
    await ownerRoutes.revokeGrant(closed.id, grant.id, owner.id);

    const visitorApi = new Home({ client: visitorRoutes, actor: visitor, home: visitorHome, homeOf: async () => null } as unknown as Ctx);
    server = createServer({ home: async () => visitorApi });
    host = new Client({ name: "acme-address-host", version: "1" });
    const [c, s] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(s), host.connect(c)]);
    expect(await visitorRoutes.listCanvases()).toEqual([]);
    expect((await host.listResources()).resources).toEqual([]);
    await expect(visitorApi.canvas("Acme")).rejects.toThrow(/no canvas matches/);
    await expect(visitorApi.canvas(closed.id)).rejects.toMatchObject({ status: 403, code: "not-admitted" });
    for (const suffix of ["", "/context"]) {
      const refused = await host.readResource({ uri: `isocan://canvas/${closed.id}${suffix}` }).catch((error: Error) => error);
      expect(refused).toBeInstanceOf(Error);
      expect((refused as Error).message).toContain("not admitted");
      expect((refused as Error).message).not.toContain("Confidential");
    }
    expect((await host.listResources()).resources).toEqual([]);

    // Home.canvas is the resource's path too: knowing an id reaches the door
    // even while a directory lookup cannot show that address to this badge.
    const resource = await host.readResource({ uri: `isocan://canvas/${linked.id}` });
    expect((resource.contents[0] as { text: string }).text).toContain("Acme Link item");
    expect((await visitorApi.canvas(linked.id)).record.title).toBe("Acme Link");
    expect((await visitorRoutes.listCanvases()).map((canvas) => canvas.id)).toEqual([linked.id]);
    const refusedTool = await host.callTool({ name: "read_canvas", arguments: { canvas: closed.id } });
    expect(refusedTool.isError).toBe(true);
    expect(JSON.stringify(refusedTool)).toContain("not admitted");
    expect(JSON.stringify(refusedTool)).not.toContain("Confidential");

    const env: Record<string, string> = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));
    for (const key of harnessVars) delete env[key];
    delete env.ISOCAN_DIRECT;
    Object.assign(env, { ISOCAN_HOME: visitorHome, ISOCAN_PORT: String(port), ISOCAN_HARNESS: "test", ISOCAN_SESSION_ID: "visitor" });
    const cli = fileURLToPath(new URL("../../cli/bin/isocan.js", import.meta.url));
    const run = (...args: string[]) => promisify(execFile)(process.execPath, [cli, "--json", ...args, "ls"], { cwd: work, env, timeout: 10_000 });
    await expect(run("--canvas", "Acme Explicit")).rejects.toMatchObject({ stderr: expect.stringContaining("no canvas matches") });
    expect((await visitorRoutes.listCanvases()).map((canvas) => canvas.id)).toEqual([linked.id]);
    expect((await run("--canvas", explicit.id)).stdout).toContain("Acme Explicit item");
    await expect(run("--canvas", closed.id)).rejects.toMatchObject({ stderr: expect.stringContaining("not admitted") });

    // Saved defaults and committed markers already carry full addresses.
    // They must reach the same door before falling into creation/replication.
    await fs.writeFile(path.join(visitorHome, "config.json"), JSON.stringify({ defaultProjectId: fallback.id }));
    expect((await run()).stdout).toContain("Acme Default item");
    await fs.mkdir(path.join(work, ".isocan"));
    await fs.writeFile(path.join(work, ".isocan", "project.json"), JSON.stringify({ canvasId: bound.id, title: bound.title }));
    expect((await run()).stdout).toContain("Acme Bound item");
    expect((await visitorRoutes.listCanvases()).map((canvas) => canvas.id).sort()).toEqual([linked.id, explicit.id, fallback.id, bound.id].sort());
    expect(JSON.stringify(await host.listResources())).not.toContain("Confidential");
  } finally {
    await host?.close(); await server?.close(); await daemon.close();
    for (const directory of [home, visitorHome, work]) await fs.rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}, 20_000);
