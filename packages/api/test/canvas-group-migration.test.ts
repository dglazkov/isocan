import { afterEach, expect, it, vi } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { applyOperation, invertOperation, resolveCanvasGroupMigration, type CanvasState, type LogEntry, type Operation } from "@isocan/core";
import { CanvasGroups } from "../src/canvas-groups.ts";
import { DaemonRoutes } from "../src/routes.ts";
import { exportCanvases, importExport } from "../src/export.ts";
import { groupFixture } from "./group-fixture.ts";

const dirs: string[] = [];
afterEach(async () => { vi.unstubAllGlobals(); vi.restoreAllMocks(); for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });
async function directory() { const dir = await mkdtemp(path.join(os.tmpdir(), "isocan-group-migration-")); dirs.push(dir); return dir; }

it("previews at the authoritative route, applies its exact revision once, and reports repeated conversion without a write", async () => {
  const f = groupFixture(false); f.card("area", "Acme old sheet", 0, 0); f.card("card", "Acme card", 100, 200);
  f.apply({ type: "item.update", itemId: "area", patch: { properties: { kind: "area", board: "sketch", tint: "pink" } } });
  f.apply({ type: "item.resize", itemId: "area", width: 1200, height: 1000 });
  const original = structuredClone(f.state);
  const snapshot = vi.spyOn(f.client, "snapshot").mockRejectedValue(new Error("migration cannot use a cached snapshot"));
  const preview = await f.api.migrate({ dryRun: true });
  expect(preview).toMatchObject({ status: "ready", revision: 0, dryRun: true, history: { undoBoundarySeq: 1 } });
  expect(preview.live.find((row) => row.itemId === "card")).toMatchObject({ parentBefore: null, parentAfter: "area", boxAfter: { x: 100, y: 200, width: 400, height: 400 } });
  expect(f.state).toEqual(original); expect(f.writes).toHaveLength(0); expect(f.blobs.size).toBe(0); expect(snapshot).not.toHaveBeenCalled();
  const result = await f.api.migrate({ expectedRevision: preview.revision, opId: "op_acme_conversion" });
  expect(result).toMatchObject({ dryRun: false, seq: 1, envelope: { id: "op_acme_conversion", op: { type: "group.change", action: { kind: "apply", change: { schemaVersion: 4, intent: "migrate" } } } } });
  expect(f.state.project).toMatchObject({ groupMode: "groups", groupMigration: { version: 1, opId: "op_acme_conversion", seq: 1 } });
  expect(f.state.canvas.items.area!.properties).toEqual({ kind: "group", board: "sketch", tint: "pink" });
  expect(f.state.canvas.items.card).toMatchObject({ containerId: "area", x: 100, y: 200 });
  expect(await f.api.migrate()).toMatchObject({ status: "already-groups", revision: 1 });
  expect(f.writes).toHaveLength(1);
});

it("refuses an explicitly stale plan before sending, and propagates a writer conflict arising after preview without retry", async () => {
  const f = groupFixture(false); f.card("a");
  const change = vi.spyOn(f.client, "changeGroup");
  await expect(f.api.migrate({ expectedRevision: 12 })).rejects.toThrow("migration preview changed");
  expect(change).not.toHaveBeenCalled();
  const transport = { ...f.client, changeGroup: vi.fn(async (...args: Parameters<typeof f.client.changeGroup>) => {
    await f.client.sendOp(f.state.project.id, f.actor, { type: "item.move", itemId: "a", x: 120, y: 240 });
    return f.client.changeGroup(...args);
  }) };
  const api = new CanvasGroups(transport, f.state.project.id, f.actor);
  await expect(api.migrate()).rejects.toThrow(/changed since migration preview/);
  expect(transport.changeGroup).toHaveBeenCalledTimes(1);
  expect(f.writes).toHaveLength(1); expect(f.state.project.groupMode).toBe("legacy");
  expect(f.state.canvas.items.a).toMatchObject({ x: 120, y: 240 });
});

it("exposes migration as a protected GET and forwards its original mode with the revision-bound public intent", async () => {
  const f = groupFixture(false);
  const preview = await f.client.groupMigrationPreview();
  const client = new DaemonRoutes("https://acme.invalid", await directory());
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(preview)).mockResolvedValueOnce(Response.json({ seq: 1, envelope: { id: "op_migration" } }));
  vi.stubGlobal("fetch", fetcher);
  expect(await client.groupMigrationPreview(f.state.project.id)).toEqual(preview);
  await client.changeGroup(f.state.project.id, f.actor, { kind: "migrate", expectedRevision: preview.revision }, "op_migration", "legacy");
  expect(fetcher.mock.calls[0]![0]).toBe("https://acme.invalid/api/projects/prj_acme/groups/migration");
  expect(fetcher.mock.calls[0]![1]?.method).toBe("GET");
  expect(JSON.parse(String(fetcher.mock.calls[1]![1]?.body))).toEqual({ canvasId: f.state.project.id, actor: f.actor, opId: "op_migration", originGroupMode: "legacy", op: { type: "group.change", action: { kind: "migrate", expectedRevision: 0 } } });
});

it.each(["legacy", "converted", "undone"] as const)("native backup keeps %s mode and boundary through the actual export/import and reducer paths", async (stage) => {
  const actor = { id: "usr_acme", name: "Acme" }, ts = "2026-09-13T15:00:00Z", canvasId = "prj_acme_backup";
  const bytes = Buffer.from("Acme brief"), blobHash = createHash("sha256").update(bytes).digest("hex");
  const entries: LogEntry[] = [];
  let state: CanvasState | null = null;
  const append = (op: Operation) => {
    const seq = entries.length + 1;
    const envelope = { id: `op_${seq}`, canvasId, actor, ts, op };
    const inverse = invertOperation(state, op);
    state = applyOperation(state, envelope)!;
    entries.push({ seq, envelope, inverse });
  };
  append({ type: "project.create", canvasId, title: "Acme legacy backup", groupMode: "legacy" });
  append({ type: "item.add", itemId: "itm_area", title: "Acme old sheet", width: 1000, height: 1000, placement: { x: 0, y: 0, chosen: true }, properties: { kind: "area" }, version: { id: "ver_area", blobHash, mimeType: "text/markdown", filename: "area.md", size: bytes.length } });
  if (stage !== "legacy") append(resolveCanvasGroupMigration(state!, entries.length, { kind: "migrate", expectedRevision: entries.length }, { actor, ts, opId: "op_3" }));
  if (stage === "undone") append(entries.at(-1)!.inverse!);
  const original = state! as CanvasState;
  let adopted: CanvasState | null = null;
  const client = {
    base: "https://acme.invalid", snapshot: async () => ({ ...original, lastSeq: entries.length, names: {}, colors: {} }),
    getArchivedLog: async () => entries.slice(0, 2), getLog: async () => entries.slice(2), actorNames: async () => ({}),
    downloadBlob: async () => bytes,
    adopt: async (_id: string, log: LogEntry[]) => { for (const entry of log) adopted = applyOperation(adopted, entry.envelope); return { seqs: log.length }; },
    uploadBlob: async () => ({ blobHash, size: bytes.length, mimeType: "text/markdown" }),
  } as unknown as DaemonRoutes;
  const out = await directory();
  await exportCanvases(client, [original.project], { out });
  const record = JSON.parse(await readFile(path.join(out, "projects", canvasId, "project.json"), "utf8"));
  expect(record.groupMode).toBe(stage === "converted" ? "groups" : "legacy");
  expect(record.groupMigration).toEqual(stage === "converted" ? { version: 1, opId: "op_3", seq: 3 } : undefined);
  const report = await importExport(client, out);
  expect(report.refused).toEqual([]); expect(report.restored[0]).toMatchObject({ uploaded: 1, failed: [] });
  expect(adopted).toEqual(original);
});

it.each([false, true])("keeps a captured legacy backup coherent when migration lands during history retrieval (new tail included: %s)", async (includeTail) => {
  const canvasId = "prj_acme_cutover", actor = { id: "usr_acme", name: "Acme" }, ts = "2026-09-13T15:00:00Z";
  const birth: LogEntry = { seq: 1, envelope: { id: "op_birth", canvasId, actor, ts, op: { type: "project.create", canvasId, title: "Acme race", groupMode: "legacy" } }, inverse: null };
  let state = applyOperation(null, birth.envelope)!;
  const original = structuredClone(state), entries = [birth];
  let restored: CanvasState | null = null;
  const client = {
    base: "https://acme.invalid", snapshot: async () => ({ ...structuredClone(state), lastSeq: entries.length, colors: {}, names: {} }),
    getArchivedLog: async () => [], actorNames: async () => ({}),
    getLog: async () => {
      const captured = [...entries];
      const op = resolveCanvasGroupMigration(state, 1, { kind: "migrate", expectedRevision: 1 }, { actor, ts, opId: "op_cutover" });
      const envelope = { id: "op_cutover", canvasId, actor, ts, op };
      const inverse = invertOperation(state, op); state = applyOperation(state, envelope)!;
      entries.push({ seq: 2, envelope, inverse });
      return includeTail ? entries : captured;
    },
    adopt: async (_id: string, log: LogEntry[]) => { for (const row of log) restored = applyOperation(restored, row.envelope); return { seqs: log.length }; },
  } as unknown as DaemonRoutes;
  const out = await directory();
  const report = await exportCanvases(client, [original.project], { out });
  expect(state.project.groupMode).toBe("groups");
  expect(report.canvases[0]).toMatchObject({ entries: 1, lastSeq: 1 });
  expect(JSON.parse(await readFile(path.join(out, "projects", canvasId, "project.json"), "utf8")).groupMode).toBe("legacy");
  expect((await importExport(client, out)).refused).toEqual([]);
  expect(restored).toEqual(original);
});

it("refuses a history gap before writing any snapshot instead of exporting mismatched mode metadata", async () => {
  const f = groupFixture(false);
  const client = { ...f.client, snapshot: async () => ({ ...await f.client.snapshot(), lastSeq: 3 }), getArchivedLog: async () => [], getLog: async () => [], actorNames: async () => ({}) } as unknown as DaemonRoutes;
  const out = await directory();
  await expect(exportCanvases(client, [f.state.project], { out })).rejects.toThrow(/incomplete operation history/);
  await expect(readFile(path.join(out, "projects", f.state.project.id, "project.json"))).rejects.toMatchObject({ code: "ENOENT" });
});
