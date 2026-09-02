import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { WebSocket } from "ws";
import { WS_BEHIND, type Operation, type ServerMessage } from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * **The deploy overlap, from the reader's side** (#85).
 *
 * `max-instances=1` is per revision, so a rollout briefly runs two instances
 * over one store. The old one keeps every socket that was open before the
 * new one took the traffic — a WebSocket is one in-flight request with an
 * hour's timeout — while every NEW request lands on the new one. The new
 * instance appends and broadcasts into its own rooms; the old one holds the
 * tab, holds a room, and never learns the store moved: its cache is dropped
 * only when its own append is fenced, and nobody writes through it.
 *
 * The 31 Aug heartbeat carried a tip read from that same cache, so it agreed
 * with the frozen tab. This is the shape, with two daemons standing in for
 * two instances: A holds the socket, B boots from the durable state exactly
 * as a new revision does and takes the writes. What must be true afterwards:
 * A's beat reads the STORE, finds itself behind, and hangs up on the room
 * with a code that says "redial, you did nothing wrong" — and a fresh hello
 * to A is answered from the store, not from the cache it just dropped.
 */
const priya = { id: "usr_priya", name: "Priya" };

let home: string;
let a: Daemon;
let b: Daemon | null;
let badge: TestBadge;

const baseOf = (d: Daemon) => {
  const address = d.app.server.address();
  return `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
};

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-rollout-"));
  // What Cloud Run sets on every instance; a source checkout has no commit
  // stamp, so without this a daemon here would say nothing about its build.
  process.env["K_REVISION"] = "isocan-00042-test";
  a = await startDaemon({ port: 0, home, heartbeatMs: 150 });
  b = null;
  badge = await mintTestBadge(baseOf(a));
  await badge.speakAs(priya);
});

afterEach(async () => {
  delete process.env["K_REVISION"];
  await b?.close();
  await a.close();
  await fs.rm(home, { recursive: true, force: true });
});

async function op(base: string, operation: Operation, canvasId: string | null = "prj_1"): Promise<void> {
  const res = await fetch(`${base}/api/ops`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...badge.headers },
    body: JSON.stringify({ canvasId, actor: priya, op: operation }),
  });
  if (!res.ok) throw new Error(`op ${operation.type} refused: ${await res.text()}`);
}

function nv(id: string) {
  return { id, blobHash: `h_${id}`, mimeType: "text/markdown", filename: `${id}.md`, size: 4 };
}

interface Tab {
  ws: WebSocket;
  messages: ServerMessage[];
  closed: Promise<number>;
}

function connect(base: string): Promise<Tab> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${base.replace("http", "ws")}/ws?canvasId=prj_1`, {
      headers: badge.headers,
    });
    const messages: ServerMessage[] = [];
    const closed = new Promise<number>((done) => ws.on("close", (code) => done(code)));
    ws.on("message", (data) => messages.push(JSON.parse(String(data)) as ServerMessage));
    ws.on("open", () => resolve({ ws, messages, closed }));
    ws.on("error", reject);
  });
}

async function until(fn: () => boolean, ms = 4000): Promise<void> {
  const start = Date.now();
  while (!fn()) {
    if (Date.now() - start > ms) throw new Error("timed out");
    await new Promise((r) => setTimeout(r, 10));
  }
}

describe("a rollout: the instance holding the socket is not the one taking the writes", () => {
  it("the old instance hangs up on the room once the store has moved past its cache", async () => {
    // Seed through A, so A has the canvas cached and the tab's socket.
    await op(baseOf(a), { type: "project.create", canvasId: "prj_1", title: "Acme" }, null);
    await op(baseOf(a), {
      type: "item.add",
      itemId: "itm_1",
      version: nv("ver_1"),
      width: 100,
      height: 80,
      placement: { x: 5, y: 6 },
    });
    const tab = await connect(baseOf(a));
    await until(() => tab.messages.some((m) => m.type === "presence-roster"));
    const hello = tab.messages[0]!;
    expect(hello.type).toBe("snapshot");
    expect(hello.type === "snapshot" && hello.lastSeq).toBe(2);
    // The hello says which build answered, so a tab can tell WHICH instance
    // it is talking to across a rollout.
    expect(hello.type === "snapshot" && typeof hello.revision).toBe("string");

    // The new revision boots from the durable state and takes the writes.
    b = await startDaemon({ port: 0, home, heartbeatMs: 150 });
    for (const x of [10, 20, 30]) await op(baseOf(b), { type: "item.move", itemId: "itm_1", x, y: x });

    // A's next beat reads the store, finds its cache behind, and hangs up —
    // with the code that means "redial", not one of the door's refusals.
    const code = await Promise.race([
      tab.closed,
      new Promise<number>((_, reject) => setTimeout(() => reject(new Error("A never hung up")), 4000)),
    ]);
    expect(code).toBe(WS_BEHIND);
    // Nothing was broadcast to the old socket for those three ops: that is
    // the freeze, and it is why the hang-up is the fix rather than a nicety.
    expect(tab.messages.filter((m) => m.type === "op-applied")).toHaveLength(0);

    // A redial that lands back on A is answered from the store: the cache
    // was dropped before the room was told.
    const again = await connect(baseOf(a));
    await until(() => again.messages.some((m) => m.type === "presence-roster"));
    const rehello = again.messages[0]!;
    expect(rehello.type === "snapshot" && rehello.lastSeq).toBe(5);
    again.ws.close();
  }, 15_000);

  it("a quiet room on a current instance is left alone", async () => {
    await op(baseOf(a), { type: "project.create", canvasId: "prj_1", title: "Acme" }, null);
    const tab = await connect(baseOf(a));
    await until(() => tab.messages.some((m) => m.type === "presence-roster"));
    // Several beats with nobody writing anywhere: the tip matches the cache,
    // the socket stays up, and every beat carries the tip and the revision.
    await until(() => tab.messages.filter((m) => m.type === "heartbeat").length >= 3, 3000);
    expect(tab.ws.readyState).toBe(WebSocket.OPEN);
    for (const beat of tab.messages.filter((m) => m.type === "heartbeat")) {
      expect(beat.type === "heartbeat" && beat.tip).toBe(1);
      expect(beat.type === "heartbeat" && typeof beat.revision).toBe("string");
    }
    tab.ws.close();
  }, 15_000);
});
