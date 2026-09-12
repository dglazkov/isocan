import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { applyOperation, guardItem, type CanvasState, type LogEntry } from "@isocan/core";
import { reachableHashes } from "../src/gc.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/** One reviewed graph change must publish and undo as a single native entry. */

const alice = { id: "usr_alice", name: "Alice" };
const bob = { id: "usr_bob", name: "Bob" };
const CANVAS = "prj_group";

let home: string;
let daemon: Daemon;
let base: string;
let badge: TestBadge;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-atomic-"));
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  badge = await mintTestBadge(base);
  await badge.speakAs(alice);
  await badge.speakAs(bob);
  await op({ type: "project.create", canvasId: CANVAS, title: "Grouping" }, alice, null);
});

afterEach(async () => {
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

async function op(
  operation: unknown,
  actor = alice,
  canvasId: string | null = CANVAS,
  group?: string,
): Promise<void> {
  const res = await fetch(`${base}/api/ops`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...badge.headers },
    body: JSON.stringify({ canvasId, actor, op: operation, ...(group ? { group } : {}) }),
  });
  expect(res.status, await res.clone().text()).toBe(200);
}

const nv = (id: string) => ({
  id,
  blobHash: `hash_${id}`,
  mimeType: "text/plain",
  filename: `${id}.txt`,
  size: 1,
});

async function addItem(id: string, actor = alice, group?: string): Promise<void> {
  await op(
    { type: "item.add", itemId: id, version: nv(`ver_${id}`), width: 10, height: 10, placement: { x: 0, y: 0 } },
    actor,
    CANVAS,
    group,
  );
}

async function undo(actor = alice): Promise<Response> {
  return fetch(`${base}/api/projects/${CANVAS}/undo`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...badge.headers },
    body: JSON.stringify({ actor }),
  });
}

async function redo(actor = alice): Promise<Response> {
  return fetch(`${base}/api/projects/${CANVAS}/redo`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...badge.headers },
    body: JSON.stringify({ actor }),
  });
}

const items = async (): Promise<string[]> => {
  const res = await fetch(`${base}/api/projects/${CANVAS}/canvas`, { headers: badge.headers });
  const { canvas } = (await res.json()) as { canvas: { items: Record<string, unknown> } };
  return Object.keys(canvas.items).sort();
};

const snapshot = async () => (await (await fetch(`${base}/api/projects/${CANVAS}/canvas`, { headers: badge.headers })).json()) as { canvas: CanvasState["canvas"]; project: CanvasState["project"]; seq: number };
const submit = (operation: unknown) => fetch(`${base}/api/ops`, {
  method: "POST", headers: { "Content-Type": "application/json", ...badge.headers },
  body: JSON.stringify({ canvasId: CANVAS, actor: alice, op: operation }),
});

describe("atomic item changes through the daemon", () => {
  it("persists one entry, normalizes sequential placements, replays, and undoes/redoes with original authorship", async () => {
    const changes = ["itm_a", "itm_b"].map(itemId => ({ type: "item.add", itemId, version: nv(`ver_${itemId}`), width: 300, height: 200, placement: { x: 0, y: 0 } }));
    const events: LogEntry[] = [];
    const unsubscribe = daemon.engine.onEvent((canvasId, message) => {
      if (canvasId === CANVAS && message.type === "op-applied") events.push(message.entry);
    });
    const response = await submit({ type: "items.change", changes });
    unsubscribe();
    expect(events).toHaveLength(1);
    expect(response.status, await response.clone().text()).toBe(200);
    const entry = await response.json() as LogEntry;
    expect(entry.envelope.op.type).toBe("items.change");
    const first = await snapshot();
    expect(first.canvas.items.itm_a!.x).not.toBe(first.canvas.items.itm_b!.x);
    const placements = entry.envelope.op.type === "items.change" ? entry.envelope.op.changes.map(c => c.type === "item.add" ? c.placement : null) : [];
    expect(placements).toEqual([expect.objectContaining({ x: first.canvas.items.itm_a!.x }), expect.objectContaining({ x: first.canvas.items.itm_b!.x })]);
    expect((await undo()).status).toBe(200);
    expect(await items()).toEqual([]);
    expect((await redo()).status).toBe(200);
    expect((await snapshot()).canvas.items.itm_a!.versions).toEqual(first.canvas.items.itm_a!.versions);
    const marks = reachableHashes({ project: first.project, canvas: { ...first.canvas, items: {}, trash: [] } }, [entry]);
    expect(marks.has("hash_ver_itm_a")).toBe(true);
    expect(marks.has("hash_ver_itm_b")).toBe(true);
    const beforeRestart = await snapshot();
    await daemon.close();
    daemon = await startDaemon({ port: 0, home });
    const address = daemon.app.server.address();
    base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
    const restored = await snapshot();
    expect(restored.canvas.items).toEqual(beforeRestart.canvas.items);
    expect(applyOperation({ project: first.project, canvas: { ...first.canvas, items: {}, trash: [] } }, entry.envelope)!.canvas.items).toEqual(first.canvas.items);
  });

  it("refuses late failure and nested internal operations without a state or sequence change", async () => {
    await addItem("itm_a");
    const before = await snapshot();
    const first = { type: "item.update", itemId: "itm_a", patch: { title: "Must not land" } };
    for (const changes of [
      [first, { type: "item.delete", itemId: "itm_missing" }],
      [first, { type: "item.removeVersion", itemId: "itm_a", versionId: "ver_itm_a", prevCurrentVersionId: "ver_itm_a" }],
      [first, { type: "items.change", changes: [first] }],
      [first, { type: "project.delete" }],
    ]) {
      expect((await submit({ type: "items.change", changes })).status).toBe(400);
      expect(await snapshot()).toEqual(before);
    }
    await op({ type: "item.update", itemId: "itm_a", patch: { title: "Concurrent edit" } }, bob);
    const changed = await snapshot();
    const response = await submit({ type: "items.change", changes: [first], guards: [guardItem(before.canvas.items.itm_a!)] });
    expect(response.status).toBe(400);
    expect(await response.text()).toContain("edit-conflict");
    expect(await snapshot()).toEqual(changed);
  });
});
