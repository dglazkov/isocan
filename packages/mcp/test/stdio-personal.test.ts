import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it, vi } from "vitest";
import { CanvasHandle, DaemonClient, harnessVars, type Ctx } from "@isocan/api";
import { canvasItemOf, newCanvasId, type Actor, type ContextLayer } from "@isocan/core";
import { startDaemon } from "@isocan/server";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

/** A real stdio host holds one person's badge and two agent sessions. The
 * person's existing own admission must never become either agent's authority. */
it("keeps personal source authority explicit across ambient resources and simultaneous stdio calls", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-mcp-personal-"));
  const personHome = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-mcp-personal-person-"));
  const work = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-mcp-personal-work-"));
  const daemon = await startDaemon({ home, port: 0, contentPort: "off", auth: null, birthHome: null, servesWorld: true });
  const address = daemon.app.server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}`;
  const routes = new DaemonClient(base, personHome);
  const sharedRoutes = new DaemonClient(base, home);
  let host: Client | undefined;
  try {
    const owner = (await routes.claimActor({ type: "actor.claim", sessionKey: "home:owner", name: "Maya" })).envelope.actor;
    const other = (await routes.claimActor({ type: "actor.claim", sessionKey: "home:other", name: "Theo" })).envelope.actor;
    const source = (await routes.ensurePersonal(owner.id)).source!.canvasId;
    const otherSource = (await routes.ensurePersonal(other.id)).source!.canvasId;
    expect(otherSource).not.toBe(source);
    const handle = async (id: string, actor = owner) => new CanvasHandle({ client: routes, actor, home, homeOf: async () => null } as unknown as Ctx, (await routes.snapshot(id)).project);
    const privateCanvas = await handle(source);
    await routes.sendOp(source, owner, { type: "project.update", patch: { title: "PRIVATE_SOURCE_TITLE" } });
    const preference = await privateCanvas.add({ title: "PRIVATE_PIN_TITLE", content: "PRIVATE_PHONE_390", mime: "text/plain", properties: { context: "pinned" } });
    const saved = await privateCanvas.comment(preference.id, "Acme saved request", { rootIds: [preference.id] });
    const destination = newCanvasId();
    await routes.sendOp(null, owner, { type: "project.create", canvasId: destination, title: "Acme project", groupMode: "groups" });
    const project = await handle(destination);
    const linked = await routes.linkPersonal(destination, { actorId: owner.id, requestId: "acme-link" });
    for (const memory of ["", "inherit"]) {
      const card = canvasItemOf(base, source);
      await project.add({ title: "Acme copied source card", content: card.blob, mime: card.mimeType, properties: { ...card.properties, memory } });
    }
    // A real owner-claim pass endows this separate machine's badge. The MCP
    // session then keys that explicit handoff; claim_agent cannot enroll birth.
    for (const [canvasId, actor, session] of [[source, owner, "owner"], [otherSource, other, "other"]] as const) {
      await sharedRoutes.redeemPass((await routes.mintPass(canvasId, actor.id)).token);
      await sharedRoutes.claimActor({ type: "actor.claim", sessionKey: `mcp:${session}`, as: actor.id });
    }
    await fs.writeFile(path.join(home, "config.json"), JSON.stringify({ defaultProjectId: source }));
    const env = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));
    for (const key of harnessVars) delete env[key];
    delete env.ISOCAN_DIRECT;
    Object.assign(env, { ISOCAN_HOME: home, ISOCAN_PORT: String(address.port), ISOCAN_HARNESS: "mcp", ISOCAN_SESSION_ID: "owner" });
    const transport = new StdioClientTransport({ command: process.execPath, args: [fileURLToPath(new URL("../../cli/bin/isocan.js", import.meta.url)), "mcp"], cwd: work, env, stderr: "pipe" });
    let stderr = "";
    transport.stderr?.on("data", (data: Buffer) => { stderr += data.toString(); });
    host = new Client({ name: "same-shared-harness", version: "1" });
    await host.connect(transport);
    const call = (name: string, args: Record<string, unknown> = {}) => host!.callTool({ name, arguments: args });
    const ok = async <T = Record<string, unknown>>(name: string, args: Record<string, unknown> = {}): Promise<T> => {
      const result = await call(name, args);
      expect(result.isError, JSON.stringify(result)).toBeUndefined();
      return JSON.parse((result.content as Array<{ text: string }>)[0]!.text) as T;
    };
    const refused = async (name: string, args: Record<string, unknown> = {}) => {
      const result = await call(name, args);
      expect(result.isError, JSON.stringify(result)).toBe(true);
      expect(JSON.stringify(result)).not.toMatch(/PRIVATE_SOURCE_TITLE|PRIVATE_PIN_TITLE|PRIVATE_PHONE_390/);
    };
    const [rowan, birch] = await Promise.all([
      ok<{ actor: Actor }>("claim_agent", { session: "rowan", name: "Rowan" }),
      ok<{ actor: Actor }>("claim_agent", { session: "birch", name: "Birch" }),
    ]);
    expect(new Set([owner.id, other.id, rowan.actor.id, birch.actor.id]).size).toBe(4);
    await routes.setPersonalDelegate(source, rowan.actor.id, { actorId: owner.id, allowed: true });
    const snapshot = vi.spyOn(daemon.engine, "getSnapshot");
    const bytes = vi.spyOn(daemon.store, "openBlob");
    const runtime = vi.spyOn(daemon.engine as unknown as { runtime(id: string): Promise<unknown> }, "runtime");
    const log = vi.spyOn(daemon.engine, "getLog");
    const load = vi.spyOn(daemon.store, "load");
    const privateBytes = () => bytes.mock.calls.filter(([id]) => id === source || id === otherSource);
    const clearReads = () => { for (const spy of [snapshot, bytes, runtime, log, load]) spy.mockClear(); };
    const noPrivateReads = () => {
      for (const spy of [snapshot, bytes, runtime, log, load]) expect(spy.mock.calls.filter(([id]) => id === source || id === otherSource)).toEqual([]);
    };

    const ambient = await ok("list_canvases");
    expect(JSON.stringify(ambient)).not.toContain(source);
    expect(JSON.stringify(ambient)).not.toContain(otherSource);
    const resources = await host.listResources();
    expect(JSON.stringify(resources)).not.toContain(source);
    expect(JSON.stringify(resources)).not.toContain(otherSource);
    for (const canvas of [source, "PRIVATE_SOURCE_", undefined]) await refused("read_canvas", canvas ? { canvas } : {});
    for (const canvas of [source, undefined]) {
      await refused("read_activity", canvas ? { canvas } : {});
      await refused("wait_for_feedback", { ...(canvas ? { canvas } : {}), cursor: 0, timeoutMs: 100 });
    }
    for (const suffix of ["", "/context"]) await expect(host.readResource({ uri: `isocan://canvas/${source}${suffix}` })).rejects.toThrow();
    await Promise.all(["rowan", "birch", "other"].map((session) => refused("read_canvas", { canvas: source, session })));
    noPrivateReads();

    // The ordinary explicit owner path still works, but one owner's session
    // does not reveal another person's source held on the very same badge.
    const [ownerRead] = await Promise.all([
      ok("read_context_content", { canvas: source, session: "owner", item: preference.id, thread: saved.threadId, comment: saved.commentId }),
      refused("read_item", { canvas: otherSource, session: "owner", item: preference.id }),
    ]);
    expect(JSON.stringify(ownerRead)).toContain("PRIVATE_PHONE_390");
    expect(JSON.stringify(await ok("list_canvases", { session: "owner" }))).toContain(source);
    expect(JSON.stringify(await ok("list_canvases", { session: "rowan" }))).not.toContain(source);
    clearReads();
    const [delegated, denied, ambientSummary] = await Promise.all([
      ok<{ layers: ContextLayer[] }>("read_context_summary", { canvas: destination, session: "rowan" }),
      ok<{ layers: ContextLayer[] }>("read_context_summary", { canvas: destination, session: "birch" }),
      ok<{ layers: ContextLayer[] }>("read_context_summary", { canvas: destination }),
    ]);
    expect(delegated.layers.find((layer) => layer.kind === "personal")).toMatchObject({ itemId: linked.link.itemId, owner: { id: owner.id }, pieces: [expect.objectContaining({ name: "PRIVATE_PIN_TITLE" })] });
    expect(denied.layers.find((layer) => layer.kind === "personal")).toMatchObject({ pieces: [], refused: expect.any(String) });
    expect(ambientSummary.layers.some((layer) => layer.kind === "personal")).toBe(false);
    for (const layer of delegated.layers.filter((layer) => layer.kind === "inherited")) expect(layer).toMatchObject({ pieces: [], refused: expect.any(String) });
    expect(privateBytes()).toEqual([]);
    expect(JSON.stringify(delegated)).not.toContain("PRIVATE_PHONE_390");
    await routes.setPersonalDelegate(source, rowan.actor.id, { actorId: owner.id, allowed: false });
    clearReads();
    expect((await ok<{ layers: ContextLayer[] }>("read_context_summary", { canvas: destination, session: "rowan" })).layers.find((layer) => layer.kind === "personal")).toMatchObject({ pieces: [], refused: expect.any(String) });
    noPrivateReads();

    // A current link is independent ordinary sharing. View is insufficient,
    // read does not grant edit, and link never makes this source discoverable.
    const badge = (await daemon.desk.claimants(owner.id))[0]!.badgeId;
    const grant = { id: "gnt_acme_personal_link", canvasId: source, subject: "link" as const, capability: "view" as const, grantedBy: badge, at: new Date().toISOString() };
    await daemon.desk.putGrant(grant);
    await refused("read_item", { canvas: source, session: "birch", item: preference.id });
    await daemon.desk.putGrant({ ...grant, capability: "read" });
    expect(JSON.stringify(await ok("read_context_content", { canvas: source, session: "birch", item: preference.id, thread: saved.threadId, comment: saved.commentId }))).toContain("PRIVATE_PHONE_390");
    expect(JSON.stringify(await ok("read_context_summary", { canvas: source, session: "birch" }))).toContain("PRIVATE_PIN_TITLE");
    expect(JSON.stringify(await ok("list_canvases", { session: "birch" }))).not.toContain(source);
    const before = await daemon.store.tipSeq(source);
    clearReads();
    await refused("edit_item", { canvas: source, session: "birch", item: preference.id, content: "Borrowed own must not write" });
    noPrivateReads();
    expect(await daemon.store.tipSeq(source)).toBe(before);
    await routes.revokeGrant(source, grant.id, owner.id);
    clearReads();
    await refused("read_item", { canvas: source, session: "birch", item: preference.id });
    noPrivateReads();
    const sharedManifest = JSON.stringify(await ok("read_context", { canvas: destination, session: "rowan" }));
    expect(sharedManifest).not.toContain("PRIVATE_");
    for (const version of preference.versions) {
      expect(sharedManifest).not.toContain(version.id);
      expect(sharedManifest).not.toContain(version.blobHash);
    }
    expect((await host.listTools()).tools.some((tool) => tool.name === "read_personal_context")).toBe(false);
    expect(stderr).not.toMatch(/SyntaxError|UnhandledPromiseRejection/);
  } finally {
    vi.restoreAllMocks();
    await host?.close();
    await daemon.close();
    await Promise.all([home, personHome, work].map((directory) => fs.rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })));
  }
}, 30_000);
