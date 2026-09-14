import { promises as fs } from "node:fs";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { SOURCE_POLICY_HEADER, canvasItemOf, parseSourcePolicyHeader, type Actor, type Canvas, type CanvasContents, type Item, type SourceRequestContext } from "@isocan/core";
import { DaemonClient } from "../src/client.ts";
import { Home } from "../src/connect.ts";
import type { Ctx } from "../src/ctx.ts";
import { linkedCanvasesOf } from "../src/context-summary.ts";

/** A wire recorder tests client policy plumbing; authoritative admission is proved by MCP's real daemon suite. */
async function fixture() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-source-wire-"));
  const owner: Actor = { id: "usr_acme", name: "Acme" };
  const project = { id: "prj_acme", title: "Acme Work", createdBy: owner, properties: {}, groupMode: "groups" } as Canvas;
  const contents: CanvasContents = { items: {}, threads: {}, trash: [] };
  const calls: Array<{ route: string; method: string; context: Omit<SourceRequestContext, "signal"> | null; body: unknown }> = [];
  let held = 0;
  let stall: string | null = null;
  let recoverRecap = false;
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const raw = Buffer.concat(chunks).toString();
    const route = req.url!;
    const policy = req.headers[SOURCE_POLICY_HEADER.toLowerCase()];
    calls.push({ route, method: req.method!, context: typeof policy === "string" ? parseSourcePolicyHeader(policy) : null,
      body: req.headers["content-type"] === "application/json" && raw ? JSON.parse(raw) : raw });
    if (stall === route) {
      held++;
      res.on("close", () => held--);
      return;
    }
    if (recoverRecap && route.endsWith("/context/recap")) {
      recoverRecap = false;
      res.writeHead(401, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "badge required", code: "no-badge" })); return;
    }
    let value: unknown;
    if (route === "/api/homes") value = { birth: null, canvases: { [project.id]: null }, links: [] };
    else if (route === "/api/projects") value = [project];
    else if (route === "/api/source-access") value = { kind: "ordinary", capability: "edit" };
    else if (route.startsWith("/api/source-classification?")) value = { kind: "ordinary" };
    else if (route === "/api/door") value = { badgeId: "bdg_acme", secret: "synthetic-secret" };
    else if (route.endsWith("/context/recap")) value = { canvasId: route.split("/")[3], home: base, title: "Acme source", revision: 1,
      head: { fromSeq: 1, toSeq: 1, fromTs: "2026-09-13T10:00:00Z", toTs: "2026-09-13T10:00:00Z", count: 1, comments: 0, actors: [], items: [],
        omitted: { earlierAvailableOps: 0, actors: 0, items: 0, hiddenItems: 0, clippedLabels: 0 } } };
    else if (route.endsWith("/canvas")) value = { project, canvas: contents, lastSeq: 0 };
    else if (route.endsWith("/blobs") && req.method === "POST") value = { blobHash: "acme_hash", mimeType: "text/plain", filename: "Acme.txt", size: raw.length };
    else if (route.includes("/blobs/")) { res.writeHead(200, { "Content-Type": "text/plain" }); res.end("Acme bytes"); return; }
    else { res.writeHead(404); res.end(JSON.stringify({ error: `unknown synthetic route ${route}` })); return; }
    res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(value));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  const ctx = { client: new DaemonClient(base, directory), actor: owner, home: directory, binding: null, birthHome: null,
    homeOf: async () => null } as unknown as Ctx;
  return { project, contents, calls, base, ctx, directory, home: new Home(ctx), held: () => held, stall: (route = "/api/source-access") => { stall = route; }, recoverRecap: () => { recoverRecap = true; }, close: async () => {
    server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve()));
    await fs.rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  } };
}

it("keeps simultaneous source policies separate through preflight, resolved snapshots and raw bytes", async () => {
  const f = await fixture();
  try {
    const said = { mode: "direct" as const, actorId: f.ctx.actor.id, intent: "read" as "read" | "edit" };
    const reading = f.home.withSourcePolicy(said);
    said.intent = "edit";
    const [read, edit, ambient] = await Promise.all([
      reading.canvas(f.project.id),
      f.home.withSourcePolicy({ mode: "direct", actorId: f.ctx.actor.id, intent: "edit" }).canvas(f.project.id),
      f.home.withSourcePolicy({ mode: "exclude" }).canvas(f.project.id),
    ]);
    expect(read.ctx.client).not.toBe(edit.ctx.client);
    expect(read.ctx.client).not.toBe(f.ctx.client);
    expect(f.ctx.sourceContext).toBeUndefined();
    expect(read.ctx.sourceContext).toMatchObject({ policy: { intent: "read" }, expectedHome: f.base });
    expect(edit.ctx.sourceContext).toMatchObject({ policy: { intent: "edit" }, expectedHome: f.base });
    expect(ambient.ctx.sourceContext).toMatchObject({ policy: { mode: "exclude" }, expectedHome: f.base });
    const canvasRequests = f.calls.filter((call) => call.route.endsWith("/canvas"));
    expect(canvasRequests).toHaveLength(3);
    expect(canvasRequests.every((call) => call.context?.expectedHome === f.base)).toBe(true);
    const bodies = f.calls.filter((call) => call.route === "/api/source-access").map((call) => call.body);
    expect(bodies).toEqual(expect.arrayContaining([
      expect.objectContaining({ policy: { mode: "exclude" }, expectedHome: f.base }),
      expect.objectContaining({ policy: { mode: "direct", actorId: f.ctx.actor.id, intent: "read" }, expectedHome: f.base }),
      expect.objectContaining({ policy: { mode: "direct", actorId: f.ctx.actor.id, intent: "edit" }, expectedHome: f.base }),
    ]));
    await read.ctx.client.downloadBlob(f.project.id, "acme_hash");
    await edit.ctx.client.uploadBlob(f.project.id, Buffer.from("Acme edit"), "text/plain", "Acme.txt");
    expect(f.calls.at(-2)?.context).toMatchObject({ policy: { intent: "read" }, expectedHome: f.base });
    expect(f.calls.at(-1)?.context).toMatchObject({ policy: { intent: "edit" }, expectedHome: f.base });
  } finally { await f.close(); }
});

it.each(["default", "binding", "title"] as const)("binds source policy before %s target resolution can read a snapshot", async (kind) => {
  const f = await fixture();
  try {
    if (kind === "default") await fs.writeFile(path.join(f.directory, "config.json"), JSON.stringify({ defaultProjectId: f.project.id }));
    if (kind === "binding") f.ctx.binding = { root: f.directory, canvasId: f.project.id, home: f.base };
    const canvas = await f.home.withSourcePolicy({ mode: "exclude" }).canvas(kind === "title" ? "Acme" : undefined);
    await canvas.ctx.client.snapshot(canvas.id);
    const firstSnapshot = f.calls.findIndex((call) => call.route.endsWith("/canvas"));
    expect(firstSnapshot).toBeGreaterThan(-1);
    expect(f.calls[firstSnapshot]!.context).toEqual({ policy: { mode: "exclude" }, expectedHome: f.base });
    if (kind === "default" || kind === "binding") expect(f.calls.slice(0, firstSnapshot).some((call) => call.route === "/api/source-access")).toBe(true);
    else expect(f.calls.filter((call) => call.route === "/api/projects").every((call) => call.context?.policy.mode === "exclude")).toBe(true);
  } finally { await f.close(); }
});

it("cancels source preflight before it can issue a resolving snapshot", async () => {
  const f = await fixture();
  try {
    f.stall();
    const controller = new AbortController();
    const result = f.home.withSourcePolicy({ mode: "exclude" }, controller.signal).canvas(f.project.id);
    const rejected = expect(result).rejects.toThrow();
    await expect.poll(f.held).toBe(1);
    controller.abort(new Error("Acme cancelled"));
    await rejected;
    await expect.poll(f.held).toBe(0);
    expect(f.calls.some((call) => call.route.endsWith("/canvas"))).toBe(false);
  } finally { await f.close(); }
});

it("binds the Node Context adapter's inherited snapshot and recovered recap to the classified authority", async () => {
  const f = await fixture();
  try {
    f.contents.items.itm_link = { id: "itm_link", title: "Acme source", x: 0, y: 0,
      properties: { ...canvasItemOf(f.base, "prj_source").properties, memory: "inherit" }, versions: [] } as unknown as Item;
    const canvas = await f.home.withSourcePolicy({ mode: "direct", actorId: f.ctx.actor.id, intent: "read" }).canvas(f.project.id);
    await linkedCanvasesOf(canvas.ctx, canvas.id, { canvas: f.contents });
    expect(f.calls.some((call) => call.route.endsWith("/context/recap"))).toBe(false);
    let reclaimed = 0;
    canvas.ctx.reclaimOn = (client) => { client.reclaimWith(async () => { reclaimed++; }); };
    f.recoverRecap();
    const layers = await canvas.contextSummary();
    const source = f.calls.find((call) => call.route === "/api/projects/prj_source/canvas");
    expect(source?.context).toEqual({ policy: { mode: "exclude" }, expectedHome: f.base });
    expect(f.calls.findIndex((call) => call.route.startsWith("/api/source-classification?"))).toBeLessThan(f.calls.indexOf(source!));
    expect(f.calls.filter((call) => call.route === "/api/projects/prj_acme/canvas").every((call) => call.context?.policy.mode === "direct")).toBe(true);
    expect(f.calls.some((call) => call.route.includes("/personal/read"))).toBe(false);
    expect(reclaimed).toBe(1);
    const heads = f.calls.filter((call) => call.route.endsWith("/context/recap"));
    expect(heads).toHaveLength(2);
    expect(heads.every((call) => call.context?.policy.mode === "exclude" && call.context.expectedHome === f.base && call.method === "GET")).toBe(true);
    expect(layers[1]?.pieces.find((piece) => piece.name === "Recent work")?.recap).toMatchObject({ canvasId: "prj_source", home: f.base, head: { count: 1 } });
  } finally { await f.close(); }
});

it("cancels a held inherited recap through the shared Context adapter without leaving a socket open", async () => {
  const f = await fixture();
  try {
    f.contents.items.itm_link = { id: "itm_link", title: "Acme source", x: 0, y: 0,
      properties: { ...canvasItemOf(f.base, "prj_source").properties, memory: "inherit" }, versions: [] } as unknown as Item;
    const controller = new AbortController();
    const canvas = await f.home.withSourcePolicy({ mode: "exclude" }, controller.signal).canvas(f.project.id);
    f.stall("/api/projects/prj_source/context/recap");
    const pending = canvas.contextSummary();
    const refused = expect(pending).rejects.toThrow("Acme closed Context");
    await expect.poll(f.held).toBe(1);
    controller.abort(new Error("Acme closed Context"));
    await refused;
    await expect.poll(f.held).toBe(0);
    expect(f.calls.filter((call) => call.route.endsWith("/context/recap"))).toHaveLength(1);
  } finally { await f.close(); }
});
