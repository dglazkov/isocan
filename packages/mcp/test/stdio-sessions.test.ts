import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it, vi } from "vitest";
import { CanvasHandle, DaemonClient, harnessVars, type Ctx } from "@isocan/api";
import { newCanvasId, type Actor, type Item, type WatchedLogEntry } from "@isocan/core";
import { startDaemon } from "@isocan/server";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

/** A real host spawns the source CLI. Two conversations share that one stdio
 * server, with an unrelated ambient identity, and overlap their held polls. */
it("keeps two stdio sessions attributed, addressed, cancellable and durable across restart", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-mcp-stdio-"));
  const work = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-mcp-stdio-work-"));
  const daemon = await startDaemon({ home, port: 0, contentPort: "off", auth: null, birthHome: null });
  const address = daemon.app.server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  const routes = new DaemonClient(`http://127.0.0.1:${port}`, home);
  const ambient = (await routes.claimActor({ type: "actor.claim", sessionKey: "test:ambient", name: "Acme Owner" })).envelope.actor;
  const canvas = newCanvasId();
  await routes.sendOp(null, ambient, { type: "project.create", canvasId: canvas, title: "Acme collaboration", groupMode: "groups" });
  const handle = new CanvasHandle({ client: routes, actor: ambient, home, homeOf: async () => null } as unknown as Ctx, (await routes.snapshot(canvas)).project);
  const env: Record<string, string> = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));
  for (const key of harnessVars) delete env[key];
  delete env.ISOCAN_DIRECT;
  Object.assign(env, { ISOCAN_HOME: home, ISOCAN_PORT: String(port), ISOCAN_HARNESS: "test", ISOCAN_SESSION_ID: "ambient" });
  const command = fileURLToPath(new URL("../../cli/bin/isocan.js", import.meta.url));
  let stderr = "";
  const spawnHost = async () => {
    const transport = new StdioClientTransport({ command: process.execPath, args: [command, "mcp"], cwd: work, env, stderr: "pipe" });
    transport.stderr?.on("data", (data: Buffer) => { stderr += data.toString(); });
    const client = new Client({ name: "same-manager-application", version: "1" });
    await client.connect(transport);
    return client;
  };
  let client: Client | undefined;
  let watches = 0;
  const onEvent = daemon.engine.onEvent.bind(daemon.engine);
  const watchSpy = vi.spyOn(daemon.engine, "onEvent").mockImplementation((listener) => {
    watches++;
    const off = onEvent(listener);
    return () => { watches--; off(); };
  });
  try {
    client = await spawnHost();
    const call = async <T = Record<string, unknown>>(name: string, args: Record<string, unknown> = {}): Promise<T> => {
      const result = await client!.callTool({ name, arguments: { canvas, ...args } });
      expect(result.isError, JSON.stringify(result)).toBeUndefined();
      return JSON.parse((result.content as Array<{ text: string }>)[0]!.text) as T;
    };
    const [a, b] = await Promise.all([
      call<{ actor: Actor }>("claim_agent", { session: "conversation-a", name: "Cedar" }),
      call<{ actor: Actor }>("claim_agent", { session: "conversation-b", name: "Birch" }),
    ]);
    expect(new Set([a.actor.id, b.actor.id, ambient.id]).size).toBe(3);
    const reclaim = await Promise.all(["Cedar", "Cedar"].map((name) => call<{ actor: Actor }>("claim_agent", { session: "conversation-a", name })));
    expect(reclaim.map((result) => result.actor.id)).toEqual([a.actor.id, a.actor.id]);
    const [first, second] = await Promise.all([
      call<Item>("create_item", { session: "conversation-a", content: "Cedar original", title: "Acme first" }),
      call<Item>("create_item", { session: "conversation-b", content: "Birch original", title: "Acme second" }),
    ]);
    expect(first.createdBy.id).toBe(a.actor.id);
    expect(second.createdBy.id).toBe(b.actor.id);
    const absent = await client.callTool({ name: "create_item", arguments: { canvas, session: "unclaimed", content: "Must not land" } });
    expect(absent.isError).toBe(true);
    expect(JSON.stringify(absent)).toContain("mcp:unclaimed");
    expect(Object.keys((await routes.snapshot(canvas)).canvas.items)).toHaveLength(2);
    const edited = await call<Item>("edit_item", { session: "conversation-a", item: first.id, content: "Cedar revision" });
    expect(edited.versions.at(-1)!.createdBy.id).toBe(a.actor.id);
    expect(edited.versions).toHaveLength(2);
    const own = await call<Item>("create_item", { content: "Ambient still owns this", title: "Acme ambient" });
    expect(own.createdBy.id).toBe(ambient.id);

    const beforeRead = (await routes.snapshot(canvas)).lastSeq;
    const seenBefore = await routes.seen();
    const listed = await client.listResources();
    expect(listed.resources.map((resource) => resource.uri)).toEqual(expect.arrayContaining([`isocan://canvas/${canvas}`, `isocan://canvas/${canvas}/context`]));
    const resource = await client.readResource({ uri: `isocan://canvas/${canvas}/context` });
    expect(JSON.parse((resource.contents[0] as { text: string }).text)).toEqual(await call("read_context_summary"));
    expect((await client.listResourceTemplates()).resourceTemplates).toHaveLength(2);
    await expect(client.readResource({ uri: "isocan://canvas/prj_unavailable" })).rejects.toThrow(/canvas not found/);
    expect((await routes.snapshot(canvas)).lastSeq).toBe(beforeRead);
    expect(await routes.seen()).toEqual(seenBefore);

    type Feedback = { status: string; cursor: number; entries: WatchedLogEntry[] };
    const waitingA = call<Feedback>("wait_for_feedback", { session: "conversation-a", cursor: beforeRead, timeoutMs: 5000 });
    const waitingB = call<Feedback>("wait_for_feedback", { session: "conversation-b", cursor: beforeRead, timeoutMs: 5000 });
    await expect.poll(() => watches).toBe(2);
    const threadA = await handle.comment(first.id, "@Cedar please review");
    const threadB = await handle.comment(second.id, "@Birch please review");
    const [heardA, heardB] = await Promise.all([waitingA, waitingB]);
    expect(heardA.status).toBe("feedback");
    expect(heardB.status).toBe("feedback");
    expect(JSON.stringify(heardA.entries)).toContain(threadA.commentId);
    expect(JSON.stringify(heardA.entries)).not.toContain(threadB.commentId);
    expect(JSON.stringify(heardB.entries)).toContain(threadB.commentId);
    expect(JSON.stringify(heardB.entries)).not.toContain(threadA.commentId);
    await expect.poll(() => watches).toBe(0);

    const reply = await call<{ commentId: string }>("reply_comment", { session: "conversation-a", thread: threadA.threadId, message: "Reviewed this" });
    const quiet = await call<Feedback>("wait_for_feedback", { session: "conversation-a", cursor: heardA.cursor, timeoutMs: 150 });
    expect(quiet).toMatchObject({ status: "timeout", entries: [] });
    expect(quiet.cursor).toBe((await routes.snapshot(canvas)).lastSeq);
    expect(quiet.cursor).toBeGreaterThan(heardA.cursor);
    expect(JSON.stringify(quiet)).not.toContain(reply.commentId);
    // A quiet deadline aborts the HTTP poll. Its response-close event crosses
    // the socket after the MCP answer, just as explicit cancellation does.
    await expect.poll(() => watches).toBe(0);
    const followup = await handle.reply(threadA.threadId, "One more detail");
    const participating = await call<Feedback>("wait_for_feedback", { session: "conversation-a", cursor: quiet.cursor, timeoutMs: 150 });
    expect(JSON.stringify(participating.entries)).toContain(followup.commentId);
    const other = await call<Feedback>("wait_for_feedback", { session: "conversation-b", cursor: quiet.cursor, timeoutMs: 150 });
    expect(other).toMatchObject({ status: "timeout", entries: [] });

    const posted = await call<{ threadId: string; commentId: string }>("post_comment", { session: "conversation-b", item: second.id, message: "@Cedar inspect the saved original", roots: [second.id] });
    await call("edit_item", { session: "conversation-b", item: second.id, content: "Birch revision" });
    expect(await call("read_context_content", { session: "conversation-a", ...{ thread: posted.threadId, comment: posted.commentId, item: second.id } })).toMatchObject({ data: "Birch original" });
    const snapshot = await routes.snapshot(canvas);
    expect(snapshot.canvas.threads[posted.threadId]!.comments.at(-1)!.author.id).toBe(b.actor.id);
    expect(snapshot.canvas.threads[posted.threadId]!.comments.at(-1)!.mentions).toContain(a.actor.id);

    const controller = new AbortController();
    const cancelled = client.callTool({ name: "wait_for_feedback", arguments: { canvas, session: "conversation-a", cursor: snapshot.lastSeq, timeoutMs: 60000 } }, undefined, { signal: controller.signal });
    const cancellation = expect(cancelled).rejects.toThrow();
    await expect.poll(() => watches).toBe(1);
    controller.abort();
    await cancellation;
    await expect.poll(() => watches).toBe(0);
    expect(await routes.seen()).toEqual(seenBefore);
    expect(daemon.presence.roster(canvas)).toEqual([]);

    await client.close();
    client = await spawnHost();
    const resumed = await call<Item>("create_item", { session: "conversation-a", title: "Acme restart", content: "Same Cedar" });
    expect(resumed.createdBy.id).toBe(a.actor.id);
    expect((await call<{ actor: Actor }>("claim_agent", { session: "conversation-b", name: "Birch" })).actor.id).toBe(b.actor.id);
    expect((await call("list_canvases")).you).toBe(ambient.name);
    expect(stderr).not.toMatch(/SyntaxError|UnhandledPromiseRejection/);
  } finally {
    await client?.close();
    watchSpy.mockRestore();
    await daemon.close();
    await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    await fs.rm(work, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}, 30_000);
