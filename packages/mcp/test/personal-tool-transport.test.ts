import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it, vi } from "vitest";
import { CanvasHandle, DaemonClient, harnessVars, type Ctx } from "@isocan/api";
import { canvasItemOf, designSystemProperties, newCanvasId, type Actor, type ContextLayer, type PersonalReadResponse } from "@isocan/core";
import { startDaemon } from "@isocan/server";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

/** The public SDK drives the shipped CLI's stdio entrypoint against a real
 * daemon. Both owners and both agents deliberately share one harness badge. */
it("reads current personal context through stdio without borrowing another session or changing shared context", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-personal-tool-"));
  const personHome = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-personal-tool-person-"));
  const work = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-personal-tool-work-"));
  const daemon = await startDaemon({ home, port: 0, contentPort: "off", auth: null, birthHome: null, servesWorld: true });
  const address = daemon.app.server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}`;
  const routes = new DaemonClient(base, personHome);
  const sharedRoutes = new DaemonClient(base, home);
  let host: Client | undefined;
  let transport: StdioClientTransport | undefined;
  try {
    const owner = (await routes.claimActor({ type: "actor.claim", sessionKey: "home:owner", name: "Maya" })).envelope.actor;
    const other = (await routes.claimActor({ type: "actor.claim", sessionKey: "home:other", name: "Theo" })).envelope.actor;
    const source = (await routes.ensurePersonal(owner.id)).source!.canvasId;
    const otherSource = (await routes.ensurePersonal(other.id)).source!.canvasId;
    const handle = async (id: string, actor = owner) => new CanvasHandle({ client: routes, actor, home: personHome, homeOf: async () => null } as unknown as Ctx, (await routes.snapshot(id)).project);
    const birth = async (title: string, actor = owner) => {
      const id = newCanvasId();
      await routes.sendOp(null, actor, { type: "project.create", canvasId: id, title, groupMode: "groups" });
      return handle(id, actor);
    };
    const privateCanvas = await handle(source);
    const design = await privateCanvas.add({ title: "Maya private design", content: "PRIVATE_DESIGN_280", mime: "text/plain", properties: designSystemProperties() });
    const oldPin = await privateCanvas.add({ title: "Maya private preference", content: "PRIVATE_OLD_390", mime: "text/plain", properties: { context: "pinned" } });
    const currentPin = await privateCanvas.edit(oldPin.id, { content: "PRIVATE_CURRENT_391" });
    const large = await privateCanvas.add({ title: "Maya long preference", content: "P".repeat(65_537), mime: "text/plain", properties: { context: "pinned" } });
    const unpinned = await privateCanvas.add({ title: "Maya unrelated item", content: "PRIVATE_UNPINNED_490", mime: "text/plain" });
    await privateCanvas.say("PRIVATE_CHAT_590");
    const privateOther = await handle(otherSource, other);
    const otherPin = await privateOther.add({ title: "Theo private preference", content: "PRIVATE_THEO_690", mime: "text/plain", properties: { context: "pinned" } });
    const project = await birth("Acme shared project");
    const otherProject = await birth("Acme second project", other);
    const inherited = await birth("Acme inherited design");
    await inherited.add({ title: "Acme inherited tokens", content: "Shared inherited design", mime: "text/plain", properties: designSystemProperties() });
    await project.add({ title: "Acme local tokens", content: "Shared local design", mime: "text/plain", properties: designSystemProperties() });
    const sharedPin = await project.add({ title: "Acme shared note", content: "Shared frozen original", mime: "text/plain", properties: { context: "pinned" } });
    const inheritedCard = canvasItemOf(base, inherited.id);
    await project.add({ title: "Acme inheritance", content: inheritedCard.blob, mime: inheritedCard.mimeType, properties: { ...inheritedCard.properties, memory: "inherit" } });
    const linked = await routes.linkPersonal(project.id, { actorId: owner.id, requestId: "maya-link" });
    const otherLinked = await routes.linkPersonal(otherProject.id, { actorId: other.id, requestId: "theo-link" });
    const saved = await project.comment(sharedPin.id, "Acme shared saved request", { rootIds: [sharedPin.id] });
    await project.edit(sharedPin.id, { content: "Shared live revision" });

    // Genuine owner passes transfer claims to the second machine; a same-name
    // claim alone would not authorize this badge or its MCP owner sessions.
    for (const [canvasId, actor, session] of [[source, owner, "owner"], [otherSource, other, "other"]] as const) {
      await sharedRoutes.redeemPass((await routes.mintPass(canvasId, actor.id)).token);
      await sharedRoutes.claimActor({ type: "actor.claim", sessionKey: `mcp:${session}`, as: actor.id });
    }
    await fs.mkdir(path.join(work, ".isocan"));
    await fs.writeFile(path.join(work, ".isocan", "project.json"), JSON.stringify({ canvasId: project.id, title: project.title }));
    // The process has an owner default, but the new tool must require its own
    // explicit session rather than silently borrowing that person's identity.
    await fs.writeFile(path.join(home, "config.json"), JSON.stringify({ defaultProjectId: source }));
    const env = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));
    for (const key of harnessVars) delete env[key];
    delete env.ISOCAN_DIRECT;
    Object.assign(env, { ISOCAN_HOME: home, ISOCAN_PORT: String(address.port), ISOCAN_HARNESS: "mcp", ISOCAN_SESSION_ID: "owner" });
    transport = new StdioClientTransport({ command: process.execPath, args: [fileURLToPath(new URL("../../cli/bin/isocan.js", import.meta.url)), "mcp"], cwd: work, env, stderr: "pipe" });
    let stderr = "";
    transport.stderr?.on("data", (data: Buffer) => { stderr += data.toString(); });
    host = new Client({ name: "personal-tool-transport", version: "1" });
    await host.connect(transport);
    const call = (name: string, args: Record<string, unknown> = {}) => host!.callTool({ name, arguments: args });
    const ok = async <T = Record<string, unknown>>(name: string, args: Record<string, unknown> = {}): Promise<T> => {
      const result = await call(name, args);
      expect(result.isError, JSON.stringify(result)).toBeUndefined();
      return JSON.parse((result.content as Array<{ text: string }>)[0]!.text) as T;
    };
    const refused = async (name: string, args: Record<string, unknown>) => {
      const result = await call(name, args);
      expect(result.isError, JSON.stringify(result)).toBe(true);
      expect(JSON.stringify(result)).not.toMatch(/PRIVATE_|Maya private|Theo private|Maya long/);
      return result;
    };
    const personal = (session: string, item = linked.link.itemId, canvas?: string, page: { cursor?: string; limit?: number } = {}) =>
      ok<PersonalReadResponse>("read_personal_context", { session, item, ...(canvas ? { canvas } : {}), ...page });
    const [rowan, birch] = await Promise.all([
      ok<{ actor: Actor }>("claim_agent", { session: "rowan", name: "Rowan" }),
      ok<{ actor: Actor }>("claim_agent", { session: "birch", name: "Birch" }),
    ]);
    expect(new Set([owner.id, other.id, rowan.actor.id, birch.actor.id]).size).toBe(4);
    await routes.setPersonalDelegate(source, rowan.actor.id, { actorId: owner.id, allowed: true });
    await routes.setPersonalDelegate(otherSource, birch.actor.id, { actorId: other.id, allowed: true });

    const snapshot = vi.spyOn(daemon.engine, "getSnapshot");
    const runtime = vi.spyOn(daemon.engine as unknown as { runtime(id: string): Promise<unknown> }, "runtime");
    const log = vi.spyOn(daemon.engine, "getLog");
    const load = vi.spyOn(daemon.store, "load");
    const bytes = vi.spyOn(daemon.store, "openBlob");
    const reads = [snapshot, runtime, log, load, bytes];
    const clearReads = () => { for (const spy of reads) spy.mockClear(); };
    const privateCalls = (spy: typeof bytes) => spy.mock.calls.filter(([id]) => id === source || id === otherSource);
    const noPrivateReads = () => {
      for (const spy of reads) expect(spy.mock.calls.filter(([id]) => id === source || id === otherSource)).toEqual([]);
    };
    const sharedState = async () => JSON.stringify({
      snapshot: (await routes.snapshot(project.id)).canvas,
      log: await daemon.engine.getLog(project.id),
    });
    const before = await sharedState();
    const frozenArgs = { canvas: project.id, session: "rowan", thread: saved.threadId, comment: saved.commentId };
    const frozenBefore = await ok("read_context", frozenArgs);

    const first = await personal("rowan");
    expect(first).toMatchObject({ kind: "personal", mode: "content", owner: { id: owner.id, name: "Maya" }, sourceCanvasId: source, home: base, itemId: linked.link.itemId });
    expect(first.pieces.map((piece) => piece.itemId)).toEqual([design.id, currentPin.id, large.id]);
    expect(first.pieces[0]).toMatchObject({ kind: "design", versionId: design.currentVersionId, text: "PRIVATE_DESIGN_280" });
    expect(first.pieces[1]).toMatchObject({ kind: "pin", versionId: currentPin.currentVersionId, text: "PRIVATE_CURRENT_391", mimeType: "text/plain" });
    expect(first.pieces[2]).toMatchObject({ bytes: 65_537, unavailable: "text truncated at 65536 bytes" });
    expect(Buffer.byteLength(first.pieces[2]!.text!)).toBe(65_536);
    expect(first.truncated).toBe(true);
    expect(first.nextCursor).toBeUndefined();
    expect(JSON.stringify(first)).not.toMatch(/PRIVATE_OLD_390|PRIVATE_UNPINNED_490|PRIVATE_CHAT_590|PRIVATE_THEO_690/);
    expect(JSON.stringify(first)).not.toContain(unpinned.id);

    clearReads();
    const summary = await ok<{ layers: ContextLayer[] }>("read_context_summary", { session: "rowan", canvas: project.id });
    expect(summary.layers.map((layer) => layer.kind)).toEqual(["local", "inherited", "personal"]);
    expect(summary.layers[1]).toMatchObject({ canvasId: inherited.id, pieces: expect.arrayContaining([expect.objectContaining({ name: "Design system", overridden: "this canvas's wins", from: { canvasId: inherited.id, title: "Acme inherited design" } })]) });
    expect(summary.layers[2]).toMatchObject({ canvasId: source, itemId: linked.link.itemId, owner: { id: owner.id, name: "Maya" }, pieces: expect.arrayContaining([expect.objectContaining({ name: "Maya private preference", from: { canvasId: source, title: "Maya's canvas" } })]) });
    expect(privateCalls(bytes)).toEqual([]);
    expect(JSON.stringify(summary)).not.toMatch(/PRIVATE_CURRENT_391|PRIVATE_DESIGN_280/);

    // Every refusal observation is isolated from authorized traffic. Empty
    // output alone would miss a private snapshot read followed by redaction.
    clearReads();
    await refused("read_personal_context", { session: "birch", item: linked.link.itemId, canvas: project.id });
    await refused("read_personal_context", { session: "other", item: linked.link.itemId, canvas: project.id });
    await refused("read_personal_context", { session: "never-claimed", item: linked.link.itemId, canvas: project.id });
    await refused("read_personal_context", { item: linked.link.itemId, canvas: project.id });
    await refused("read_personal_context", { session: "rowan", item: sharedPin.id, canvas: project.id });
    await refused("read_personal_context", { session: "rowan", item: linked.link.itemId, canvas: otherProject.id });
    const ambient = await ok<{ layers: ContextLayer[] }>("read_context_summary", { canvas: project.id });
    expect(ambient.layers.some((layer) => layer.kind === "personal")).toBe(false);
    expect(JSON.stringify(await ok("list_canvases"))).not.toContain(source);
    expect(JSON.stringify(await host.listResources())).not.toContain(source);
    for (const name of ["read_canvas", "read_threads", "read_activity"]) {
      await refused(name, { canvas: source });
      await refused(name, { canvas: source, session: "rowan" });
    }
    await expect(host.readResource({ uri: `isocan://canvas/${source}/context` })).rejects.toThrow();
    noPrivateReads();

    const [mayaRead, theoRead] = await Promise.all([
      personal("rowan", linked.link.itemId, project.id),
      personal("birch", otherLinked.link.itemId, otherProject.id),
    ]);
    expect(mayaRead.owner.id).toBe(owner.id);
    expect(JSON.stringify(mayaRead)).toContain("PRIVATE_CURRENT_391");
    expect(JSON.stringify(mayaRead)).not.toContain("PRIVATE_THEO_690");
    expect(theoRead).toMatchObject({ owner: { id: other.id }, sourceCanvasId: otherSource, itemId: otherLinked.link.itemId, pieces: [{ itemId: otherPin.id, text: "PRIVATE_THEO_690" }] });
    expect(JSON.stringify(theoRead)).not.toContain("PRIVATE_CURRENT_391");
    clearReads();
    await Promise.all([
      refused("read_personal_context", { session: "birch", item: linked.link.itemId, canvas: project.id }),
      refused("read_personal_context", { session: "rowan", item: otherLinked.link.itemId, canvas: otherProject.id }),
    ]);
    noPrivateReads();

    const page1 = await personal("rowan", linked.link.itemId, project.id, { limit: 1 });
    expect(page1.pieces.map((piece) => piece.itemId)).toEqual([design.id]);
    expect(page1.truncated).toBe(true);
    expect(page1.nextCursor).toEqual(expect.any(String));
    const page2 = await personal("rowan", linked.link.itemId, project.id, { limit: 1, cursor: page1.nextCursor! });
    expect(page2.pieces.map((piece) => piece.itemId)).toEqual([currentPin.id]);
    expect(page2.truncated).toBe(true);
    expect(page2.nextCursor).toEqual(expect.any(String));
    const page3 = await personal("rowan", linked.link.itemId, project.id, { limit: 1, cursor: page2.nextCursor! });
    expect(page3.pieces.map((piece) => piece.itemId)).toEqual([large.id]);
    expect(page3.nextCursor).toBeUndefined();
    const updated = await privateCanvas.edit(currentPin.id, { content: "PRIVATE_NEWEST_392" });
    const stale = await refused("read_personal_context", { session: "rowan", item: linked.link.itemId, canvas: project.id, limit: 1, cursor: page1.nextCursor });
    expect(JSON.stringify(stale)).toContain("personal content changed; restart the read");
    const fresh = await personal("rowan", linked.link.itemId, project.id);
    expect(fresh.pieces.find((piece) => piece.itemId === currentPin.id)).toMatchObject({ versionId: updated.currentVersionId, text: "PRIVATE_NEWEST_392" });
    expect(JSON.stringify(fresh)).not.toContain("PRIVATE_CURRENT_391");
    expect(await sharedState()).toBe(before);

    await routes.unlinkPersonal(project.id, { actorId: owner.id, requestId: "maya-unlink", itemId: linked.link.itemId });
    clearReads();
    await refused("read_personal_context", { session: "rowan", item: linked.link.itemId, canvas: project.id });
    noPrivateReads();
    await routes.undo(project.id, owner);
    expect((await personal("rowan", linked.link.itemId, project.id)).pieces.find((piece) => piece.itemId === currentPin.id)?.text).toBe("PRIVATE_NEWEST_392");
    const afterUndo = await sharedState();
    await routes.setPersonalDelegate(source, rowan.actor.id, { actorId: owner.id, allowed: false });
    clearReads();
    await refused("read_personal_context", { session: "rowan", item: linked.link.itemId, canvas: project.id });
    noPrivateReads();
    expect((await personal("owner", linked.link.itemId, project.id)).owner.id).toBe(owner.id);
    expect(await sharedState()).toBe(afterUndo);

    const frozenAfter = await ok("read_context", frozenArgs);
    expect(frozenAfter).toEqual(frozenBefore);
    const savedContent = await ok("read_context_content", { ...frozenArgs, item: sharedPin.id });
    expect(savedContent.data).toBe("Shared frozen original");
    const sharedManifest = JSON.stringify(await ok("read_context", { canvas: project.id, session: "rowan" }));
    for (const output of [JSON.stringify(frozenAfter), JSON.stringify(savedContent), sharedManifest]) {
      expect(output).not.toMatch(/PRIVATE_|Maya private|Maya long|Theo private/);
      for (const item of [design, updated, large, otherPin]) for (const version of item.versions) {
        expect(output).not.toContain(version.id);
        expect(output).not.toContain(version.blobHash);
      }
    }
    expect(stderr).not.toMatch(/SyntaxError|UnhandledPromiseRejection/);
  } finally {
    vi.restoreAllMocks();
    const pid = transport?.pid;
    try {
      // SDK close bounds stdin/TERM/KILL escalation; assert that its actual
      // child exited, not merely that the protocol connection was discarded.
      await host?.close();
      if (pid) await expect.poll(() => {
        try { process.kill(pid, 0); return false; } catch { return true; }
      }, { timeout: 5_000 }).toBe(true);
    } finally {
      await daemon.close();
      await Promise.all([home, personHome, work].map((directory) => fs.rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })));
    }
  }
}, 30_000);
