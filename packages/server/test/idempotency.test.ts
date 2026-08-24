import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { LogEntry, Operation, PostOpResponse } from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * **The answer that never came** — phase 10's crux, at the seam that owns it.
 *
 * A browser queue that retries is at-least-once by construction: the tab
 * posted, the network died before the answer came back, and nothing it holds
 * can tell it whether the op landed. So it asks again. Before this phase there
 * was no way for the home to know it was being asked again — `/api/ops` minted
 * the envelope id itself, and `clientId` names a CLIENT, not an op (and a
 * browser mints a fresh one on every page load, including the
 * reload-while-offline this phase exists to survive).
 *
 * **What the failure actually looks like, measured rather than assumed.** The
 * obvious fear is a second item, and it turns out the vocabulary already
 * forbids one: every op that CREATES something carries a client-minted id
 * (`item.add`'s `itemId`, `thread.create`'s `threadId`, `thread.reply`'s
 * `comment.id`) and the reducer refuses the second with `duplicate-id`. So the
 * real damage is one layer along and worse for being quiet — the replay comes
 * back as a REFUSAL, and a client doing the honest thing with a refusal (roll
 * the optimistic change back, tell the person their work was rejected) would
 * be lying about an item that is sitting in the canvas. `no key, and the
 * replay reads as a refusal` below is that failure, kept as a test so nobody
 * has to take the sentence on trust.
 *
 * The decision: a **client-minted idempotency key**, which is simply the
 * envelope id sent up instead of minted down. Sending an op twice and meaning
 * it twice become different sentences on the wire.
 */

const priya = { id: "usr_priya", name: "Priya" };

let home: string;
let daemon: Daemon;
let base: string;
let badge: TestBadge;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-idem-"));
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

async function post(
  op: Operation,
  projectId: string | null,
  opId?: string,
): Promise<{ status: number; body: any }> {
  const res = await fetch(`${base}/api/ops`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...badge.headers },
    body: JSON.stringify({ projectId, actor: priya, op, ...(opId ? { opId } : {}) }),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function log(projectId: string): Promise<LogEntry[]> {
  const res = await fetch(`${base}/api/projects/${projectId}/oplog`, { headers: badge.headers });
  return (await res.json()) as LogEntry[];
}

async function items(projectId: string): Promise<string[]> {
  const res = await fetch(`${base}/api/projects/${projectId}/canvas`, { headers: badge.headers });
  const body = (await res.json()) as { canvas: { items: Record<string, unknown> } };
  return Object.keys(body.canvas.items);
}

const version = (id: string) => ({
  id,
  blobHash: `h_${id}`,
  mimeType: "text/markdown",
  filename: `${id}.md`,
  size: 4,
});

const addAcme: Operation = {
  type: "item.add",
  itemId: "itm_acme",
  version: version("ver_1"),
  width: 200,
  height: 120,
  placement: { x: 0, y: 0 },
};

async function makeCanvas(projectId = "prj_1"): Promise<void> {
  const made = await post({ type: "project.create", projectId, title: "Acme" }, null);
  expect(made.status).toBe(200);
}

describe("an op sent twice, meant once", () => {
  it("comes back as the entry it already became — one item, one seq, one line in the log", async () => {
    await makeCanvas();
    const first = await post(addAcme, "prj_1", "op_flakyadd1");
    const second = await post(addAcme, "prj_1", "op_flakyadd1");

    expect(first.status).toBe(200);
    // Not a refusal, and not a new seq: the SAME entry, handed back.
    expect(second.status).toBe(200);
    expect((second.body as PostOpResponse).seq).toBe((first.body as PostOpResponse).seq);
    expect((second.body as PostOpResponse).envelope).toEqual(
      (first.body as PostOpResponse).envelope,
    );
    // The failure this phase is designed against.
    expect(await items("prj_1")).toEqual(["itm_acme"]);
    expect((await log("prj_1")).filter((e) => e.envelope.op.type === "item.add")).toHaveLength(1);
  });

  it("keeps the key as the envelope id, because the log is where the next retry looks", async () => {
    await makeCanvas();
    const { body } = await post(addAcme, "prj_1", "op_mineinstead");
    expect((body as PostOpResponse).envelope.id).toBe("op_mineinstead");
    const entries = await log("prj_1");
    expect(entries.at(-1)!.envelope.id).toBe("op_mineinstead");
  });

  it("does not grow the log even for an op that would have been harmless twice", async () => {
    await makeCanvas();
    await post(addAcme, "prj_1", "op_add0000001");
    const before = (await log("prj_1")).length;
    const move: Operation = { type: "item.move", itemId: "itm_acme", x: 40, y: 40 };
    const first = await post(move, "prj_1", "op_move000001");
    const second = await post(move, "prj_1", "op_move000001");
    expect((second.body as PostOpResponse).seq).toBe((first.body as PostOpResponse).seq);
    expect((await log("prj_1")).length).toBe(before + 1);
  });

  it("means THIS op, not this shape — a second key is a second write", async () => {
    await makeCanvas();
    await post(addAcme, "prj_1", "op_add0000002");
    const move: Operation = { type: "item.move", itemId: "itm_acme", x: 40, y: 40 };
    const first = await post(move, "prj_1", "op_move000002");
    const second = await post(move, "prj_1", "op_move000003");
    // Two people can drag one card to the same spot; a key is a name for one
    // gesture, never a fingerprint of its values.
    expect((second.body as PostOpResponse).seq).toBe((first.body as PostOpResponse).seq + 1);
  });

  it("covers the create, whose canvas is named in the op rather than in the request", async () => {
    const first = await post({ type: "project.create", projectId: "prj_2", title: "Acme" }, null, "op_born0000001");
    const second = await post({ type: "project.create", projectId: "prj_2", title: "Acme" }, null, "op_born0000001");
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect((second.body as PostOpResponse).seq).toBe((first.body as PostOpResponse).seq);
    expect(second.body.code).toBeUndefined();
  });
});

describe("what the key replaces", () => {
  /**
   * Kept as a test rather than a paragraph, because it is the whole reason the
   * key exists and it is the thing a future change could quietly break. A
   * replayed create-shaped op WITHOUT a key is refused — and a refusal is
   * exactly what an offline queue must treat as "the home would not take your
   * work". It never was a duplicate; it was a lie about a duplicate.
   */
  it("no key, and the replay reads as a refusal about work that landed", async () => {
    await makeCanvas();
    const first = await post(addAcme, "prj_1");
    const second = await post(addAcme, "prj_1");
    expect(first.status).toBe(200);
    expect(second.status).toBe(400);
    expect(second.body.code).toBe("duplicate-id");
    // And the item is there the whole time. That is the lie.
    expect(await items("prj_1")).toEqual(["itm_acme"]);
  });
});

describe("the key at the door", () => {
  it("is shape-checked before it can reach the oplog", async () => {
    await makeCanvas();
    const bad = await post(addAcme, "prj_1", "../../etc/passwd");
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe("bad-op");
    expect(await items("prj_1")).toEqual([]);
  });
});
