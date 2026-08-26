import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { GcReport, Operation } from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";
import * as p from "../src/paths.ts";

const alice = { id: "usr_alice", name: "Alice" };

let home: string;
let daemon: Daemon;
let base: string;
let badge: TestBadge;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-gc-"));
  daemon = await startDaemon({ port: 0, home });
  base = baseOf(daemon);
  badge = await mintTestBadge(base);
  await badge.speakAs(alice); // a badge speaks only for actors it claims
});

afterEach(async () => {
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true });
});

function baseOf(d: Daemon): string {
  const address = d.app.server.address();
  return `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
}

async function post(url: string, body: unknown): Promise<{ status: number; json: any }> {
  const res = await fetch(`${base}${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...badge.headers },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

async function op(operation: Operation, canvasId: string | null = "prj_1", actor = alice) {
  return post("/api/ops", { canvasId, actor, op: operation });
}

async function uploadBlob(content: string, filename: string): Promise<string> {
  const res = await fetch(`${base}/api/projects/prj_1/blobs`, {
    method: "POST",
    headers: { "Content-Type": "text/markdown", "X-Isocan-Filename": filename, ...badge.headers },
    body: content,
  });
  const { blobHash } = (await res.json()) as { blobHash: string };
  return blobHash;
}

async function blobStatus(hash: string): Promise<number> {
  const res = await fetch(`${base}/api/projects/prj_1/blobs/${hash}`, { headers: badge.headers });
  await res.arrayBuffer().catch(() => {}); // drain so the connection frees up
  return res.status;
}

async function gc(request: Record<string, unknown>): Promise<GcReport> {
  const res = await post("/api/projects/prj_1/gc", request);
  expect(res.status).toBe(200);
  return res.json as GcReport;
}

/** Canvas with one live item whose content is a real uploaded blob. */
async function seed(): Promise<{ liveHash: string }> {
  await op({ type: "project.create", canvasId: "prj_1", title: "P" }, null);
  const liveHash = await uploadBlob("# live\n", "live.md");
  await op({
    type: "item.add",
    itemId: "itm_live",
    version: { id: "ver_live", blobHash: liveHash, mimeType: "text/markdown", filename: "live.md", size: 7 },
    width: 100,
    height: 100,
    placement: { x: 0, y: 0 },
  });
  return { liveHash };
}

describe("blob GC", () => {
  it("sweeps orphaned uploads, keeps referenced blobs", async () => {
    const { liveHash } = await seed();
    const orphanHash = await uploadBlob("# never referenced\n", "orphan.md");

    const report = await gc({ graceMs: 0 });
    expect(report.sweptBlobs).toBe(1);
    expect(report.reachableBlobs).toBe(1);
    expect(await blobStatus(liveHash)).toBe(200);
    expect(await blobStatus(orphanHash)).toBe(404);
  });

  it("grace period protects fresh uploads (the upload→item.add gap)", async () => {
    await seed();
    const pendingHash = await uploadBlob("# about to become an item\n", "pending.md");

    const report = await gc({ graceMs: 60_000 });
    expect(report.sweptBlobs).toBe(0);
    expect(report.skippedRecentBlobs).toBe(1);
    expect(await blobStatus(pendingHash)).toBe(200);
  });

  it("within the horizon, emptied-trash blobs stay undo-reachable and are kept", async () => {
    await seed();
    const doomedHash = await uploadBlob("# doomed\n", "doomed.md");
    await op({
      type: "item.add",
      itemId: "itm_doomed",
      version: { id: "ver_d", blobHash: doomedHash, mimeType: "text/markdown", filename: "doomed.md", size: 9 },
      width: 50,
      height: 50,
      placement: { x: 500, y: 0 },
    });
    await op({ type: "item.delete", itemId: "itm_doomed" });
    await op({ type: "trash.empty" });

    // Default horizon retains the item.add entry → its blob is still marked.
    const report = await gc({ graceMs: 0 });
    expect(report.droppedEntries).toBe(0);
    expect(report.sweptBlobs).toBe(0);
    expect(await blobStatus(doomedHash)).toBe(200);

    // Past the horizon, it becomes garbage.
    const compacted = await gc({ graceMs: 0, keepOps: 0 });
    expect(compacted.droppedEntries).toBeGreaterThan(0);
    expect(compacted.sweptBlobs).toBe(1);
    expect(await blobStatus(doomedHash)).toBe(404);
    // The live item's content is state-reachable regardless of the log.
    const { liveHash } = { liveHash: (await gc({ dryRun: true })).reachableBlobs };
    expect(liveHash).toBe(1);
  });

  it("compaction archives dropped entries and empties undo history past the horizon", async () => {
    await seed();
    await op({ type: "item.move", itemId: "itm_live", x: 9, y: 9 });

    const report = await gc({ keepOps: 0, graceMs: 0 });
    expect(report.retainedEntries).toBe(0);
    expect(report.droppedEntries).toBe(3);

    const live = await fs.readFile(p.oplogFile(home, "prj_1"), "utf8");
    expect(live.trim()).toBe("");
    const archive = await fs.readFile(p.oplogArchiveFile(home, "prj_1"), "utf8");
    expect(archive.trim().split("\n")).toHaveLength(3);

    // History is gone: nothing to undo, but state is fully intact.
    expect((await post("/api/projects/prj_1/undo", { actor: alice })).status).toBe(409);
    const snapshot = await (await fetch(`${base}/api/projects/prj_1/canvas`, { headers: badge.headers })).json();
    expect((snapshot as any).canvas.items["itm_live"].x).toBe(9);
  });

  it("the archive can be read back over the wire — history is archived, never unreachable", async () => {
    await seed();
    await op({ type: "item.move", itemId: "itm_live", x: 9, y: 9 });

    // Nothing compacted yet: the archive exists as an answer, and it is empty.
    const before = await fetch(`${base}/api/projects/prj_1/oplog/archive`, { headers: badge.headers });
    expect(before.status).toBe(200);
    expect(await before.json()).toEqual([]);

    await gc({ keepOps: 0, graceMs: 0 });

    // What compaction set aside is exactly what the route returns, in seq
    // order — `tail --archived` and `recap` read the same record `gc` wrote.
    const res = await fetch(`${base}/api/projects/prj_1/oplog/archive`, { headers: badge.headers });
    expect(res.status).toBe(200);
    const archived = (await res.json()) as Array<{ seq: number; envelope: { op: Operation } }>;
    expect(archived.map((entry) => entry.seq)).toEqual([1, 2, 3]);
    expect(archived[2]!.envelope.op.type).toBe("item.move");

    // And the live log really did let go of them: the two reads partition the
    // history rather than overlapping.
    const live = await fetch(`${base}/api/projects/prj_1/oplog?since=0`, { headers: badge.headers });
    expect(await live.json()).toEqual([]);
  });

  it("keeps undo/redo pairs intact across the cut (closure over cause.targetSeq)", async () => {
    await seed(); // seqs: 1 create, 2 add
    await op({ type: "item.move", itemId: "itm_live", x: 100, y: 100 }); // 3
    await post("/api/projects/prj_1/undo", { actor: alice }); // 4 (undoes 3 → back to 0,0)

    // keepOps 1 retains only the undo entry; closure must pull in its target.
    const report = await gc({ keepOps: 1, graceMs: 0 });
    expect(report.retainedEntries).toBe(2);

    const redo = await post("/api/projects/prj_1/redo", { actor: alice });
    expect(redo.status).toBe(200);
    const snapshot = await (await fetch(`${base}/api/projects/prj_1/canvas`, { headers: badge.headers })).json();
    expect((snapshot as any).canvas.items["itm_live"].x).toBe(100);
  });

  it("dry run reports without deleting or compacting", async () => {
    const { liveHash } = await seed();
    const orphanHash = await uploadBlob("# orphan\n", "orphan.md");

    const report = await gc({ dryRun: true, keepOps: 0, graceMs: 0 });
    expect(report.dryRun).toBe(true);
    expect(report.sweptBlobs).toBe(1);
    expect(report.droppedEntries).toBeGreaterThan(0);

    // Nothing actually happened.
    expect(await blobStatus(orphanHash)).toBe(200);
    expect(await blobStatus(liveHash)).toBe(200);
    const live = await fs.readFile(p.oplogFile(home, "prj_1"), "utf8");
    expect(live.trim().split("\n").length).toBeGreaterThan(0);
    expect((await post("/api/projects/prj_1/undo", { actor: alice })).status).toBe(200);
  });

  it("survives a restart after compaction", async () => {
    await seed();
    await op({ type: "item.move", itemId: "itm_live", x: 42, y: 42 });
    await gc({ keepOps: 1, graceMs: 0 });

    await daemon.close();
    daemon = await startDaemon({ port: 0, home });
    base = baseOf(daemon);

    const snapshot = await (await fetch(`${base}/api/projects/prj_1/canvas`, { headers: badge.headers })).json();
    expect((snapshot as any).canvas.items["itm_live"].x).toBe(42);
    // Sequence numbering continues past the compacted log.
    const next = await op({ type: "item.move", itemId: "itm_live", x: 1, y: 1 });
    expect(next.json.seq).toBe((snapshot as any).lastSeq + 1);
  });
});
