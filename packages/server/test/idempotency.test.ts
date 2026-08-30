import { reservePort } from "../../../test/ports.ts";
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
  daemon = await startDaemon({ port: await reservePort(), home });
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
  canvasId: string | null,
  opId?: string,
): Promise<{ status: number; body: any }> {
  const res = await fetch(`${base}/api/ops`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...badge.headers },
    body: JSON.stringify({ canvasId, actor: priya, op, ...(opId ? { opId } : {}) }),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function log(canvasId: string): Promise<LogEntry[]> {
  const res = await fetch(`${base}/api/projects/${canvasId}/oplog`, { headers: badge.headers });
  return (await res.json()) as LogEntry[];
}

async function items(canvasId: string): Promise<string[]> {
  const res = await fetch(`${base}/api/projects/${canvasId}/canvas`, { headers: badge.headers });
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

async function makeCanvas(canvasId = "prj_1"): Promise<void> {
  const made = await post({ type: "project.create", canvasId, title: "Acme" }, null);
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

  /**
   * **The retry is not always the last thing in the log**, and the scan has to
   * go further back than one entry to know it.
   *
   * Every other case in this file posts the retry immediately after the op it
   * retries, so `alreadyWritten`'s backwards scan could be reduced to *look at
   * the most recent entry only* and the whole file stayed green. It is a real
   * shape and not a hypothetical: the tab that lost its answer is a tab whose
   * queue has several ops in it, and the seconds it waits before retrying are
   * seconds in which anybody on the canvas can write. Past the depth the scan
   * reaches, a replay is applied a second time.
   *
   * The comment on `alreadyWritten` argues for the DIRECTION of the scan —
   * backwards, because a replay is recent — and nothing there argues for a
   * depth of one. This is that argument, held as a test.
   */
  it("is still the same entry after other ops have landed on top of it", async () => {
    await makeCanvas();
    const first = await post(addAcme, "prj_1", "op_burieddeep1");
    expect(first.status).toBe(200);

    // Five more writes on the canvas, so the retry is nowhere near the tail.
    for (let n = 0; n < 5; n++) {
      const move: Operation = { type: "item.move", itemId: "itm_acme", x: n * 10, y: n * 10 };
      expect((await post(move, "prj_1", `op_between0000${n}`)).status).toBe(200);
    }
    const buried = (await log("prj_1")).length;

    const retry = await post(addAcme, "prj_1", "op_burieddeep1");
    expect(retry.status, "a buried replay must not read as a refusal").toBe(200);
    expect(retry.body.code).toBeUndefined();
    expect((retry.body as PostOpResponse).seq).toBe((first.body as PostOpResponse).seq);
    expect((retry.body as PostOpResponse).envelope).toEqual(
      (first.body as PostOpResponse).envelope,
    );
    // Nothing was appended, and the item did not double.
    expect((await log("prj_1")).length).toBe(buried);
    expect(await items("prj_1")).toEqual(["itm_acme"]);
  });

  /**
   * The same shape with the writes in between belonging to SOMEBODY ELSE,
   * which is the ordinary case rather than the exotic one: two people on a
   * canvas, one of them on a bad connection.
   */
  it("is still the same entry after another actor has written", async () => {
    await makeCanvas();
    const first = await post(addAcme, "prj_1", "op_twopeople01");
    expect(first.status).toBe(200);

    const sam = { id: "usr_sam", name: "Sam" };
    await badge.speakAs(sam, "test:usr_sam");
    const bySam = await fetch(`${base}/api/ops`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...badge.headers },
      body: JSON.stringify({
        canvasId: "prj_1",
        actor: sam,
        op: { type: "item.move", itemId: "itm_acme", x: 99, y: 99 } satisfies Operation,
        opId: "op_samsownwrit",
      }),
    });
    expect(bySam.status).toBe(200);

    const retry = await post(addAcme, "prj_1", "op_twopeople01");
    expect(retry.status).toBe(200);
    expect((retry.body as PostOpResponse).seq).toBe((first.body as PostOpResponse).seq);
    // Sam's move stands: a replay is a no-op, not a rewind.
    const canvas = await fetch(`${base}/api/projects/prj_1/canvas`, { headers: badge.headers });
    const body = (await canvas.json()) as { canvas: { items: Record<string, { x: number }> } };
    expect(body.canvas.items["itm_acme"]!.x).toBe(99);
  });

  it("covers the create, whose canvas is named in the op rather than in the request", async () => {
    const first = await post({ type: "project.create", canvasId: "prj_2", title: "Acme" }, null, "op_born0000001");
    const second = await post({ type: "project.create", canvasId: "prj_2", title: "Acme" }, null, "op_born0000001");
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
