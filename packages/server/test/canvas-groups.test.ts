import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { WebSocket } from "ws";
import {
  CANVAS_GROUPS_FEATURE, CANVAS_GROUPS_REQUIRED, CLIENT_FEATURES_HEADER, CLIENT_FEATURES_PARAM,
  WS_STALE_CLIENT, captureGroupExpectations, type Actor, type CanvasSnapshotResponse,
  EXPORT_LAYOUT, type GroupAction, type LogEntry, type Operation, type ServerMessage,
} from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";
import { UndoStacks } from "../src/undo.ts";
import { reachableHashes } from "../src/gc.ts";
import { DaemonRoutes } from "../../api/src/routes.ts";
import { exportCanvases, importExport } from "../../api/src/export.ts";

const alice = { id: "usr_alice", name: "Alice" };
const bob = { id: "usr_bob", name: "Bob" };
const canvasId = "prj_group_test";
const feature = { [CLIENT_FEATURES_HEADER]: CANVAS_GROUPS_FEATURE };
const version = (id: string) => ({ id, blobHash: `hash_${id}`, mimeType: "text/markdown", filename: `${id}.md`, size: 4 });
let daemon: Daemon;
let base: string;
let home: string;
let badge: TestBadge;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-canvas-groups-"));
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  badge = await mintTestBadge(base);
  await badge.speakAs(alice);
  await badge.speakAs(bob);
});
afterEach(async () => {
  await daemon?.close();
  await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

async function request(url: string, body?: unknown, capable: boolean | string = true) {
  const response = await fetch(`${base}${url}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { ...badge.headers, ...(typeof capable === "string" ? { [CLIENT_FEATURES_HEADER]: capable } : capable ? feature : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json() as any };
}
function post(op: Operation, actor: Actor = alice, extra: Record<string, unknown> = {}) {
  return request("/api/ops", { canvasId: op.type === "project.create" ? null : canvasId, actor, op, ...extra });
}
async function accepted(op: Operation, actor: Actor = alice, extra: Record<string, unknown> = {}) {
  const result = await post(op, actor, extra);
  expect(result.status, JSON.stringify(result.body)).toBe(200);
  return result.body as { seq: number; envelope: LogEntry["envelope"] };
}
const action = (value: GroupAction): Operation => ({ type: "group.change", action: value });
const snapshot = () => daemon.engine.getSnapshot(canvasId);
const log = () => daemon.engine.getLog(canvasId);
const history = (kind: "undo" | "redo", actor = alice) => request(`/api/projects/${canvasId}/${kind}`, { actor });
async function restart() {
  await daemon.close();
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
}
async function seed() {
  await accepted({ type: "project.create", canvasId, title: "Acme groups", groupMode: "groups" });
  for (const [id, x] of [["itm_a", 100], ["itm_b", 500]] as const) {
    await accepted({ type: "item.add", itemId: id, title: id, version: version(`ver_${id}`), width: 200, height: 160, placement: { x, y: 200, chosen: true } });
  }
}
async function wrap(extra: Record<string, unknown> = {}) {
  return accepted(action({ kind: "create", group: { id: "itm_group", title: "Acme", version: version("ver_group") }, itemIds: ["itm_a", "itm_b"] }), alice, extra);
}
async function move(ids: string[], x: number, actor: Actor = alice, extra: Record<string, unknown> = {}) {
  const expected = captureGroupExpectations(await snapshot(), ids);
  return accepted(action({ kind: "transform", itemIds: ids, by: { x, y: 0 }, expected }), actor, extra);
}

describe("canvas groups through the authoritative HTTP writer", () => {
  it("wraps in one entry and inverse, returns the same receipt on retry, and refuses canonical patch injection", async () => {
    await seed();
    const before = await snapshot();
    const made = await wrap({ opId: "op_groupcreate1" });
    expect(made.envelope.op.type).toBe("group.change");
    expect((made.envelope.op as Extract<Operation, { type: "group.change" }>).action.kind).toBe("apply");
    const retried = await wrap({ opId: "op_groupcreate1" });
    expect(retried).toEqual(made);
    const after = await snapshot();
    expect(after.lastSeq).toBe(before.lastSeq + 1);
    expect(after.canvas.items.itm_a!.containerId).toBe("itm_group");
    expect(after.canvas.items.itm_a!.x).toBe(before.canvas.items.itm_a!.x);
    expect((await log()).at(-1)!.inverse?.type).toBe("group.change");
    const smuggled = await post(made.envelope.op, alice, { opId: "op_groupcreate1" });
    expect(smuggled.status).toBe(400);
    expect(smuggled.body.code).toBe("internal-op");
    expect((await snapshot()).lastSeq).toBe(after.lastSeq);
  });

  it("refuses an invalid member or cycle with no partial state or log change", async () => {
    await seed(); await wrap();
    const before = await snapshot();
    for (const ids of [["itm_a", "itm_missing"], ["itm_group"]]) {
      const refused = await post(action({ kind: "reparent", itemIds: ids, containerId: "itm_group" }));
      expect(refused.status).toBeGreaterThanOrEqual(400);
      expect(await snapshot()).toEqual(before);
    }
    for (const op of [
      { type: "item.move", itemId: "itm_missing", x: 0, y: 0 },
      { type: "item.resize", itemId: "itm_missing", width: 200, height: 200 },
    ] satisfies Operation[]) {
      const refused = await post(op);
      expect(refused.status).toBe(400);
      expect(refused.body.code).toBe("unknown-item");
      expect(await snapshot()).toEqual(before);
    }
  });

  it("accepts unrelated wording but refuses stale subtree membership and absent transform expectations", async () => {
    await seed(); await wrap();
    const expected = captureGroupExpectations(await snapshot(), ["itm_group"]);
    await accepted({ type: "item.update", itemId: "itm_a", patch: { title: "Acme revised" } }, bob);
    await accepted(action({ kind: "transform", itemIds: ["itm_group"], by: { x: 50, y: 0 }, expected }));
    const stale = captureGroupExpectations(await snapshot(), ["itm_group"]);
    await accepted(action({ kind: "reparent", itemIds: ["itm_b"], containerId: null }), bob);
    const before = await snapshot();
    const refused = await post(action({ kind: "transform", itemIds: ["itm_group"], by: { x: 50, y: 0 }, expected: stale }));
    expect(refused.status).toBe(409);
    expect(refused.body.code).toBe("group-conflict");
    expect(await snapshot()).toEqual(before);
    const unguarded = await request("/api/ops", { canvasId, actor: alice, op: { type: "group.change", action: { kind: "transform", itemIds: ["itm_group"], by: { x: 50, y: 0 } } } });
    expect(unguarded.status).toBeGreaterThanOrEqual(400);
    expect(await snapshot()).toEqual(before);
  });

  it("keeps the same conflicting undo candidate and never undoes an older action", async () => {
    await seed(); await wrap();
    const target = await move(["itm_group"], 80);
    await move(["itm_a"], 40, bob);
    const before = await snapshot();
    for (let attempt = 0; attempt < 2; attempt++) {
      expect((await history("undo")).status).toBe(409);
      expect(await snapshot()).toEqual(before);
    }
    expect(UndoStacks.rebuild(await log()).nextUndoTarget(alice.id)).toBe(target.seq);
    expect((await history("undo", bob)).status).toBe(200);
    const undone = await history("undo");
    expect(undone.status).toBe(200);
    expect(undone.body.cause).toEqual({ kind: "undo", targetSeq: target.seq });
  });

  it("preflights mixed undo labels before reverting their ordinary members", async () => {
    await seed(); await wrap();
    await move(["itm_group"], 80, alice, { group: "gesture_with_group" });
    await accepted({ type: "item.update", itemId: "itm_a", patch: { title: "Keep this title" } }, alice, { group: "gesture_with_group" });
    await move(["itm_b"], 20, bob);
    const before = await snapshot();
    expect((await history("undo")).status).toBe(409);
    expect(await snapshot()).toEqual(before);
  });

  it("restores creation IDs, versions and authorship on redo and retains a conflicting redo", async () => {
    await seed(); await wrap();
    const original = (await snapshot()).canvas.items.itm_group!;
    expect((await history("undo")).status).toBe(200);
    expect((await history("redo")).status).toBe(200);
    const restored = (await snapshot()).canvas.items.itm_group!;
    expect(restored.id).toBe(original.id);
    expect(restored.versions).toEqual(original.versions);
    expect(restored.createdBy).toEqual(original.createdBy);
    expect(restored.createdAt).toBe(original.createdAt);
    const target = await move(["itm_group"], 90);
    expect((await history("undo")).status).toBe(200);
    await move(["itm_a"], 20, bob);
    const before = await snapshot();
    expect((await history("redo")).status).toBe(409);
    expect((await history("redo")).status).toBe(409);
    expect(await snapshot()).toEqual(before);
    expect((await history("undo", bob)).status).toBe(200);
    const redone = await history("redo");
    expect(redone.status).toBe(200);
    expect(redone.body.cause).toEqual({ kind: "redo", targetSeq: target.seq });
  });

  it("refuses a relative retry after GC forgets its idempotency key", async () => {
    await seed(); await wrap();
    const intent = action({ kind: "transform", itemIds: ["itm_group"], by: { x: 55, y: 0 }, expected: captureGroupExpectations(await snapshot(), ["itm_group"]) });
    await accepted(intent, alice, { opId: "op_relative_gc" });
    await daemon.engine.gc(canvasId, { keepOps: 0 });
    expect(await log()).toHaveLength(0);
    const before = await snapshot();
    expect((await post(intent, alice, { opId: "op_relative_gc" })).status).toBe(409);
    expect(await snapshot()).toEqual(before);
  });

  it("normalizes ordinary absolute move/resize requests once and replays the same resolved geometry", async () => {
    await seed(); await wrap();
    const before = await snapshot();
    const group = before.canvas.items.itm_group!;
    const moved = await accepted({ type: "item.move", itemId: group.id, x: group.x + 30, y: group.y + 40 });
    expect(moved.envelope.op.type).toBe("group.change");
    expect((await snapshot()).canvas.items.itm_a!.x).toBe(before.canvas.items.itm_a!.x + 30);
    const resized = await accepted({ type: "item.resize", itemId: group.id, width: group.width * 2, height: group.height * 2 });
    expect(resized.envelope.op.type).toBe("group.change");
    expect((await snapshot()).canvas.items.itm_a!.width).toBeGreaterThan(before.canvas.items.itm_a!.width);
    const entries = await log();
    const secondHome = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-group-adopt-"));
    const second = await startDaemon({ port: 0, home: secondHome });
    try {
      await second.engine.adopt(canvasId, entries);
      expect((await second.engine.getSnapshot(canvasId)).canvas).toEqual((await snapshot()).canvas);
    } finally {
      await second.close();
      await fs.rm(secondHome, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
    const saved = await snapshot();
    await daemon.close();
    daemon = await startDaemon({ port: 0, home });
    expect((await snapshot()).canvas).toEqual(saved.canvas);
  });

  it("normalizes raw batches as distinct root moves and grows frames for an ordinary member move", async () => {
    await seed(); await wrap();
    await accepted({ type: "item.add", itemId: "itm_c", version: version("ver_c"), width: 200, height: 160, placement: { x: 1200, y: 200, chosen: true } });
    await accepted(action({ kind: "create", group: { id: "itm_other", title: "Acme other", version: version("ver_other") }, itemIds: ["itm_c"] }));
    const before = await snapshot();
    const group = before.canvas.items.itm_group!;
    const other = before.canvas.items.itm_other!;
    const a = before.canvas.items.itm_a!;
    const c = before.canvas.items.itm_c!;
    const moved = await accepted({ type: "items.move", moves: [
      { itemId: group.id, x: group.x + 100, y: group.y },
      { itemId: a.id, x: a.x + 100, y: a.y },
      { itemId: other.id, x: other.x + 250, y: other.y + 40 },
    ] });
    expect(moved.envelope.op.type).toBe("group.change");
    let after = await snapshot();
    expect(after.canvas.items.itm_a!.x).toBe(a.x + 100);
    expect(after.canvas.items.itm_c!.x).toBe(c.x + 250);
    expect(after.canvas.items.itm_c!.y).toBe(c.y + 40);
    const childMove = await accepted({ type: "item.move", itemId: a.id, x: 3000, y: 2000 });
    expect(childMove.envelope.op.type).toBe("group.change");
    after = await snapshot();
    expect(after.canvas.items.itm_a!.containerId).toBe(group.id);
    expect(after.canvas.items.itm_group!.x + after.canvas.items.itm_group!.width).toBeGreaterThanOrEqual(3200);
    expect(after.canvas.items.itm_group!.y + after.canvas.items.itm_group!.height).toBeGreaterThan(2160);
    expect(after.canvas.items.itm_c!.x).toBe(c.x + 250);
  });

  it("retains source and visual bytes named only by canonical group records", async () => {
    await seed(); await wrap();
    const state = await snapshot();
    const record = structuredClone((await log()).at(-1)!);
    if (record.envelope.op.type !== "group.change" || record.envelope.op.action.kind !== "apply") throw new Error("not canonical");
    const creation = record.envelope.op.action.change.writes.find((write) => write.kind === "create");
    if (!creation || creation.kind !== "create") throw new Error("missing creation");
    creation.item.versions[0]!.visual = { blobHash: "hash_visual", mimeType: "image/png", filename: "Acme.png", size: 3 };
    const marked = reachableHashes({ ...state, canvas: { ...state.canvas, items: {}, trash: [] } }, [record]);
    expect(marked.has("hash_ver_group")).toBe(true);
    expect(marked.has("hash_visual")).toBe(true);
  });

  it("persists deletion cohorts through restart and native export/import, keeping independently restored members out", async () => {
    await seed(); await wrap();
    await accepted(action({ kind: "delete", itemIds: ["itm_group"] }));
    await accepted(action({ kind: "restore", itemIds: ["itm_a"] }), bob);
    await accepted({ type: "item.move", itemId: "itm_a", x: 2000, y: 2000 }, bob);
    const saved = await snapshot();
    expect(Object.keys(saved.canvas.groupCohorts ?? {})).toHaveLength(1);
    await restart();
    expect((await snapshot()).canvas).toEqual(saved.canvas);

    const out = path.join(home, "native-backup");
    const client = new DaemonRoutes(base, path.join(home, "api-client"));
    await exportCanvases(client, [saved.project], { out });
    const exported = JSON.parse(await fs.readFile(path.join(out, EXPORT_LAYOUT.canvases, canvasId, EXPORT_LAYOUT.snapshot), "utf8"));
    expect(exported.groupCohorts).toEqual(saved.canvas.groupCohorts);
    const secondHome = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-group-native-"));
    const second = await startDaemon({ port: 0, home: secondHome });
    try {
      const addr = second.app.server.address();
      const secondBase = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
      const imported = await importExport(new DaemonRoutes(secondBase, path.join(secondHome, "client")), out);
      expect(imported.refused).toEqual([]);
      expect(imported.restored).toHaveLength(1);
      expect((await second.engine.getSnapshot(canvasId)).canvas).toEqual(saved.canvas);
    } finally {
      await second.close();
      await fs.rm(secondHome, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }

    const restored = await accepted(action({ kind: "restore", itemIds: ["itm_group"] }));
    if (restored.envelope.op.type !== "group.change" || restored.envelope.op.action.kind !== "apply") throw new Error("not canonical");
    expect(restored.envelope.op.action.change.skippedIds).toContain("itm_a");
    const final = await snapshot();
    expect(final.canvas.items.itm_b!.containerId).toBe("itm_group");
    expect(final.canvas.items.itm_a!.containerId).toBeUndefined();
    expect(final.canvas.items.itm_a!.x).toBe(2000);
  });

  it("refuses malformed group snapshots before replacing state or archiving the held log", async () => {
    await seed(); await wrap();
    const before = await snapshot();
    const beforeLog = await log();
    for (const parent of ["itm_group", "itm_foreign"]) {
      const malformed: CanvasSnapshotResponse = structuredClone(before);
      malformed.lastSeq += 5;
      malformed.canvas.items.itm_group!.containerId = parent;
      await expect(daemon.engine.adoptRemoteSnapshot(canvasId, malformed)).rejects.toThrow();
      expect(await snapshot()).toEqual(before);
      expect(await log()).toEqual(beforeLog);
    }
    await restart();
    expect((await snapshot()).canvas).toEqual(before.canvas);
  });
});

describe("canvas-group reducer capability", () => {
  it.each(["", "canvas-groups-v1"])("gates writes, snapshots, logs, watch, and both socket snapshot and tail for %s", async (oldFeatures) => {
    const refusedBirth = await request("/api/ops", { canvasId: null, actor: alice, op: { type: "project.create", canvasId, title: "Acme", groupMode: "groups" } }, oldFeatures);
    expect(refusedBirth.status).toBe(426);
    await seed(); await wrap();
    for (const url of [`/api/projects/${canvasId}/canvas`, `/api/projects/${canvasId}/oplog`, `/api/projects/${canvasId}/oplog/archive`]) {
      const refused = await request(url, undefined, oldFeatures);
      expect(refused.status).toBe(426);
      expect(refused.body.code).toBe(CANVAS_GROUPS_REQUIRED);
    }
    expect((await request("/api/ops", { canvasId, actor: alice, op: { type: "item.move", itemId: "itm_a", x: 0, y: 0 } }, oldFeatures)).status).toBe(426);
    expect((await request("/api/oplog/watch", { cursors: {}, only: [canvasId] }, oldFeatures)).status).toBe(426);
    const all = await request("/api/oplog/watch", { cursors: {}, waitMs: 1 }, oldFeatures);
    expect(all.status).toBe(200);
    expect(all.body.entries).toEqual([]);
    for (const since of [0, 1]) {
      const messages: unknown[] = [];
      const ws = new WebSocket(`${base.replace("http:", "ws:")}/ws?canvasId=${canvasId}&since=${since}&${CLIENT_FEATURES_PARAM}=${oldFeatures}`, { headers: badge.headers });
      ws.on("message", (data) => messages.push(JSON.parse(String(data))));
      const code = await new Promise<number>((resolve, reject) => { ws.on("close", resolve); ws.on("error", reject); });
      expect(code).toBe(WS_STALE_CLIENT);
      expect(messages).toEqual([]);
    }
    const ws = new WebSocket(`${base.replace("http:", "ws:")}/ws?canvasId=${canvasId}&since=1&${CLIENT_FEATURES_PARAM}=${CANVAS_GROUPS_FEATURE}`, { headers: badge.headers });
    const messages = await new Promise<ServerMessage[]>((resolve, reject) => {
      const received: ServerMessage[] = [];
      ws.on("message", (data) => {
        const message = JSON.parse(String(data)) as ServerMessage;
        received.push(message);
        const first = received[0];
        if (first?.type === "resumed" && message.type === "op-applied" && message.entry.seq === first.lastSeq) resolve(received);
      });
      ws.on("error", reject);
    });
    expect(messages[0]!.type).toBe("resumed");
    expect(messages.some((message) => message.type === "op-applied" && message.entry.envelope.op.type === "group.change")).toBe(true);
    ws.close();
  });

  it.each(["", "canvas-groups-v1"])("does not let a capable forwarding transport bless incompatible original writer %s", async (oldFeatures) => {
    await seed(); await wrap();
    const before = await snapshot();
    const denied = await post({ type: "item.move", itemId: "itm_a", x: 0, y: 0 }, alice, { clientFeatures: oldFeatures });
    expect(denied.status).toBe(426);
    expect(await snapshot()).toEqual(before);
    const legacy = await request("/api/ops", { canvasId: null, actor: alice, op: { type: "project.create", canvasId: "prj_legacy", title: "Acme legacy" } }, false);
    expect(legacy.status).toBe(200);
    expect((await request("/api/projects/prj_legacy/canvas", undefined, false)).status).toBe(200);
  });

  it("refuses malformed group modes and generic group-field writes on legacy canvases", async () => {
    for (const groupMode of ["groupz", {}, 1, null]) {
      const denied = await request("/api/ops", { canvasId: null, actor: alice, op: { type: "project.create", canvasId, title: "Acme", groupMode } });
      expect(denied.status).toBe(400);
    }
    await accepted({ type: "project.create", canvasId, title: "Acme legacy" });
    const add = { type: "item.add", itemId: "itm_a", version: version("ver_a"), width: 300, height: 300, placement: { x: 0, y: 0 } } as const;
    expect((await post({ ...add, properties: { kind: "group" } })).status).toBe(400);
    await accepted(add);
    const before = await snapshot();
    for (const patch of [{ properties: { kind: "group" } }, { containerId: "itm_group" }, { groupLayout: {} }]) {
      const denied = await request("/api/ops", { canvasId, actor: alice, op: { type: "item.update", itemId: "itm_a", patch } });
      expect(denied.status).toBe(400);
      expect(await snapshot()).toEqual(before);
    }
  });
});

describe("v2 insertion and brief effects", () => {
  it("infers actual brief emptiness for both raw and nested content requests, with one exact inverse", async () => {
    await seed(); await wrap();
    const original = await snapshot();
    const filled = await daemon.engine.putBlob(canvasId, Buffer.from("  # Acme brief\n"), { mimeType: "text/markdown", filename: "brief.md" });
    const empty = await daemon.engine.putBlob(canvasId, Buffer.from(" \n\t"), { mimeType: "text/markdown", filename: "empty.md" });
    const added = await accepted({ type: "item.addVersion", itemId: "itm_group", version: { id: "ver_filled", ...filled, filename: "brief.md" } });
    expect(added.envelope.op).toMatchObject({ type: "group.change", action: { kind: "apply", change: { schemaVersion: 2, intent: "content" } } });
    const shown = await snapshot();
    expect(shown.lastSeq).toBe(original.lastSeq + 1);
    expect(shown.canvas.items.itm_group?.groupLayout?.briefHeight).toBe(120);
    expect(shown.canvas.items.itm_a).toEqual(original.canvas.items.itm_a);
    const cleared = await accepted(action({ kind: "content", operation: { type: "item.addVersion", itemId: "itm_group", version: { id: "ver_empty", ...empty, filename: "empty.md" } } }));
    expect(cleared.seq).toBe(shown.lastSeq + 1);
    expect((await snapshot()).canvas.items.itm_group?.groupLayout?.briefHeight).toBe(0);
    expect((await history("undo")).status).toBe(200);
    expect((await snapshot()).canvas.items.itm_group).toMatchObject({ currentVersionId: "ver_filled", groupLayout: { briefHeight: 120 } });
  });

  it("retains source and inherited visual metadata from v2 content and its inverse", async () => {
    await seed(); await wrap();
    const visual = { blobHash: "hash_content_visual", mimeType: "image/png" };
    await accepted({ type: "item.addVersion", itemId: "itm_group", version: { ...version("ver_content"), visual }, briefHeight: 120 });
    const state = await snapshot();
    const record = (await log()).at(-1)!;
    const marked = reachableHashes({ ...state, canvas: { ...state.canvas, items: {}, trash: [] } }, [record]);
    expect(marked.has("hash_ver_content")).toBe(true);
    expect(marked.has("hash_content_visual")).toBe(true);
    expect(marked.has("hash_ver_group")).toBe(true);
  });

  it("closes an already subscribed v1 client before the first v2 operation reaches it", async () => {
    await accepted({ type: "project.create", canvasId, title: "Acme legacy" });
    const messages: ServerMessage[] = [];
    const ws = new WebSocket(`${base.replace("http:", "ws:")}/ws?canvasId=${canvasId}&since=0&${CLIENT_FEATURES_PARAM}=canvas-groups-v1`, { headers: badge.headers });
    await new Promise<void>((resolve, reject) => {
      ws.on("message", (data) => { const message = JSON.parse(String(data)) as ServerMessage; messages.push(message); if (message.type === "snapshot") resolve(); });
      ws.on("error", reject);
    });
    const remote = await snapshot();
    remote.project.groupMode = "groups";
    remote.lastSeq++;
    await daemon.engine.adoptRemoteSnapshot(canvasId, remote);
    const closed = new Promise<number>((resolve, reject) => { ws.on("close", resolve); ws.on("error", reject); });
    await accepted(action({ kind: "create", group: { id: "itm_group", title: "Acme group", version: version("ver_group") } }));
    expect(await closed).toBe(WS_STALE_CLIENT);
    expect(messages.filter((message) => message.type === "op-applied")).toEqual([]);
  });
});
