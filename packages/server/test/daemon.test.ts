import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { WebSocket } from "ws";
import type { LogEntry, Operation, ServerMessage } from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";

const alice = { id: "usr_alice", name: "Alice" };
const bob = { id: "usr_bob", name: "Bob" };

let home: string;
let daemon: Daemon;
let base: string;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-daemon-"));
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  base = `http://127.0.0.1:${port}`;
});

afterEach(async () => {
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true });
});

async function post(url: string, body: unknown): Promise<{ status: number; json: any }> {
  const res = await fetch(`${base}${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

async function op(operation: Operation, projectId: string | null = "prj_1", actor = alice) {
  return post("/api/ops", { projectId, actor, op: operation });
}

async function get(url: string): Promise<any> {
  const res = await fetch(`${base}${url}`);
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

  it("404s unknown projects", async () => {
    const res = await fetch(`${base}/api/projects/prj_nope/canvas`);
    expect(res.status).toBe(404);
  });

  it("undo/redo over HTTP with shared linear stack", async () => {
    await createProjectWithItem();
    await op({ type: "item.move", itemId: "itm_1", x: 100, y: 100 });

    const undo = await post("/api/projects/prj_1/undo", { actor: bob });
    expect(undo.status).toBe(200);
    expect(undo.json.cause).toEqual({ kind: "undo", targetSeq: 3 });
    let snapshot = await get("/api/projects/prj_1/canvas");
    expect(snapshot.canvas.items["itm_1"].x).toBe(5);
    expect(snapshot.canvas.items["itm_1"].updatedBy).toEqual(bob);

    const redo = await post("/api/projects/prj_1/redo", { actor: bob });
    expect(redo.json.cause).toEqual({ kind: "redo", targetSeq: 3 });
    snapshot = await get("/api/projects/prj_1/canvas");
    expect(snapshot.canvas.items["itm_1"].x).toBe(100);

    // undo of item.add parks the item in trash
    await post("/api/projects/prj_1/undo", { actor: alice }); // undoes the redone move
    await post("/api/projects/prj_1/undo", { actor: alice }); // undoes item.add
    snapshot = await get("/api/projects/prj_1/canvas");
    expect(snapshot.canvas.items["itm_1"]).toBeUndefined();
    expect(snapshot.canvas.trash).toHaveLength(1);

    // exhausted
    const exhausted = await post("/api/projects/prj_1/undo", { actor: alice });
    expect(exhausted.status).toBe(409);

    // new op truncates redo
    await post("/api/projects/prj_1/redo", { actor: alice }); // restore itm_1
    await op({ type: "item.move", itemId: "itm_1", x: 7, y: 7 });
    const noRedo = await post("/api/projects/prj_1/redo", { actor: alice });
    expect(noRedo.status).toBe(409);
  });

  it("undo state survives a daemon restart (rebuilt from oplog)", async () => {
    await createProjectWithItem();
    await op({ type: "item.move", itemId: "itm_1", x: 100, y: 100 });
    await post("/api/projects/prj_1/undo", { actor: alice });

    await daemon.close();
    daemon = await startDaemon({ port: 0, home });
    const address = daemon.app.server.address();
    base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;

    // redo the undone move after restart
    const redo = await post("/api/projects/prj_1/redo", { actor: bob });
    expect(redo.status).toBe(200);
    const snapshot = await get("/api/projects/prj_1/canvas");
    expect(snapshot.canvas.items["itm_1"].x).toBe(100);
  });

  it("uploads and serves blobs with security headers", async () => {
    await createProjectWithItem();
    const body = "<h1>hi</h1>";
    const upload = await fetch(`${base}/api/projects/prj_1/blobs`, {
      method: "POST",
      headers: { "Content-Type": "text/html", "X-Isocan-Filename": "page.html" },
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
    const res = await fetch(`${base}/api/projects/prj_1/canvas`);
    expect(res.status).toBe(404);
    expect(await get("/api/projects")).toEqual([]);
  });
});

describe("daemon WS", () => {
  function connect(projectId: string): Promise<{ ws: WebSocket; messages: ServerMessage[] }> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${base.replace("http", "ws")}/ws?projectId=${projectId}`);
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
    await until(() => messages.length >= 2);
    expect(messages[1]!.type).toBe("op-applied");
    expect(((messages[1] as any).entry.envelope.op as any).x).toBe(42);
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
