import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it, vi } from "vitest";
import { CanvasHandle, DaemonClient, harnessVars, type Ctx } from "@isocan/api";
import { canvasItemOf, designSystemProperties, formatRecapHead, contextReport, layersReport, newCanvasId, type Actor, type ContextLayer } from "@isocan/core";
import { startDaemon } from "@isocan/server";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

/** A spawned host reads the same bounded ordinary-source facts as the API;
 * private/excluded history is observed separately from successful reads. */
it("serves bounded inherited Recent work over stdio without copying private or frozen context", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-mcp-recap-"));
  const work = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-mcp-recap-work-"));
  const daemon = await startDaemon({ home, port: 0, contentPort: "off", auth: null, birthHome: null, servesWorld: true });
  const address = daemon.app.server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}`;
  const routes = new DaemonClient(base, home);
  let host: Client | undefined;
  try {
    const owner = (await routes.claimActor({ type: "actor.claim", sessionKey: "home:owner", name: "Maya" })).envelope.actor;
    const privateId = (await routes.ensurePersonal(owner.id)).source!.canvasId;
    const handle = async (id: string, actor = owner) => new CanvasHandle({ client: routes, actor, home, homeOf: async () => null } as unknown as Ctx, (await routes.snapshot(id)).project);
    const create = async (title: string) => {
      const id = newCanvasId();
      await routes.sendOp(null, owner, { type: "project.create", canvasId: id, title, groupMode: "groups" });
      return handle(id);
    };
    const destination = await create("Acme project");
    const source = await create("Acme shared source");
    const excludedSource = await create("Acme excluded source");
    await (await handle(privateId)).add({ title: "PRIVATE_HISTORY_TITLE", content: "PRIVATE_HISTORY_BYTES", mime: "text/plain", properties: { context: "pinned" } });
    await destination.add({ title: "Acme local design", content: "{}", mime: "application/json", properties: designSystemProperties() });
    await source.add({ title: "Acme inherited design", content: "{}", mime: "application/json", properties: designSystemProperties() });
    await source.add({ title: "Acme source pin", content: "Acme pinned rationale", mime: "text/plain", properties: { context: "pinned" } });
    const cards = [];
    for (let n = 0; n < 12; n++) cards.push(await source.add({ title: n === 0 ? "Acme " + "🌱".repeat(180) : `Acme screen ${n}`, content: `Acme source ${n}`, mime: "text/plain" }));
    const hidden = (await source.groups.new("EXCLUDED_GROUP_LABEL")).itemId!;
    await source.set(hidden, { properties: { context: "excluded" } });
    const hiddenChild = await source.add({ title: "EXCLUDED_CHILD_LABEL", content: "EXCLUDED_BODY", mime: "text/plain", in: hidden });
    const removed = await source.add({ title: "REMOVED_ITEM_LABEL", content: "REMOVED_BODY", mime: "text/plain" });
    const workers: Actor[] = [];
    for (let n = 0; n < 7; n++) workers.push((await routes.claimActor({ type: "actor.claim", sessionKey: `test:worker-${n}`, name: n === 0 ? "Acme " + "🌿".repeat(180) : `Acme worker ${n}` })).envelope.actor);
    const writers = await Promise.all(workers.map((actor) => handle(source.id, actor)));
    for (let n = 0; n < 110; n++) await writers[n % writers.length]!.set(cards[n % cards.length]!.id, { size: { width: 200 + n, height: 200 } });
    // Keep a clipped actor and item inside the displayed rows independent of
    // the random IDs used to break otherwise equally active item ties.
    for (let n = 0; n < 5; n++) await writers[0]!.set(cards[0]!.id, { size: { width: 500 + n, height: 200 } });
    await source.set(hiddenChild.id, { size: { width: 390, height: 200 } });
    await source.remove(removed.id);
    await source.notify("CHAT_PAYLOAD_MUST_NOT_ENTER_HEAD");
    const link = async (id: string, title: string, properties: Record<string, string> = {}) => {
      const made = canvasItemOf(base, id);
      return destination.add({ title, content: made.blob, mime: made.mimeType, properties: { ...made.properties, memory: "inherit", ...properties } });
    };
    const inherited = await link(source.id, "Shared source card");
    await link(privateId, "Copied personal source");
    await link(excludedSource.id, "Excluded edge", { context: "excluded" });
    const frozen = await destination.comment(inherited.id, "Acme frozen request", { rootIds: [inherited.id] });
    await routes.claimActor({ type: "actor.claim", sessionKey: "test:ambient", name: "Acme ambient" });

    const env = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));
    for (const key of harnessVars) delete env[key];
    delete env.ISOCAN_DIRECT;
    Object.assign(env, { ISOCAN_HOME: home, ISOCAN_PORT: String(address.port), ISOCAN_HARNESS: "test", ISOCAN_SESSION_ID: "ambient" });
    const transport = new StdioClientTransport({ command: process.execPath, args: [fileURLToPath(new URL("../../cli/bin/isocan.js", import.meta.url)), "mcp"], cwd: work, env, stderr: "pipe" });
    let stderr = "";
    transport.stderr?.on("data", (data: Buffer) => { stderr += data.toString(); });
    host = new Client({ name: "acme-recap-host", version: "1" });
    await host.connect(transport);
    const call = async <T>(name: string, args: Record<string, unknown> = {}): Promise<T> => {
      const answer = await host!.callTool({ name, arguments: { canvas: destination.id, ...args } });
      expect(answer.isError, JSON.stringify(answer)).toBeUndefined();
      return JSON.parse((answer.content as Array<{ text: string }>)[0]!.text) as T;
    };
    await call("claim_agent", { session: "rowan", name: "Rowan" });
    const expected = await routes.recapHead(source.id);
    const before = {
      source: await routes.snapshot(source.id), destination: await routes.snapshot(destination.id),
      sourceLog: await daemon.engine.getLog(source.id, 0), destinationLog: await daemon.engine.getLog(destination.id, 0),
      frozen: await call("read_context", { thread: frozen.threadId, comment: frozen.commentId }),
    };
    const snapshot = vi.spyOn(daemon.engine, "getSnapshot");
    const runtime = vi.spyOn(daemon.engine as unknown as { runtime(id: string): Promise<unknown> }, "runtime");
    const log = vi.spyOn(daemon.engine, "getLog");
    const load = vi.spyOn(daemon.store, "load");
    const archive = vi.spyOn(daemon.store, "readArchivedLog");
    const blob = vi.spyOn(daemon.store, "openBlob");
    const [ambient, explicit] = await Promise.all([
      call<{ layers: ContextLayer[] }>("read_context_summary"),
      call<{ layers: ContextLayer[] }>("read_context_summary", { session: "rowan" }),
    ]);
    const resource = await host.readResource({ uri: `isocan://canvas/${destination.id}/context` });
    const resourceLayers = JSON.parse((resource.contents[0] as { text: string }).text) as { layers: ContextLayer[] };
    for (const result of [ambient, explicit, resourceLayers]) {
      const layer = result.layers.find((one) => one.canvasId === source.id)!;
      const piece = layer.pieces.find((one) => one.name === "Recent work")!;
      expect(piece.recap).toEqual(expected);
      expect(piece.from).toEqual({ canvasId: source.id, title: expected.title });
      expect(layer.pieces.find((one) => one.name === "Design system")?.overridden).toBe("this canvas's wins");
      expect(layer.pieces.find((one) => one.name === "Pinned items")?.size).toBe("Acme source pin");
      expect(layersReport(result.layers, contextReport)).toContain(formatRecapHead(expected.head));
      expect(JSON.stringify(piece)).not.toMatch(/CHAT_PAYLOAD|EXCLUDED_|REMOVED_|PRIVATE_|blobHash|envelope|versions/);
      expect(result.layers.find((one) => one.canvasId === privateId)).toMatchObject({ pieces: [], refused: expect.any(String) });
    }
    expect(expected.head.count).toBe(100);
    expect(expected.head.toSeq).toBe(expected.revision);
    expect(expected.head.omitted).toMatchObject({ actors: expect.any(Number), items: expect.any(Number), clippedLabels: expect.any(Number) });
    expect(expected.head.omitted.earlierAvailableOps).toBeGreaterThan(0);
    expect(expected.head.omitted.actors).toBeGreaterThan(0);
    expect(expected.head.omitted.items).toBeGreaterThan(0);
    expect(expected.head.omitted.hiddenItems).toBeGreaterThan(0);
    expect(expected.head.omitted.clippedLabels).toBeGreaterThan(0);
    expect(expected.head.actors).toHaveLength(5);
    expect(expected.head.items).toHaveLength(8);
    for (const label of [...expected.head.actors.map((one) => one.name), ...expected.head.items.map((one) => one.title)]) expect(Array.from(label).length).toBeLessThanOrEqual(160);
    for (const spy of [snapshot, runtime, log, load, archive, blob]) expect(spy.mock.calls.filter(([id]) => id === privateId || id === excludedSource.id)).toEqual([]);

    archive.mockRejectedValueOnce(new Error("Acme archive temporarily unavailable"));
    const failed = await call<{ layers: ContextLayer[] }>("read_context_summary");
    const failedLayer = failed.layers.find((one) => one.canvasId === source.id)!;
    expect(failedLayer.refused).toBeUndefined();
    expect(failedLayer.pieces.find((one) => one.name === "Recent work")).toMatchObject({ present: false, stale: expect.any(String) });
    expect(failedLayer.pieces.filter((one) => ["Design system", "Pinned items"].includes(one.name)).every((one) => one.present)).toBe(true);
    expect(await routes.snapshot(source.id)).toEqual(before.source);
    expect(await routes.snapshot(destination.id)).toEqual(before.destination);
    expect(await daemon.engine.getLog(source.id, 0)).toEqual(before.sourceLog);
    expect(await daemon.engine.getLog(destination.id, 0)).toEqual(before.destinationLog);
    expect(await call("read_context", { thread: frozen.threadId, comment: frozen.commentId })).toEqual(before.frozen);
    expect(stderr).not.toMatch(/SyntaxError|UnhandledPromiseRejection/);
  } finally {
    vi.restoreAllMocks();
    await host?.close();
    await daemon.close();
    await Promise.all([home, work].map((directory) => fs.rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })));
  }
}, 30_000);
