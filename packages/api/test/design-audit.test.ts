import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { canvasItemOf, designSystemProperties, newCanvasId, SOURCE_POLICY_HEADER, parseSourcePolicyHeader } from "@isocan/core";
import { startDaemon, type Daemon } from "@isocan/server";
import { ApiError, CanvasHandle, DaemonClient, designAuditPort, repairDesignScreen, type Ctx, type DesignRepairPort } from "@isocan/api";
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

async function repairFixture() {
  const canvas = await create("Acme repair");
  const system = await canvas.add({ title: "DESIGN.md", content: auditDesign(), mime: "text/markdown", properties: designSystemProperties() });
  const screen = await canvas.add({ title: "Acme screen", content: auditHtml, mime: "text/html" });
  const report = await canvas.designAudit({ itemIds: [screen.id] });
  const item = report.items[0]!;
  if (item.status !== "audited") throw new Error(item.reason);
  const request = { canvasId: canvas.id, itemId: screen.id, text: '<p style="padding:16px;color:#112233">Acme repaired</p>', expectedVersionId: screen.currentVersionId, expectedGoverning: item.governing, expectedRuleVersion: item.ruleVersion };
  const port: DesignRepairPort = {
    ...designAuditPort(ctx), snapshot: id => ctx.client.snapshot(id), home: async () => ctx.client.base,
    upload: (id, text, filename) => ctx.client.uploadBlob(id, Buffer.from(text), "text/html", filename),
    edit: async (id, operation) => { await ctx.client.sendOp(id, ctx.actor, operation); return { accepted: true }; },
  };
  return { canvas, system, screen, request, port };
}

it("an explicit repair is one conditional version and one undo, while stale versions are preserved", async () => {
  const { canvas, screen, request } = await repairFixture();
  const before = await ctx.client.snapshot(canvas.id);
  const result = await canvas.designRepair(screen.id, request);
  expect(result).toMatchObject({ status: "saved", before: { diagnostics: [{ code: "design/missing-variable" }, { code: "design/off-scale-spacing" }] }, proposed: { status: "audited", diagnostics: [], blobHash: null, input: { kind: "draft", baseVersionId: screen.currentVersionId } }, after: { status: "available", report: { offSystem: 0 } }, governingChanged: false, superseded: false });
  if (result.status !== "saved") throw new Error("Repair was not saved");
  const after = await ctx.client.snapshot(canvas.id);
  expect(after.lastSeq).toBe(before.lastSeq + 1);
  expect(after.canvas.items[screen.id]!.versions).toHaveLength(2);
  expect(after.canvas.items[screen.id]!.currentVersionId).toBe(result.versionId);
  expect((await ctx.client.getLog(canvas.id, 0)).at(-1)?.envelope.op.type).toBe("item.edit");
  const refused = await canvas.designRepair(screen.id, request);
  expect(refused).toMatchObject({ status: "refused", code: "stale-version" });
  expect((await ctx.client.snapshot(canvas.id)).lastSeq).toBe(after.lastSeq);
  await ctx.client.undo(canvas.id, ctx.actor);
  expect((await canvas.item(screen.id)).currentVersionId).toBe(screen.currentVersionId);
});

it("changed governing/rule captures are refused before upload and a mid-upload policy change is checked again", async () => {
  const { canvas, system, request, port } = await repairFixture();
  const upload = vi.spyOn(port, "upload");
  expect(await repairDesignScreen(port, { ...request, expectedRuleVersion: "old" })).toMatchObject({ status: "refused", code: "rule-version-changed" });
  await canvas.edit(system.id, { content: auditDesign("Acme changed", "24px") });
  expect(await repairDesignScreen(port, request)).toMatchObject({ status: "refused", code: "governing-changed" });
  expect(upload).not.toHaveBeenCalled();
  const current = (await canvas.designAudit({ itemIds: [request.itemId] })).items[0]!;
  if (current.status !== "audited") throw new Error(current.reason);
  upload.mockImplementation(async (...args) => {
    const result = await ctx.client.uploadBlob(args[0], Buffer.from(args[1]), "text/html", args[2]);
    await canvas.edit(system.id, { content: auditDesign("Acme changed again", "32px") });
    return result;
  });
  const edit = vi.spyOn(port, "edit");
  expect(await repairDesignScreen(port, { ...request, expectedGoverning: current.governing })).toMatchObject({ status: "refused", code: "governing-changed" });
  expect(edit).not.toHaveBeenCalled();
});

it("a lost write receipt reports pending even when the actual daemon already committed the version", async () => {
  const { canvas, screen, request, port } = await repairFixture();
  port.edit = async (id, operation) => { await ctx.client.sendOp(id, ctx.actor, operation); throw new Error("synthetic lost write response"); };
  const before = await ctx.client.snapshot(canvas.id);
  const result = await repairDesignScreen(port, request);
  expect(result).toMatchObject({ status: "pending", reason: "synthetic lost write response" });
  if (result.status !== "pending") throw new Error("Expected unconfirmed receipt");
  const after = await ctx.client.snapshot(canvas.id);
  expect(after.lastSeq).toBe(before.lastSeq + 1);
  expect(after.canvas.items[screen.id]!.currentVersionId).toBe(result.versionId);
  expect(after.canvas.items[screen.id]!.versions).toHaveLength(2);
});

it("a concurrent edit after the last preflight is authoritatively refused by item.edit", async () => {
  const { canvas, screen, request } = await repairFixture();
  const send = ctx.client.sendOp.bind(ctx.client);
  let concurrentVersion = "";
  vi.spyOn(ctx.client, "sendOp").mockImplementation(async (...args) => {
    if (args[2].type === "item.edit") concurrentVersion = (await canvas.edit(screen.id, { content: '<p style="padding:16px">Acme concurrent edit</p>' })).currentVersionId;
    return send(...args);
  });
  expect(await canvas.designRepair(screen.id, request)).toMatchObject({ status: "refused", code: "write-refused" });
  const after = await canvas.item(screen.id);
  expect(after.currentVersionId).toBe(concurrentVersion);
  expect(after.versions).toHaveLength(2);
});

it("the Node adapter keeps an HTTP timeout pending when the actual daemon committed the repair", async () => {
  const { canvas, screen, request } = await repairFixture();
  const send = ctx.client.sendOp.bind(ctx.client);
  vi.spyOn(ctx.client, "sendOp").mockImplementation(async (...args) => {
    const receipt = await send(...args);
    if (args[2].type === "item.edit") throw new ApiError(408, "synthetic response timed out");
    return receipt;
  });
  const before = await ctx.client.snapshot(canvas.id);
  const result = await canvas.designRepair(screen.id, request);
  expect(result).toMatchObject({ status: "pending", reason: "synthetic response timed out" });
  if (result.status !== "pending") throw new Error("Expected an unconfirmed HTTP receipt");
  const after = await ctx.client.snapshot(canvas.id);
  expect(after.lastSeq).toBe(before.lastSeq + 1);
  expect(after.canvas.items[screen.id]!.currentVersionId).toBe(result.versionId);
  expect(after.canvas.items[screen.id]!.versions).toHaveLength(2);
});

it("post-save read failures and governing changes remain saved evidence rather than a failed write", async () => {
  const { canvas, system, screen, request, port } = await repairFixture();
  const edit = port.edit;
  port.edit = async (...args) => { const receipt = await edit(...args); port.snapshot = async () => { throw new Error("synthetic later read failed"); }; return receipt; };
  const result = await repairDesignScreen(port, request);
  expect(result).toMatchObject({ status: "saved", after: { status: "unavailable", reason: "synthetic later read failed" }, governingChanged: null, superseded: null });
  if (result.status !== "saved") throw new Error("Expected accepted save");
  expect((await canvas.item(screen.id)).currentVersionId).toBe(result.versionId);
  port.snapshot = id => ctx.client.snapshot(id);
  const capture = (await canvas.designAudit({ itemIds: [screen.id] })).items[0]!;
  if (capture.status !== "audited") throw new Error(capture.reason);
  port.edit = async (...args) => { const receipt = await edit(...args); await canvas.edit(system.id, { content: auditDesign("Acme latest", "24px") }); return receipt; };
  expect(await repairDesignScreen(port, { ...request, expectedVersionId: result.versionId, expectedGoverning: capture.governing })).toMatchObject({ status: "saved", governingChanged: true, after: { status: "available", report: { offSystem: 1 } } });
  const latest = (await canvas.designAudit({ itemIds: [screen.id] })).items[0]!;
  if (latest.status !== "audited") throw new Error(latest.reason);
  port.edit = async (...args) => { const receipt = await edit(...args); await canvas.edit(screen.id, { content: '<p style="padding:24px">Acme newer current</p>' }); return receipt; };
  const superseded = await repairDesignScreen(port, { ...request, expectedVersionId: latest.versionId, expectedGoverning: latest.governing });
  expect(superseded).toMatchObject({ status: "saved", superseded: true, governingChanged: false });
  if (superseded.status !== "saved") throw new Error("Expected accepted save");
  expect((await canvas.item(screen.id)).currentVersionId).not.toBe(superseded.versionId);
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
