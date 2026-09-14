import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { canvasItemOf, designSystemProperties, newCanvasId, SOURCE_POLICY_HEADER, parseSourcePolicyHeader } from "@isocan/core";
import { startDaemon, type Daemon } from "@isocan/server";
import { CanvasHandle, DaemonClient, type Ctx } from "@isocan/api";
import { auditDesign, auditHtml } from "./design-audit-fixture.ts";

let daemon: Daemon;
let home: string;
let ctx: Ctx;
beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-design-audit-"));
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  if (!address || typeof address === "string") throw new Error("No daemon address");
  const client = new DaemonClient(`http://127.0.0.1:${address.port}`, home);
  await client.claimActor({ type: "actor.claim", sessionKey: "acme:design-audit", name: "Acme Audit" });
  const actor = (await client.actorBindings(["acme:design-audit"]))[0]!.actor;
  ctx = { client, actor, home, harness: "acme", birthHome: null, binding: null,
    homeOf: async () => null, homes: async () => ({ birth: null, links: [], rows: {}, legacy: false, rowFor: () => null }) };
});
afterEach(async () => {
  vi.restoreAllMocks();
  await daemon?.close();
  await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

async function create(title: string) {
  const id = newCanvasId();
  await ctx.client.sendOp(null, ctx.actor, { type: "project.create", canvasId: id, title, groupMode: "groups" });
  return new CanvasHandle(ctx, (await ctx.client.snapshot(id)).project);
}

it("Node API reads a scoped-only nested group and an inherited library through the actual daemon", async () => {
  const canvas = await create("Acme screens");
  const library = await create("Acme library");
  const inherited = await library.add({ title: "Acme library DESIGN.md", content: auditDesign("Acme library", "13px"), mime: "text/markdown", properties: designSystemProperties() });
  const outer = await canvas.groups.new("Acme outer");
  const inner = await canvas.groups.new("Acme inner");
  await canvas.groups.add(outer.itemId!, [inner.itemId!], { place: true });
  const design = await canvas.add({ title: "Acme lane DESIGN.md", content: auditDesign("Acme lane"), mime: "text/markdown", properties: designSystemProperties(), in: outer.itemId! });
  const nested = await canvas.add({ title: "Acme nested screen", content: auditHtml, mime: "text/html", in: inner.itemId! });
  const scoped = await canvas.designAudit();
  expect(scoped).toMatchObject({ system: "Acme lane", screens: 1, audited: 1, offSystem: 1, items: [{ itemId: nested.id, governing: { itemId: design.id, canvasId: canvas.id } }] });
  const outside = await canvas.add({ title: "Acme outside screen", content: auditHtml, mime: "text/html" });
  const card = canvasItemOf(ctx.client.base, library.id);
  await canvas.add({ title: "Acme source", content: ctx.client.base, mime: "text/plain", properties: { ...card.properties, memory: "inherit" } });
  const reads: Array<{ url: string; headers: Headers }> = [];
  daemon.app.server.on("request", request => {
    const headers = new Headers();
    for (const [key, value] of Object.entries(request.headers)) if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(",") : value);
    reads.push({ url: `${ctx.client.base}${request.url}`, headers });
  });
  const before = await ctx.client.snapshot(canvas.id);
  const report = await canvas.designAudit();
  expect(report).toMatchObject({ system: "Multiple design systems", screens: 2, audited: 2, unavailable: 0, offSystem: 1 });
  expect(report.items.find(item => item.itemId === outside.id)).toMatchObject({ versionId: outside.currentVersionId, blobHash: outside.versions[0]!.blobHash, governing: { canvasId: library.id, itemId: inherited.id, versionId: inherited.currentVersionId, blobHash: inherited.versions[0]!.blobHash, inherited: true }, offSystem: [], onSystem: 1 });
  const inheritedReads = reads.filter(read => read.url.includes(`/api/projects/${library.id}/`));
  expect(inheritedReads.map(read => new URL(read.url).pathname)).toEqual([`/api/projects/${library.id}/canvas`, `/api/projects/${library.id}/blobs/${inherited.versions[0]!.blobHash}`]);
  for (const read of inheritedReads) expect(parseSourcePolicyHeader(read.headers.get(SOURCE_POLICY_HEADER)!)).toEqual({ policy: { mode: "exclude" }, expectedHome: ctx.client.base });
  expect(await ctx.client.snapshot(canvas.id)).toEqual(before);
});
