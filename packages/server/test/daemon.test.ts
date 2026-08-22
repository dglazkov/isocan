import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { WebSocket } from "ws";
import type { LogEntry, Operation, ServerMessage } from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

const alice = { id: "usr_alice", name: "Alice" };
const bob = { id: "usr_bob", name: "Bob" };

let home: string;
let daemon: Daemon;
let base: string;
/** Every surface carries a badge now; this file is about what the daemon
 * DOES, not about anonymity, so it gets one in the helper. */
let badge: TestBadge;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-daemon-"));
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  base = `http://127.0.0.1:${port}`;
  badge = await mintTestBadge(base);
});

afterEach(async () => {
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true });
});

async function post(url: string, body: unknown): Promise<{ status: number; json: any }> {
  const res = await fetch(`${base}${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...badge.headers },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

async function op(operation: Operation, projectId: string | null = "prj_1", actor = alice) {
  return post("/api/ops", { projectId, actor, op: operation });
}

async function get(url: string): Promise<any> {
  const res = await fetch(`${base}${url}`, { headers: badge.headers });
  return res.json();
}

function nv(id: string) {
  return { id, blobHash: `h_${id}`, mimeType: "text/markdown", filename: `${id}.md`, size: 4 };
}

async function createProjectWithItem(): Promise<void> {
  await op({ type: "project.create", projectId: "prj_1", title: "P" }, null);
  await op({
    type: "item.add",
    itemId: "itm_1",
    version: nv("ver_1"),
    width: 100,
    height: 80,
    placement: { x: 5, y: 6 },
  });
}

describe("daemon HTTP", () => {
  it("healthz answers", async () => {
    const health = await get("/healthz");
    expect(health.ok).toBe(true);
    expect(health.pid).toBe(process.pid);
  });

  it("applies ops and serves snapshots", async () => {
    await createProjectWithItem();
    const projects = await get("/api/projects");
    expect(projects.map((p: any) => p.id)).toEqual(["prj_1"]);
    const snapshot = await get("/api/projects/prj_1/canvas");
    expect(snapshot.canvas.items["itm_1"].x).toBe(5);
    expect(snapshot.lastSeq).toBe(2);
    expect(snapshot.canvas.items["itm_1"].createdBy).toEqual(alice);
  });

  it("normalizes anchored placement before logging", async () => {
    await createProjectWithItem();
    const { json } = await op({
      type: "item.add",
      itemId: "itm_2",
      version: nv("ver_2"),
      width: 60,
      height: 40,
      placement: { anchorItemId: "itm_1" },
    });
    expect(json.envelope.op.placement).toEqual({ x: 5 - 40 - 60, y: 6 });
    const log: LogEntry[] = await get("/api/projects/prj_1/oplog?since=2");
    expect(log).toHaveLength(1);
    expect((log[0]!.envelope.op as any).placement).toEqual({ x: -95, y: 6 });
  });

  it("rejects invalid ops with 400 and typed codes", async () => {
    await createProjectWithItem();
    const bad = await op({ type: "item.move", itemId: "itm_nope", x: 0, y: 0 });
    expect(bad.status).toBe(400);
    expect(bad.json.code).toBe("unknown-item");

    const internal = await op({
      type: "comment.remove",
      threadId: "thr_x",
      commentId: "cmt_x",
    } as Operation);
    expect(internal.status).toBe(400);
    expect(internal.json.code).toBe("internal-op");
  });

  // Regression: a daemon older than the client that sent the op used to fall
  // out of the reducer switch — the entry landed in the oplog with no inverse
  // and undefined became the project's in-memory state, 500ing every read
  // afterwards.
  it("rejects an op type it does not know, leaving the project intact", async () => {
    await createProjectWithItem();
    const future = await op({ type: "item.teleport", itemId: "itm_1" } as unknown as Operation);
    expect(future.status).toBe(400);
    expect(future.json.code).toBe("unknown-op");

    const log: LogEntry[] = await get("/api/projects/prj_1/oplog?since=0");
    expect(log).toHaveLength(2); // nothing appended
    const snapshot = await get("/api/projects/prj_1/canvas");
    expect(snapshot.canvas.items["itm_1"].x).toBe(5);

    // The project still accepts ops.
    const move = await op({ type: "item.move", itemId: "itm_1", x: 9, y: 9 });
    expect(move.status).toBe(200);
  });

  it("404s unknown projects", async () => {
    const res = await fetch(`${base}/api/projects/prj_nope/canvas`, { headers: badge.headers });
    expect(res.status).toBe(404);
  });

  it("undo/redo are actor-scoped: each actor walks only their own ops", async () => {
    await createProjectWithItem(); // alice: create (1), add itm_1 at 5,6 (2)
    await op({ type: "item.move", itemId: "itm_1", x: 100, y: 100 }, "prj_1", alice); // 3
    await op({ type: "item.move", itemId: "itm_1", x: 200, y: 200 }, "prj_1", bob); // 4

    // Bob's undo reverses BOB's move, not the top of a shared stack.
    const bobUndo = await post("/api/projects/prj_1/undo", { actor: bob });
    expect(bobUndo.status).toBe(200);
    expect(bobUndo.json.cause).toEqual({ kind: "undo", targetSeq: 4 });
    let snapshot = await get("/api/projects/prj_1/canvas");
    expect(snapshot.canvas.items["itm_1"].x).toBe(100);

    // Alice's undo reverses ALICE's move.
    const aliceUndo = await post("/api/projects/prj_1/undo", { actor: alice });
    expect(aliceUndo.json.cause).toEqual({ kind: "undo", targetSeq: 3 });
    snapshot = await get("/api/projects/prj_1/canvas");
    expect(snapshot.canvas.items["itm_1"].x).toBe(5);

    // Bob can still redo his own move afterwards.
    const bobRedo = await post("/api/projects/prj_1/redo", { actor: bob });
    expect(bobRedo.json.cause).toEqual({ kind: "redo", targetSeq: 4 });
    snapshot = await get("/api/projects/prj_1/canvas");
    expect(snapshot.canvas.items["itm_1"].x).toBe(200);

    // Alice undoes her item.add → item (carrying everyone's edits) to trash.
    await post("/api/projects/prj_1/undo", { actor: alice });
    snapshot = await get("/api/projects/prj_1/canvas");
    expect(snapshot.canvas.items["itm_1"]).toBeUndefined();
    expect(snapshot.canvas.trash).toHaveLength(1);

    // Alice is exhausted (project.create is not undoable)…
    expect((await post("/api/projects/prj_1/undo", { actor: alice })).status).toBe(409);
    // …and Bob's remaining undo candidate targets a trashed item → skipped → 409.
    expect((await post("/api/projects/prj_1/undo", { actor: bob })).status).toBe(409);
  });

  it("a fresh op truncates only that actor's redo branch", async () => {
    await createProjectWithItem();
    await op({ type: "item.move", itemId: "itm_1", x: 100, y: 100 }, "prj_1", alice);
    await op({ type: "item.move", itemId: "itm_1", x: 200, y: 200 }, "prj_1", bob);
    await post("/api/projects/prj_1/undo", { actor: alice }); // move back toward 5,6
    await post("/api/projects/prj_1/undo", { actor: bob });

    // Alice acts anew → HER redo is gone, Bob's survives.
    await op({ type: "item.move", itemId: "itm_1", x: 9, y: 9 }, "prj_1", alice);
    expect((await post("/api/projects/prj_1/redo", { actor: alice })).status).toBe(409);
    const bobRedo = await post("/api/projects/prj_1/redo", { actor: bob });
    expect(bobRedo.status).toBe(200);
    const snapshot = await get("/api/projects/prj_1/canvas");
    expect(snapshot.canvas.items["itm_1"].x).toBe(200);
  });

  it("undo skips entries whose targets another actor deleted", async () => {
    await createProjectWithItem();
    await op(
      { type: "thread.create", threadId: "thr_1", x: 0, y: 0, anchorItemId: null, comment: { id: "cmt_1", body: "one" } },
      "prj_1",
      alice,
    );
    const t2 = await op(
      { type: "thread.create", threadId: "thr_2", x: 0, y: 0, anchorItemId: null, comment: { id: "cmt_2", body: "two" } },
      "prj_1",
      alice,
    );
    await op({ type: "thread.delete", threadId: "thr_2" }, "prj_1", bob);

    // Alice's top candidate (create thr_2) is gone — skipped; her undo lands
    // on create thr_1 instead.
    const undo = await post("/api/projects/prj_1/undo", { actor: alice });
    expect(undo.status).toBe(200);
    expect(undo.json.cause.targetSeq).toBeLessThan(t2.json.seq);
    const snapshot = await get("/api/projects/prj_1/canvas");
    expect(Object.keys(snapshot.canvas.threads)).toEqual([]);
  });

  it("redo of a creation restores full fidelity, including others' replies", async () => {
    await createProjectWithItem();
    await op(
      { type: "thread.create", threadId: "thr_1", x: 0, y: 0, anchorItemId: null, comment: { id: "cmt_1", body: "mine" } },
      "prj_1",
      alice,
    );
    await op(
      { type: "thread.reply", threadId: "thr_1", comment: { id: "cmt_2", body: "bob's reply" } },
      "prj_1",
      bob,
    );

    // Alice undoes her thread.create → the whole thread (with Bob's reply) goes.
    await post("/api/projects/prj_1/undo", { actor: alice });
    let snapshot = await get("/api/projects/prj_1/canvas");
    expect(snapshot.canvas.threads["thr_1"]).toBeUndefined();

    // Redo restores the snapshot, not a re-run of the original op — Bob's
    // reply and authorship come back intact.
    await post("/api/projects/prj_1/redo", { actor: alice });
    snapshot = await get("/api/projects/prj_1/canvas");
    const comments = snapshot.canvas.threads["thr_1"].comments;
    expect(comments.map((c: any) => c.body)).toEqual(["mine", "bob's reply"]);
    expect(comments[1].author).toEqual(bob);
  });

  it("batch inverses are repaired to their surviving members", async () => {
    await createProjectWithItem();
    await op({
      type: "item.add",
      itemId: "itm_2",
      version: nv("ver_2"),
      width: 50,
      height: 50,
      placement: { x: 500, y: 500 },
    });
    await op(
      {
        type: "items.move",
        moves: [
          { itemId: "itm_1", x: 1000, y: 1000 },
          { itemId: "itm_2", x: 2000, y: 2000 },
        ],
      },
      "prj_1",
      alice,
    );
    await op({ type: "item.delete", itemId: "itm_2" }, "prj_1", bob);

    // Alice's group-move inverse shrinks to the surviving item.
    const undo = await post("/api/projects/prj_1/undo", { actor: alice });
    expect(undo.status).toBe(200);
    expect(undo.json.envelope.op).toEqual({
      type: "items.move",
      moves: [{ itemId: "itm_1", x: 5, y: 6 }],
    });
    const snapshot = await get("/api/projects/prj_1/canvas");
    expect(snapshot.canvas.items["itm_1"].x).toBe(5);
  });

  it("undo state survives a daemon restart (rebuilt from oplog)", async () => {
    await createProjectWithItem();
    await op({ type: "item.move", itemId: "itm_1", x: 100, y: 100 });
    await post("/api/projects/prj_1/undo", { actor: alice });

    await daemon.close();
    daemon = await startDaemon({ port: 0, home });
    const address = daemon.app.server.address();
    base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;

    // redo the undone move after restart — per-actor stacks rebuild from the oplog
    const redo = await post("/api/projects/prj_1/redo", { actor: alice });
    expect(redo.status).toBe(200);
    const snapshot = await get("/api/projects/prj_1/canvas");
    expect(snapshot.canvas.items["itm_1"].x).toBe(100);
  });

  it("oplog long-poll holds until an entry lands, or times out empty", async () => {
    await createProjectWithItem(); // seqs 1..2
    // Timeout path: nothing new past seq 2 → empty after ~waitMs.
    let started = Date.now();
    const empty = await get("/api/projects/prj_1/oplog?since=2&waitMs=250");
    expect(empty).toEqual([]);
    expect(Date.now() - started).toBeGreaterThanOrEqual(200);

    // Wake path: an op lands mid-poll → resolves early with the entry.
    started = Date.now();
    const pending = fetch(`${base}/api/projects/prj_1/oplog?since=2&waitMs=5000`, { headers: badge.headers }).then((r) =>
      r.json(),
    );
    await new Promise((r) => setTimeout(r, 120));
    await op({ type: "item.move", itemId: "itm_1", x: 9, y: 9 });
    const woke = (await pending) as LogEntry[];
    expect(Date.now() - started).toBeLessThan(3000);
    expect(woke).toHaveLength(1);
    expect(woke[0]!.envelope.op.type).toBe("item.move");
  });

  it("the home-wide watch seeds at now, then hears every canvas — new ones included", async () => {
    await createProjectWithItem();

    // Seeding (no cursors) reports tips and no entries: "from here on".
    const seed = await post("/api/oplog/watch", {});
    expect(seed.json.entries).toEqual([]);
    expect(seed.json.cursors).toEqual({ prj_1: 2 });

    // A canvas born after the agent parked, and a comment on it. The watcher
    // never saw prj_2, so it is streamed from its very first op — issue #37.
    await op({ type: "project.create", projectId: "prj_2", title: "New space" }, null, bob);
    await op(
      {
        type: "thread.create",
        threadId: "thr_1",
        x: 1,
        y: 2,
        anchorItemId: null,
        main: true,
        comment: { id: "cmt_1", body: "are you there?" },
      },
      "prj_2",
      bob,
    );

    const batch = await post("/api/oplog/watch", { cursors: seed.json.cursors });
    expect(batch.json.entries.map((e: any) => [e.projectId, e.projectTitle, e.envelope.op.type]))
      .toEqual([
        ["prj_2", "New space", "project.create"],
        ["prj_2", "New space", "thread.create"],
      ]);
    expect(batch.json.cursors).toEqual({ prj_1: 2, prj_2: 2 });

    // Nothing new past those cursors → the poll holds, then comes back empty.
    let started = Date.now();
    const quiet = await post("/api/oplog/watch", { cursors: batch.json.cursors, waitMs: 250 });
    expect(quiet.json.entries).toEqual([]);
    expect(Date.now() - started).toBeGreaterThanOrEqual(200);

    // An op on ANY canvas wakes it — here, the one it was not started on.
    started = Date.now();
    const pending = post("/api/oplog/watch", { cursors: batch.json.cursors, waitMs: 5000 });
    await new Promise((r) => setTimeout(r, 120));
    await op({ type: "item.move", itemId: "itm_1", x: 9, y: 9 }, "prj_1", bob);
    const woke = await pending;
    expect(Date.now() - started).toBeLessThan(3000);
    expect(woke.json.entries).toHaveLength(1);
    expect(woke.json.entries[0].projectId).toBe("prj_1");
  });

  it("`only` pins the watch to named canvases — the rest of the home is silent", async () => {
    await createProjectWithItem();
    await op({ type: "project.create", projectId: "prj_2", title: "Elsewhere" }, null, bob);

    // Pinned to prj_2, which has nothing past its creation. A canvas absent
    // from `only` must not be swept in from seq 0.
    const started = Date.now();
    const quiet = await post("/api/oplog/watch", {
      only: ["prj_2"],
      cursors: { prj_2: 1 },
      waitMs: 250,
    });
    expect(quiet.json.entries).toEqual([]);
    expect(quiet.json.cursors).toEqual({ prj_2: 1 });
    expect(Date.now() - started).toBeGreaterThanOrEqual(200);

    // Nor may an op elsewhere cut the poll short.
    const pending = post("/api/oplog/watch", {
      only: ["prj_2"],
      cursors: { prj_2: 1 },
      waitMs: 400,
    });
    await new Promise((r) => setTimeout(r, 60));
    await op({ type: "item.move", itemId: "itm_1", x: 9, y: 9 }, "prj_1", bob);
    expect((await pending).json.entries).toEqual([]);
  });

  it("uploads and serves blobs with security headers", async () => {
    await createProjectWithItem();
    const body = "<h1>hi</h1>";
    const upload = await fetch(`${base}/api/projects/prj_1/blobs`, {
      method: "POST",
      headers: { "Content-Type": "text/html", "X-Isocan-Filename": "page.html", ...badge.headers },
      body,
    });
    const { blobHash, size } = (await upload.json()) as { blobHash: string; size: number };
    expect(size).toBe(body.length);

    const res = await fetch(`${base}/api/projects/prj_1/blobs/${blobHash}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/html");
    expect(res.headers.get("content-security-policy")).toBe("sandbox allow-scripts");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await res.text()).toBe(body);

    const missing = await fetch(`${base}/api/projects/prj_1/blobs/deadbeef`);
    expect(missing.status).toBe(404);
  });

  it("project.delete parks the directory and 404s afterwards", async () => {
    await createProjectWithItem();
    await op({ type: "project.delete" });
    const res = await fetch(`${base}/api/projects/prj_1/canvas`, { headers: badge.headers });
    expect(res.status).toBe(404);
    expect(await get("/api/projects")).toEqual([]);
  });
});

describe("daemon WS", () => {
  function connect(projectId: string): Promise<{ ws: WebSocket; messages: ServerMessage[] }> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${base.replace("http", "ws")}/ws?projectId=${projectId}`, {
        headers: badge.headers,
      });
      const messages: ServerMessage[] = [];
      ws.on("message", (data) => messages.push(JSON.parse(String(data))));
      ws.on("open", () => resolve({ ws, messages }));
      ws.on("error", reject);
    });
  }

  async function until(fn: () => boolean, ms = 2000): Promise<void> {
    const start = Date.now();
    while (!fn()) {
      if (Date.now() - start > ms) throw new Error("timed out");
      await new Promise((r) => setTimeout(r, 10));
    }
  }

  it("sends snapshot on connect, then op-applied per mutation", async () => {
    await createProjectWithItem();
    const { ws, messages } = await connect("prj_1");
    await until(() => messages.length >= 1);
    expect(messages[0]!.type).toBe("snapshot");
    expect((messages[0] as any).canvas.items["itm_1"].x).toBe(5);

    await op({ type: "item.move", itemId: "itm_1", x: 42, y: 43 });
    // presence-roster messages may interleave — find the op broadcast.
    await until(() => messages.some((m) => m.type === "op-applied"));
    const applied = messages.find((m) => m.type === "op-applied")!;
    expect(((applied as any).entry.envelope.op as any).x).toBe(42);
    ws.close();
  });

  it("notifies project-deleted and closes the room", async () => {
    await createProjectWithItem();
    const { ws, messages } = await connect("prj_1");
    await until(() => messages.length >= 1);
    await op({ type: "project.delete" });
    await until(() => messages.some((m) => m.type === "project-deleted"));
    await until(() => ws.readyState === WebSocket.CLOSED);
  });
});
