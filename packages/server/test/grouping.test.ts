import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * **One gesture, one undo.**
 *
 * Undo was per OPERATION, so a gesture that writes several — a paste of
 * eight items, a note whose words and title change together — took several
 * ⌘Z to take back, which is undoing something nobody did. The vocabulary had
 * already grown three plural ops (`items.move`, `items.delete`,
 * `items.restore`) to work around exactly this, one gesture at a time.
 *
 * `docs/research/2026-08-28-op-grouping.md` is the argument. This is the
 * behaviour.
 */

const alice = { id: "usr_alice", name: "Alice" };
const bob = { id: "usr_bob", name: "Bob" };
const CANVAS = "prj_group";

let home: string;
let daemon: Daemon;
let base: string;
let badge: TestBadge;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-group-"));
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
  await fs.rm(home, { recursive: true, force: true });
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

describe("one gesture, one undo", () => {
  it("takes back every op written under one id", async () => {
    // A paste of three: one act on somebody's screen.
    await addItem("itm_a", alice, "g1");
    await addItem("itm_b", alice, "g1");
    await addItem("itm_c", alice, "g1");
    expect(await items()).toEqual(["itm_a", "itm_b", "itm_c"]);

    expect((await undo()).status).toBe(200);
    expect(await items(), "one ⌘Z took back one op, not one gesture").toEqual([]);
  });

  it("puts the whole gesture back", async () => {
    await addItem("itm_a", alice, "g1");
    await addItem("itm_b", alice, "g1");
    await undo();
    expect(await items()).toEqual([]);

    expect((await redo()).status).toBe(200);
    expect(await items()).toEqual(["itm_a", "itm_b"]);
  });

  it("leaves an ungrouped op exactly as it was", async () => {
    // The default is a group of one, which is what every entry written
    // before this existed already is.
    await addItem("itm_a");
    await addItem("itm_b");
    expect((await undo()).status).toBe(200);
    expect(await items(), "an ungrouped undo must still take back exactly one").toEqual(["itm_a"]);
  });

  it("does not reach past the gesture into what came before it", async () => {
    // The op before the group is a different act and must survive.
    await addItem("itm_before");
    await addItem("itm_a", alice, "g1");
    await addItem("itm_b", alice, "g1");
    await undo();
    expect(await items()).toEqual(["itm_before"]);
  });

  it("is not disturbed by another actor writing inside it", async () => {
    // The risk the research names: someone else's op landing between two
    // members. Stacks are per-actor, so Bob's op is not in Alice's stack at
    // all — this asserts that the design's claim actually holds end to end.
    await addItem("itm_a", alice, "g1");
    await addItem("itm_bob", bob);
    await addItem("itm_b", alice, "g1");

    expect((await undo(alice)).status).toBe(200);
    expect(await items(), "Bob's item is not Alice's to undo").toEqual(["itm_bob"]);
  });

  it("undoes two gestures as two, not as one", async () => {
    await addItem("itm_a", alice, "g1");
    await addItem("itm_b", alice, "g1");
    await addItem("itm_c", alice, "g2");
    await addItem("itm_d", alice, "g2");

    await undo();
    expect(await items()).toEqual(["itm_a", "itm_b"]);
    await undo();
    expect(await items()).toEqual([]);
  });
});
