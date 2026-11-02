import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { applyOperation, CANVAS_GROUPS_FEATURE, type Operation } from "@isocan/core";
import { Engine } from "../src/engine.ts";
import { FileStore } from "../src/file-store.ts";
import { FileDesk } from "../src/file-desk.ts";
import { mintBadge } from "../src/badges.ts";
import { requireGroupClient } from "../src/canvas-groups.ts";

const a = { id: "usr_a", name: "Acme A" }, b = { id: "usr_b", name: "Acme B" }, c = { id: "usr_c", name: "Acme C" };
const canvasId = "prj_migration";
let home: string, store: FileStore, desk: FileDesk, engine: Engine, badgeId: string;
const version = (id: string) => ({ id: `ver_${id}`, blobHash: `hash_${id}`, mimeType: "text/markdown", filename: "Acme.md", size: 12 });
const post = (op: Operation, actor = a, extras: { opId?: string; originGroupMode?: "legacy" | "groups"; clientFeatures?: string; group?: string } = {}) => engine.submit({ canvasId: op.type === "project.create" ? null : canvasId, actor, badgeId, op, clientFeatures: CANVAS_GROUPS_FEATURE, ...extras });
const undo = (actor = a) => engine.undo(canvasId, actor, badgeId, undefined, CANVAS_GROUPS_FEATURE);
const redo = (actor = a) => engine.redo(canvasId, actor, badgeId, undefined, CANVAS_GROUPS_FEATURE);
const add = (id: string, properties: Record<string, string> = {}, actor = a) => post({ type: "item.add", itemId: id, title: `Acme ${id}`, width: properties.kind === "area" ? 800 : 200, height: properties.kind === "area" ? 800 : 200, placement: { x: properties.kind === "area" ? 0 : 100, y: properties.kind === "area" ? 0 : 300, chosen: true }, version: version(id), properties }, actor);
async function migrate(actor = a, opId = "op_migrate") {
  const preview = await engine.groupMigrationPreview(canvasId);
  return post({ type: "group.change", action: { kind: "migrate", expectedRevision: preview.revision } }, actor, { opId, originGroupMode: "legacy" });
}
beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-migration-"));
  store = new FileStore(home); await store.init();
  desk = new FileDesk(home); await desk.init();
  const badge = mintBadge("bearer"); badgeId = badge.record.badgeId; await desk.put(badge.record);
  engine = new Engine(store, desk);
  for (const actor of [a, b, c]) await engine.claim({ badgeId, op: { type: "actor.claim", sessionKey: `test:${actor.id}`, as: actor.id, name: actor.name } });
  await post({ type: "project.create", canvasId, title: "Acme", groupMode: "legacy" });
});
afterEach(async () => { await desk.close(); await store.close(); await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

describe("production migration writer and durable history without sockets", () => {
  it("previews without writes, refuses stale or queued legacy work, and returns an accepted migration retry", async () => {
    await add("sheet", { kind: "area" }); await add("card");
    const before = await engine.getSnapshot(canvasId), log = await engine.getLog(canvasId);
    const preview = await engine.groupMigrationPreview(canvasId);
    expect(preview.live.find((row) => row.itemId === "card")!.parentAfter).toBe("sheet");
    expect(await engine.getSnapshot(canvasId)).toEqual(before); expect(await engine.getLog(canvasId)).toEqual(log);
    await post({ type: "item.update", itemId: "card", patch: { title: "Acme later" } }, b);
    const changed = await engine.getSnapshot(canvasId);
    await expect(post({ type: "group.change", action: { kind: "migrate", expectedRevision: preview.revision } })).rejects.toMatchObject({ code: "group-conflict" });
    expect(await engine.getSnapshot(canvasId)).toEqual(changed);
    const accepted = await migrate();
    const after = await engine.getSnapshot(canvasId);
    expect(after.project.groupMigration).toEqual({ version: 1, opId: "op_migrate", seq: accepted.seq });
    await expect(post({ type: "item.move", itemId: "sheet", x: 50, y: 50 }, b, { originGroupMode: "legacy" })).rejects.toMatchObject({ code: "migration-boundary" });
    await expect(post({ type: "item.move", itemId: "sheet", x: 50, y: 50 }, b, { originGroupMode: "future" as never })).rejects.toMatchObject({ code: "bad-op" });
    expect(await post({ type: "group.change", action: { kind: "migrate", expectedRevision: accepted.seq - 1 } }, a, { opId: "op_migrate", originGroupMode: "legacy" })).toEqual(accepted);
    expect(await engine.getSnapshot(canvasId)).toEqual(after);
    expect((await engine.groupMigrationPreview(canvasId)).status).toBe("already-groups");
  });

  it("preserves each actor's earlier Undo and Redo candidates including the converter's own redo", async () => {
    await add("sheet", { kind: "area" });
    await add("b", {}, b); await add("c", {}, c); await undo(c);
    await add("a"); await undo(a);
    const conversion = await migrate();
    const before = await engine.getSnapshot(canvasId);
    for (let attempt = 0; attempt < 2; attempt++) {
      await expect(undo(b)).rejects.toMatchObject({ code: "migration-boundary" });
      await expect(redo(c)).rejects.toMatchObject({ code: "migration-boundary" });
      await expect(redo(a)).rejects.toMatchObject({ code: "migration-boundary" });
    }
    expect(await engine.getSnapshot(canvasId)).toEqual(before);
    expect((await undo()).cause).toEqual({ kind: "undo", targetSeq: conversion.seq });
    expect((await engine.getSnapshot(canvasId)).project.groupMode).toBe("legacy");
    await redo(c);
    expect((await engine.getSnapshot(canvasId)).canvas.items.c).toBeDefined();
    await undo(c);
    // Changed pre-boundary trash is an exact dependency, so use a fresh case
    // for repeated migration redo below instead of silently rewriting it.
  });

  it("re-mints the active sequence on migration redo and uses its latest exact inverse", async () => {
    await add("sheet", { kind: "area" }); await add("card", {}, b);
    const conversion = await migrate();
    const expected = await engine.getSnapshot(canvasId);
    await undo();
    const replay = await redo();
    expect(replay.seq).toBe(conversion.seq + 2);
    expect((await engine.getSnapshot(canvasId)).project.groupMigration).toEqual({ version: 1, opId: replay.envelope.id, seq: replay.seq });
    await expect(undo(b)).rejects.toMatchObject({ code: "migration-boundary" });
    await undo();
    expect((await engine.getSnapshot(canvasId)).project.groupMode).toBe("legacy");
    await redo();
    const again = await engine.getSnapshot(canvasId);
    expect(again.canvas.items.card!.containerId).toBe(expected.canvas.items.card!.containerId);
  });

  it("keeps conversion separate from an identical ordinary Undo label", async () => {
    await add("sheet", { kind: "area" });
    const older = await post({ type: "item.update", itemId: "sheet", patch: { title: "Acme renamed" } }, a, { group: "same_gesture" });
    const preview = await engine.groupMigrationPreview(canvasId);
    const converted = await post({ type: "group.change", action: { kind: "migrate", expectedRevision: preview.revision } }, a, { group: "same_gesture" });
    expect((await undo()).cause).toEqual({ kind: "undo", targetSeq: converted.seq });
    const legacy = await engine.getSnapshot(canvasId);
    expect(legacy.project.groupMode).toBe("legacy");
    expect(legacy.canvas.items.sheet!.title).toBe("Acme renamed");
    await redo();
    expect((await undo()).cause).toEqual({ kind: "undo", targetSeq: converted.seq });
    expect((await undo()).cause).toEqual({ kind: "undo", targetSeq: older.seq });
    expect((await engine.getSnapshot(canvasId)).canvas.items.sheet!.title).toBe("Acme sheet");
  });

  it("refuses rollback with later live, trash, Undo or Redo dependencies without consuming them", async () => {
    await add("sheet", { kind: "area" }); await migrate();
    await post({ type: "group.change", action: { kind: "create", group: { id: "later", title: "Acme later", version: version("later") } } }, b);
    const live = await engine.getSnapshot(canvasId);
    await expect(undo()).rejects.toMatchObject({ code: "migration-boundary" });
    expect(await engine.getSnapshot(canvasId)).toEqual(live);
    await undo(b);
    const trashed = await engine.getSnapshot(canvasId);
    for (let attempt = 0; attempt < 2; attempt++) await expect(undo()).rejects.toMatchObject({ code: "migration-boundary" });
    expect(await engine.getSnapshot(canvasId)).toEqual(trashed);
    await post({ type: "trash.empty" }, c);
    const emptied = await engine.getSnapshot(canvasId);
    await expect(undo()).rejects.toMatchObject({ code: "migration-boundary" });
    expect(await engine.getSnapshot(canvasId)).toEqual(emptied);
  });

  it("permits unrelated primitive content and comments to survive rollback", async () => {
    await add("sheet", { kind: "area" }); await add("card"); await migrate();
    await post({ type: "item.update", itemId: "card", patch: { title: "Acme edited", properties: { custom: "preserved" } } }, b);
    await post({ type: "thread.create", threadId: "thr_later", anchorItemId: null, x: 0, y: 0, comment: { id: "cmt_later", body: "Acme later discussion" } }, c);
    await undo();
    const after = await engine.getSnapshot(canvasId);
    expect(after.project.groupMode).toBe("legacy");
    expect(after.canvas.items.card).toMatchObject({ title: "Acme edited", properties: { custom: "preserved" } });
    expect(after.canvas.threads.thr_later!.comments[0]!.body).toBe("Acme later discussion");
    await undo(b);
    expect((await engine.getSnapshot(canvasId)).canvas.items.card!.title).toBe("Acme card");
  });

  it("retains mode, trash policies and boundary through snapshot, restart and history replay", async () => {
    await add("sheet", { kind: "area" }); await add("trash", { kind: "area" });
    await post({ type: "item.delete", itemId: "trash" }); await migrate();
    const expected = await engine.getSnapshot(canvasId), entries = await engine.getLog(canvasId);
    await store.close(); store = new FileStore(home); await store.init(); engine = new Engine(store, desk);
    expect(await engine.getSnapshot(canvasId)).toEqual(expected);
    let replayed = null;
    for (const entry of entries) replayed = applyOperation(replayed, entry.envelope);
    expect(replayed).toEqual({ project: expected.project, canvas: expected.canvas });
    expect(expected.canvas.trash[0]!.legacyGroupRestore).toBe("frame-only");
    await undo();
    const undone = await engine.getSnapshot(canvasId);
    expect(undone.canvas.trash[0]!.item.properties.kind).toBe("area");
    expect(undone.canvas.trash[0]!.legacyGroupRestore).toBeUndefined();
    await store.close(); store = new FileStore(home); await store.init(); engine = new Engine(store, desk);
    expect(await engine.getSnapshot(canvasId)).toEqual(undone);
  });

  it("defaults public births at the writer, honors explicit legacy, and gates literal v1–v3 clients", async () => {
    const created = await post({ type: "project.create", canvasId: "prj_new", title: "Acme new" });
    expect(created.envelope.op).toMatchObject({ type: "project.create", groupMode: "groups" });
    for (const clientFeatures of ["", "canvas-groups-v1", "canvas-groups-v2", "canvas-groups-v3"]) {
      await expect(post({ type: "project.create", canvasId: `prj_old_${clientFeatures || "none"}`, title: "Acme old" }, a, { clientFeatures })).rejects.toMatchObject({ code: "canvas-groups-required" });
      expect(() => requireGroupClient(clientFeatures, (applyOperation(null, created.envelope))!.project)).toThrow(/Update/);
    }
    expect((await engine.getSnapshot(canvasId)).project.groupMode).toBe("legacy");
    const explicit = await post({ type: "project.create", canvasId: "prj_explicit", title: "Acme legacy", groupMode: "legacy" }, a, { clientFeatures: "canvas-groups-v3" });
    expect(explicit.envelope.op).toMatchObject({ groupMode: "legacy" });
  });

  it("rejects malformed migration boundaries and legacy trash snapshots before replacing durable state", async () => {
    await add("sheet", { kind: "area" }); await post({ type: "item.delete", itemId: "sheet" }); await migrate();
    const before = await engine.getSnapshot(canvasId), log = await engine.getLog(canvasId);
    for (const mutate of [
      (snapshot: typeof before) => { snapshot.project.groupMigration!.seq = 0; },
      (snapshot: typeof before) => { snapshot.project.groupMode = "legacy"; },
      (snapshot: typeof before) => { snapshot.canvas.trash[0]!.legacyGroupRestore = "subtree" as never; },
      (snapshot: typeof before) => { snapshot.canvas.trash[0]!.item.properties.kind = "area"; },
    ]) {
      const malformed = structuredClone(before); malformed.lastSeq += 5; mutate(malformed);
      await expect(engine.adoptRemoteSnapshot(canvasId, malformed)).rejects.toThrow();
      expect(await engine.getSnapshot(canvasId)).toEqual(before);
      expect(await engine.getLog(canvasId)).toEqual(log);
    }
  });

  it("keeps ordinary root creation undo repair after a collaborator moves it, without deleting structural dependents", async () => {
    await migrate();
    const added = await add("plain", {}, b);
    expect(added.envelope.op).toMatchObject({ type: "group.change", action: { kind: "apply", change: { intent: "insert" } } });
    await post({ type: "item.move", itemId: "plain", x: 900, y: 1000 }, c);
    await post({ type: "item.update", itemId: "plain", patch: { title: "Acme collaborator" } }, c);
    await undo(b);
    let snapshot = await engine.getSnapshot(canvasId);
    expect(snapshot.canvas.items.plain).toBeUndefined();
    expect(snapshot.canvas.trash[0]!.item).toMatchObject({ x: 900, y: 1000, title: "Acme collaborator" });
    await expect(undo()).rejects.toMatchObject({ code: "migration-boundary" }); // original canonical insert still owns saved redo
    await redo(b);
    await post({ type: "group.change", action: { kind: "create", group: { id: "frame", title: "Acme frame", version: version("frame") }, itemIds: ["plain"] } }, c);
    snapshot = await engine.getSnapshot(canvasId);
    for (let attempt = 0; attempt < 2; attempt++) await expect(undo(b)).rejects.toMatchObject({ code: "group-conflict" });
    expect(await engine.getSnapshot(canvasId)).toEqual(snapshot);
  });
});
