import { describe, expect, it, afterEach } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { exportCanvases, exportItem } from "../src/export.ts";
import type { DaemonRoutes } from "../src/routes.ts";
import { CanvasHandle } from "../src/connect.ts";
import type { Ctx } from "../src/ctx.ts";
import { groupFixture } from "./group-fixture.ts";
const dirs: string[] = [];
afterEach(async () => { for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });
async function output() { const out = await mkdtemp(path.join(os.tmpdir(), "isocan-group-export-")); dirs.push(out); return out; }

it("backs up every explicit group descendant and both version faces without inventing partial adoption", async () => {
  const f = groupFixture(); const handle = new CanvasHandle({ client: f.client, actor: f.actor } as unknown as Ctx, f.state.project);
  const group = (await f.api.new("Acme group")).itemId!;
  const item = await handle.add({ title: "Acme content", content: "Acme source", mime: "text/markdown", in: group });
  const image = await f.client.uploadBlob(f.state.project.id, Buffer.from("Acme visual"), "image/png", "face.png");
  f.apply({ type: "item.addVersion", itemId: item.id, version: { ...item.versions[0]!, id: "ver_dual", visual: { ...image, filename: "face.png" } } });
  const ink = await handle.add({ title: "Acme annotation", content: '<svg viewBox="0 0 100 100"/>', mime: "image/svg+xml", properties: { kind: "drawing", annotates: group, region: "0,0,1,1" }, size: { width: 100, height: 100 } });
  await handle.add({ title: "Acme unrelated", content: "not in group", mime: "text/markdown" });
  const client = { ...f.client, getArchivedLog: async () => [], getLog: async () => f.writes.map((write, index) => ({ seq: index + 1, ...write })) } as unknown as DaemonRoutes;
  const out = await output();
  const report = await exportItem(client, f.state.project, f.state.canvas.items[group]!, { out });
  expect(new Set(report.items.map((row) => row.itemId))).toEqual(new Set([group, item.id, ink.id]));
  expect(f.state.canvas.items[ink.id]!.containerId).toBeUndefined();
  expect(report.canvases).toEqual([]);
  expect(JSON.parse(await readFile(path.join(out, "items", f.state.project.id, item.id, "item.json"), "utf8"))).toMatchObject({ containerId: group });
  const visual = report.written.find((file) => file.endsWith("02-visual-face.png"))!;
  expect(await readFile(path.join(out, visual), "utf8")).toBe("Acme visual");
  expect(report.items.every((row) => row.missing.length === 0)).toBe(true);
});

it("discovers retained source and distinct visual metadata from saved snapshot context even without a live item", async () => {
  const f = groupFixture(); const handle = new CanvasHandle({ client: f.client, actor: f.actor } as unknown as Ctx, f.state.project);
  const group = (await f.api.new("Acme group")).itemId!;
  const item = await handle.add({ title: "Acme source", content: "Retained source", mime: "text/markdown", filename: "source.md", in: group });
  const visual = await f.client.uploadBlob(f.state.project.id, Buffer.from("Retained visual"), "image/png", "face.png");
  f.apply({ type: "item.addVersion", itemId: item.id, version: { ...item.versions[0]!, id: "ver_retained", visual: { ...visual, filename: "face.png" } } });
  const saved = await handle.notify("Retain", { in: group });
  await handle.remove(group);
  await f.client.sendOp(f.state.project.id, f.actor, { type: "trash.empty" });
  // A native backup now requires a complete archive/live prefix. The saved
  // request still owns these bytes after both the live item and trash are gone.
  const birth = { seq: 1, envelope: { id: "op_birth", canvasId: f.state.project.id, actor: f.actor, ts: "2026-09-12T15:00:00.000Z", op: { type: "project.create", canvasId: f.state.project.id, title: f.state.project.title, groupMode: "groups" } }, inverse: null };
  const client = { ...f.client, snapshot: async () => ({ ...await f.client.snapshot(), lastSeq: f.writes.length + 1 }), getArchivedLog: async () => [birth], getLog: async () => f.writes.map((row, index) => ({ seq: index + 2, ...row })), actorNames: async () => ({}) } as unknown as DaemonRoutes;
  const out = await output();
  const report = await exportCanvases(client, [f.state.project], { out });
  const indexFile = report.written.find((file) => file.endsWith("blobs.json"))!;
  const index = JSON.parse(await readFile(path.join(out, indexFile), "utf8"));
  expect(index[item.versions[0]!.blobHash]).toMatchObject({ mimeType: "text/markdown", filename: "source.md", size: 15 });
  expect(index[visual.blobHash]).toMatchObject({ mimeType: "image/png", filename: "face.png", size: 15 });
  expect(await readFile(path.join(out, "projects", f.state.project.id, "blobs", index[visual.blobHash].file), "utf8")).toBe("Retained visual");
  const threadsFile = report.written.find((file) => file.endsWith("canvas.json"))!;
  expect(await readFile(path.join(out, threadsFile), "utf8")).toContain(saved.commentId);
});
