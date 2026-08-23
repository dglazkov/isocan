import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { WebSocket } from "ws";
import type { Operation, ServerMessage } from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * "I have through N" — the lid-close beat (journey, Scene 4, beat 7).
 *
 * A client that has been away does not need the canvas back, it needs the
 * evening: it presents the last seq it holds and the home streams the tail,
 * replayed through the reducer exactly like crash recovery, because it IS that
 * code path. The browser tab uses this on every reconnect; phase 6 stage 2's
 * home connection uses the same handshake from the other end.
 *
 * The contract has two halves and a client must handle either: `resumed` +
 * a tail when the home can serve it, and today's `snapshot` when it cannot.
 * The fallback is not an error path — it is what a home says when the client
 * is ahead of it, or when the entries it wants have been compacted out of the
 * live log — which is why most of what follows is about the fallback.
 */

const priya = { id: "usr_priya", name: "Priya" };

let home: string;
let daemon: Daemon;
let base: string;
let badge: TestBadge;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-resume-"));
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  base = `http://127.0.0.1:${port}`;
  badge = await mintTestBadge(base);
  await badge.speakAs(priya);
});

afterEach(async () => {
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true });
});

async function op(operation: Operation, projectId: string | null = "prj_1"): Promise<void> {
  const res = await fetch(`${base}/api/ops`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...badge.headers },
    body: JSON.stringify({ projectId, actor: priya, op: operation }),
  });
  if (!res.ok) throw new Error(`op ${operation.type} refused: ${await res.text()}`);
}

function nv(id: string) {
  return { id, blobHash: `h_${id}`, mimeType: "text/markdown", filename: `${id}.md`, size: 4 };
}

/** A canvas with one item on it: seq 1 creates, seq 2 adds. */
async function seedCanvas(): Promise<void> {
  await op({ type: "project.create", projectId: "prj_1", title: "Acme Sprint Board" }, null);
  await op({
    type: "item.add",
    itemId: "itm_1",
    version: nv("ver_1"),
    width: 100,
    height: 80,
    placement: { x: 5, y: 6 },
  });
}

/** Three more moves, so there is an evening to miss. */
async function anEvening(): Promise<void> {
  await op({ type: "item.move", itemId: "itm_1", x: 10, y: 10 });
  await op({ type: "item.move", itemId: "itm_1", x: 20, y: 20 });
  await op({ type: "item.move", itemId: "itm_1", x: 30, y: 30 });
}

function connect(query: string): Promise<{ ws: WebSocket; messages: ServerMessage[] }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${base.replace("http", "ws")}/ws?${query}`, {
      headers: badge.headers,
    });
    const messages: ServerMessage[] = [];
    ws.on("message", (data) => messages.push(JSON.parse(String(data)) as ServerMessage));
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

describe("the seq cursor on connect", () => {
  it("streams the tail to a client that says how far it got", async () => {
    await seedCanvas();
    await anEvening();

    const { ws, messages } = await connect("projectId=prj_1&since=2");
    await until(() => messages.some((m) => m.type === "presence-roster"));

    const hello = messages[0]!;
    expect(hello.type).toBe("resumed");
    expect(hello).toMatchObject({ from: 2, lastSeq: 5 });

    // One op-applied per entry in 3…5, in order, and NOT a snapshot: what the
    // client already had is not sent back to it.
    const applied = messages.filter((m) => m.type === "op-applied");
    expect(applied.map((m) => (m as { entry: { seq: number } }).entry.seq)).toEqual([3, 4, 5]);
    expect(messages.some((m) => m.type === "snapshot")).toBe(false);

    // The tail is ops, so it can only be applied by a client that kept its
    // state — these are the moves, in the order they happened.
    expect(
      applied.map((m) => ((m as { entry: { envelope: { op: any } } }).entry.envelope.op as any).x),
    ).toEqual([10, 20, 30]);

    // The roster still follows, as it does after a snapshot.
    expect(messages.some((m) => m.type === "presence-roster")).toBe(true);
    ws.close();
  });

  it("carries colors and names, so a rename reaches the words written before it", async () => {
    await seedCanvas();
    // Priya renames herself and picks a color while the lid is shut. Neither
    // is in the canvas oplog — the actor registry is home-scoped — so a tail
    // that carried only ops would leave the returning client re-lettering
    // nothing and repainting nobody.
    await badge.speakAs({ id: priya.id, name: "Priya Sharma" });
    await op({ type: "actor.setColor", actorId: priya.id, color: "#ff8800" }, null);
    await op({ type: "item.move", itemId: "itm_1", x: 11, y: 11 });

    const { ws, messages } = await connect("projectId=prj_1&since=2");
    await until(() => messages.length >= 1);
    expect(messages[0]).toMatchObject({
      type: "resumed",
      names: { [priya.id]: "Priya Sharma" },
      colors: { [priya.id]: "#ff8800" },
    });
    ws.close();
  });

  it("resumes with an empty tail when the client is exactly current", async () => {
    await seedCanvas();
    const { ws, messages } = await connect("projectId=prj_1&since=2");
    await until(() => messages.some((m) => m.type === "presence-roster"));
    expect(messages[0]).toMatchObject({ type: "resumed", from: 2, lastSeq: 2 });
    expect(messages.some((m) => m.type === "op-applied")).toBe(false);
    ws.close();
  });

  it("is not asked for at all without a cursor — today's snapshot, unchanged", async () => {
    await seedCanvas();
    for (const query of ["projectId=prj_1", "projectId=prj_1&since=0"]) {
      const { ws, messages } = await connect(query);
      await until(() => messages.length >= 1);
      expect(messages[0]!.type).toBe("snapshot");
      ws.close();
    }
  });

  it("snapshots a client that is AHEAD of the home rather than throwing", async () => {
    // A home restored from a backup behind its own replicas produces exactly
    // this, and it is the client that has to be corrected. A snapshot is the
    // correction; an error would leave a tab that can never reconnect.
    await seedCanvas();
    const { ws, messages } = await connect("projectId=prj_1&since=99");
    await until(() => messages.some((m) => m.type === "presence-roster"));
    expect(messages[0]!.type).toBe("snapshot");
    expect(messages[0]).toMatchObject({ lastSeq: 2 });
    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
  });

  it("snapshots when the tail has been compacted out of the live log", async () => {
    await seedCanvas();
    await anEvening();
    // GC compacts to an undo horizon. What survives is a SET, not a suffix —
    // `chooseRetained` pulls back whatever undo/redo chains reach — so the
    // honest test is not "is seq 3 gone" but "can 3…5 be handed over whole".
    await daemon.engine.gc("prj_1", { keepOps: 1, graceMs: 0 });

    const { ws, messages } = await connect("projectId=prj_1&since=2");
    await until(() => messages.some((m) => m.type === "presence-roster"));
    expect(messages[0]!.type).toBe("snapshot");
    // And the snapshot is not a consolation prize: it carries the state those
    // compacted ops produced.
    expect((messages[0] as any).canvas.items["itm_1"].x).toBe(30);
    ws.close();
  });

  it("snapshots when compaction leaves NO tail at all, rather than calling the client current", async () => {
    // The empty set is the case contiguity cannot see: `every()` is vacuously
    // true on an empty array, so a tail compacted away to nothing looks
    // exactly like a client that is already caught up. It is not — `resumed`
    // with `lastSeq: since` would tell a client holding seq 2 that it holds
    // seq 5. A tab would self-heal on the next op (the seq gap closes the
    // socket), but a canvas that then goes QUIET leaves it silently diverged
    // with nothing left to correct it — and in stage 2 that client is a
    // daemon's home connection, a replica that believes it is in sync.
    //
    // Reachable straight off the public route: `chooseRetained` returns `[]`
    // for `keepOps <= 0`, and `POST /api/projects/:id/gc` passes `keepOps`
    // through from the request body.
    await seedCanvas();
    await anEvening();
    await daemon.engine.gc("prj_1", { keepOps: 0, graceMs: 0 });

    const { ws, messages } = await connect("projectId=prj_1&since=2");
    await until(() => messages.some((m) => m.type === "presence-roster"));
    expect(messages[0]!.type).toBe("snapshot");
    // Specifically NOT the shape that hides the gap.
    expect(messages[0]).not.toMatchObject({ type: "resumed", lastSeq: 2 });
    expect((messages[0] as any).lastSeq).toBe(5);
    expect((messages[0] as any).canvas.items["itm_1"].x).toBe(30);
    ws.close();
  });

  it("ignores a cursor that is not a seq", async () => {
    await seedCanvas();
    for (const raw of ["banana", "-3", "2.5", ""]) {
      const { ws, messages } = await connect(`projectId=prj_1&since=${raw}`);
      await until(() => messages.length >= 1);
      expect(messages[0]!.type, `since=${raw}`).toBe("snapshot");
      ws.close();
    }
  });

  it("keeps broadcasting to a resumed socket like any other", async () => {
    // The resume is a handshake, not a mode: once caught up, the socket is an
    // ordinary member of the room.
    await seedCanvas();
    const { ws, messages } = await connect("projectId=prj_1&since=1");
    await until(() => messages.some((m) => m.type === "resumed"));
    await op({ type: "item.move", itemId: "itm_1", x: 77, y: 77 });
    await until(() => messages.some((m) => m.type === "op-applied" && m.entry.seq === 3));
    ws.close();
  });
});
