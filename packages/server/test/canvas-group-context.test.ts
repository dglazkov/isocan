import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { CANVAS_GROUPS_FEATURE, blobsNamedBy, contextManifest, groupCopyAction, groupCopySource, type ContextManifest, type Operation } from "@isocan/core";
import { Engine } from "../src/engine.ts";
import { FileStore } from "../src/file-store.ts";
import { FileDesk } from "../src/file-desk.ts";
import { mintBadge } from "../src/badges.ts";
import { availableContextPage, hydrateContextManifest } from "../src/canvas-group-context.ts";
import { groupOperation, requireGroupClient } from "../src/canvas-groups.ts";
import { reachableHashes } from "../src/gc.ts";

const actor = { id: "usr_test", name: "Test" };
const canvasId = "prj_context";
let home: string;
let store: FileStore;
let desk: FileDesk;
let engine: Engine;
let badgeId: string;
const source = Buffer.from("# Acme source\n");
const visual = Buffer.from("Acme distinct visual bytes\n");
const post = (op: Operation, opId?: string) => engine.submit({ canvasId: op.type === "project.create" ? null : canvasId, actor, badgeId, clientFeatures: CANVAS_GROUPS_FEATURE, op, ...(opId ? { opId } : {}) });
beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-group-context-"));
  store = new FileStore(home); await store.init();
  desk = new FileDesk(home); await desk.init();
  const badge = mintBadge("bearer"); badgeId = badge.record.badgeId; await desk.put(badge.record);
  engine = new Engine(store, desk);
  await engine.claim({ badgeId, op: { type: "actor.claim", sessionKey: "test:context", as: actor.id, name: actor.name } });
  await post({ type: "project.create", canvasId, title: "Acme context", groupMode: "groups" });
});
afterEach(async () => {
  await desk.close(); await store.close();
  await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});
async function seed(visualMetadata = true) {
  const body = await store.putBlob(canvasId, source, { mimeType: "text/markdown", filename: "source.md" });
  const face = await store.putBlob(canvasId, visual, { mimeType: "image/png", filename: "visual.png" });
  const brief = await store.putBlob(canvasId, Buffer.from("# Acme group\n"), { mimeType: "text/markdown", filename: "brief.md" });
  await post({ type: "item.add", itemId: "itm_a", title: "Acme card", width: 200, height: 200, placement: { x: 100, y: 200, chosen: true }, version: { id: "ver_a", blobHash: body.blobHash, mimeType: "text/markdown", filename: "source.md", size: source.length, visual: { blobHash: face.blobHash, mimeType: "image/png", ...(visualMetadata ? { filename: "visual.png", size: visual.length } : {}) } } });
  await post({ type: "group.change", action: { kind: "create", group: { id: "itm_group", title: "Acme group", version: { id: "ver_group", blobHash: brief.blobHash, mimeType: "text/markdown", filename: "brief.md", size: 13 } }, itemIds: ["itm_a"] } });
  return { body: body.blobHash, face: face.blobHash };
}
async function send(): Promise<ContextManifest> {
  const snapshot = await engine.getSnapshot(canvasId);
  await post({ type: "thread.create", threadId: "thr_request", anchorItemId: null, x: 0, y: 0, comment: { id: "cmt_request", body: "Review Acme", contextRequest: { rootIds: ["itm_a", "itm_group"], expectedRevision: snapshot.lastSeq } } }, "op_request");
  return (await engine.getSnapshot(canvasId)).canvas.threads.thr_request!.comments[0]!.context!;
}
async function bytes(backing: FileStore, hash: string): Promise<Buffer> {
  const stream = await backing.openBlob(canvasId, hash); if (!stream) throw new Error("missing blob");
  const chunks: Buffer[] = []; for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

describe("production writer and file-store context retention without a socket", () => {
  it("resolves preview membership at one revision and refuses stale or forged provenance before appending", async () => {
    await seed();
    const snapshot = await engine.getSnapshot(canvasId);
    const preview = contextManifest(snapshot, snapshot.lastSeq, { rootIds: ["itm_a", "itm_group"] });
    expect(await send()).toEqual(preview);
    const before = await engine.getSnapshot(canvasId);
    await expect(post({ type: "thread.reply", threadId: "thr_request", comment: { id: "cmt_stale", body: "stale", contextRequest: { rootIds: ["itm_group"], expectedRevision: snapshot.lastSeq } } })).rejects.toMatchObject({ code: "group-conflict" });
    await expect(post({ type: "thread.reply", threadId: "thr_request", comment: { id: "cmt_fake", body: "fake", context: preview } })).rejects.toThrow(/writer/);
    expect(await engine.getSnapshot(canvasId)).toEqual(before);
  });

  it("retains original source and visual bytes beyond GC, restart and full-history adoption", async () => {
    const hashes = await seed(); const saved = await send();
    const orphan = await store.putBlob(canvasId, Buffer.from("Acme orphan control"), { mimeType: "text/plain", filename: "orphan.txt" });
    await post({ type: "group.change", action: { kind: "delete", itemIds: ["itm_group"] } });
    await post({ type: "trash.empty" });
    const report = await engine.gc(canvasId, { keepOps: 0, graceMs: 0 });
    expect(report.sweptBlobs).toBe(1);
    expect(await store.blobMeta(canvasId, orphan.blobHash)).toBeNull();
    engine = new Engine(store, desk);
    const snapshot = await engine.getSnapshot(canvasId);
    expect(snapshot.canvas.items).toEqual({}); expect(snapshot.canvas.trash).toEqual([]);
    expect(snapshot.canvas.threads.thr_request!.comments[0]!.context).toEqual(saved);
    expect(reachableHashes(snapshot, [])).toEqual(new Set(saved.entries.flatMap((entry) => entry.version ? [entry.version.blobHash, ...(entry.version.visual ? [entry.version.visual.blobHash] : [])] : [])));
    expect(await bytes(store, hashes.body)).toEqual(source); expect(await bytes(store, hashes.face)).toEqual(visual);
    const entries = [...await engine.getArchivedLog(canvasId), ...await engine.getLog(canvasId)];
    const second = new FileStore(path.join(home, "second")); await second.init();
    const restored = new Engine(second, desk); await restored.adopt(canvasId, entries);
    for (const [hash, meta] of blobsNamedBy(entries, snapshot)) {
      if (await store.blobMeta(canvasId, hash)) await second.putBlob(canvasId, await bytes(store, hash), meta);
    }
    expect((await restored.getSnapshot(canvasId)).canvas.threads.thr_request!.comments[0]!.context).toEqual(saved);
    expect(await bytes(second, hashes.body)).toEqual(source); expect(await bytes(second, hashes.face)).toEqual(visual);
  });

  it("refuses invalid retained context snapshots before replacing state, sequence or the held log", async () => {
    await seed(); await send();
    const before = await engine.getSnapshot(canvasId);
    const beforeLog = await engine.getLog(canvasId);
    const beforeArchive = await engine.getArchivedLog(canvasId);
    for (const invalid of [null, { ...before.canvas.threads.thr_request!.comments[0]!.context!, canvasId: "prj_foreign" }, { ...before.canvas.threads.thr_request!.comments[0]!.context!, counts: { included: 999, excluded: 0, unavailable: 0 } }]) {
      const remote = structuredClone(before);
      remote.lastSeq += 5;
      remote.canvas.threads.thr_request!.comments[0]!.context = invalid as ContextManifest;
      await expect(engine.adoptRemoteSnapshot(canvasId, remote)).rejects.toMatchObject({ code: "bad-op" });
      expect(await engine.getSnapshot(canvasId)).toEqual(before);
      expect(await engine.getLog(canvasId)).toEqual(beforeLog);
      expect(await engine.getArchivedLog(canvasId)).toEqual(beforeArchive);
      expect(await new Engine(store, desk).getSnapshot(canvasId)).toEqual(before);
    }
    // Retention is independent of the live items: a valid remote snapshot
    // with all originals gone must still remain adoptable and readable.
    const valid = structuredClone(before);
    valid.lastSeq += 5;
    valid.canvas.items = {};
    await engine.adoptRemoteSnapshot(canvasId, valid);
    expect((await engine.getSnapshot(canvasId)).canvas.threads).toEqual(valid.canvas.threads);
  });

  it("freezes omitted metadata from the distinct visual blob identically in preview and send, preserving explicit fields", async () => {
    const hashes = await seed(false);
    const original = (await engine.getSnapshot(canvasId)).canvas.items.itm_a!.versions[0]!;
    await post({ type: "item.addVersion", itemId: "itm_a", version: { ...original, id: "ver_omitted", visual: { blobHash: hashes.face, mimeType: "image/png" } } });
    const snapshot = await engine.getSnapshot(canvasId);
    const preview = await hydrateContextManifest(store, snapshot, contextManifest(snapshot, snapshot.lastSeq, { rootIds: ["itm_a", "itm_group"] }));
    const saved = await send();
    expect(saved).toEqual(preview);
    expect(saved.entries.find((entry) => entry.itemId === "itm_a")!.version).toMatchObject({ filename: "source.md", size: source.length, visual: { blobHash: hashes.face, filename: "visual.png", size: visual.length } });
    const written = await engine.getSnapshot(canvasId);
    expect(blobsNamedBy([], { project: written.project, canvas: { ...written.canvas, items: {}, trash: [] } }).get(hashes.face)).toMatchObject({ filename: "visual.png", size: visual.length });
    expect(blobsNamedBy(await engine.getLog(canvasId), written).get(hashes.face)).toMatchObject({ filename: "visual.png", size: visual.length });
    for (const [index, fields] of [{ filename: "selected-name.png" }, { size: 7 }, { filename: "selected-name.png", size: 7 }].entries()) {
      await post({ type: "item.addVersion", itemId: "itm_a", version: { ...original, id: `ver_explicit_${index}`, visual: { blobHash: hashes.face, mimeType: "image/png", ...fields } } });
      await post({ type: "thread.reply", threadId: "thr_request", comment: { id: `cmt_explicit_${index}`, body: "Use explicit metadata", contextRequest: { rootIds: ["itm_a"] } } });
      const explicit = (await engine.getSnapshot(canvasId)).canvas.threads.thr_request!.comments.at(-1)!.context!;
      expect(explicit.entries[0]!.version!.visual).toMatchObject({ filename: "visual.png", size: visual.length, ...fields });
    }
    expect((await engine.getSnapshot(canvasId)).canvas.threads.thr_request!.comments[0]!.context).toEqual(saved);
    expect(blobsNamedBy(await engine.getLog(canvasId), await engine.getSnapshot(canvasId)).get(hashes.face)).toMatchObject({ filename: "visual.png", size: visual.length });
  });

  it("refuses fresh context with missing distinct-visual metadata instead of freezing source fallback", async () => {
    await seed();
    const original = (await engine.getSnapshot(canvasId)).canvas.items.itm_a!.versions[0]!;
    await post({ type: "item.addVersion", itemId: "itm_a", version: { ...original, id: "ver_missing", visual: { blobHash: "missing_visual", mimeType: "image/png" } } });
    const before = await engine.getSnapshot(canvasId);
    const request = { rootIds: ["itm_a"], expectedRevision: before.lastSeq };
    await expect(hydrateContextManifest(store, before, contextManifest(before, before.lastSeq, request))).rejects.toThrow(/visual context metadata is unavailable.*upload/);
    await expect(post({ type: "thread.create", threadId: "thr_missing", x: 0, y: 0, anchorItemId: null, comment: { id: "cmt_missing", body: "Missing visual", contextRequest: request } })).rejects.toThrow(/visual context metadata is unavailable.*upload/);
    expect(await engine.getSnapshot(canvasId)).toEqual(before);
  });

  it("reports missing retained bytes and never returns an excluded content URL", async () => {
    await seed(); const saved = await send();
    const item = saved.entries.find((entry) => entry.itemId === "itm_a")!;
    item.excluded = true;
    const excluded = await availableContextPage(store, saved, { face: "source" });
    expect(excluded.entries.find((entry) => entry.itemId === "itm_a")!.url).toBeUndefined();
    item.excluded = false; item.version!.blobHash = "missing_hash";
    const missing = await availableContextPage(store, saved, {});
    expect(missing.entries.find((entry) => entry.itemId === "itm_a")).toMatchObject({ status: "unavailable", reason: "retained blob bytes are unavailable at this home" });
    expect(missing.counts.unavailable).toBe(1);
  });

  it("refuses an entire copy if one required visual blob was not prepared", async () => {
    await seed(); const snapshot = await engine.getSnapshot(canvasId);
    let id = 0;
    const action = groupCopyAction(groupCopySource(canvasId, snapshot.canvas, ["itm_group"]), canvasId, { newItemId: () => `itm_copy_${++id}`, newVersionId: () => `ver_copy_${++id}` });
    action.items.find((item) => item.title === "Acme card")!.version.visual!.blobHash = "missing_visual";
    await expect(post({ type: "group.change", action })).rejects.toThrow(/prepare every source and visual/);
    expect(await engine.getSnapshot(canvasId)).toEqual(snapshot);
  });

  it("gates literal v2 readers on frozen comment records, including restored comments and inverses", async () => {
    await seed(); const context = await send();
    const op: Operation = { type: "thread.reply", threadId: "thr_request", comment: { id: "cmt_ref", body: "Acme", context } };
    expect(groupOperation(op)).toBe(true);
    expect(() => requireGroupClient("canvas-groups-v2", undefined, [{ seq: 1, envelope: { id: "op_ref", canvasId, actor, ts: "2026-09-13", op }, inverse: null }])).toThrow(/Update isocan/);
    const snapshot = await engine.getSnapshot(canvasId);
    expect(() => requireGroupClient(CANVAS_GROUPS_FEATURE, snapshot.project)).not.toThrow();
  });
});
