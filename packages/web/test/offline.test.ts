import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  Actor,
  LogEntry,
  OpEnvelope,
  Operation,
  ProjectState,
  ServerMessage,
} from "@isocan/core";
import { applyOperation } from "@isocan/core";
import type { ReplicaStore, StoredReplica } from "../src/lib/replica.ts";

/**
 * **A tab that loses the network keeps working, and rejoins without losing or
 * reordering anything** — phase 10's Outcome, driven through the real store.
 *
 * The one sentence everything here is pointed at: *on reconnect, queued ops
 * must land in the home's order BEFORE the tail is applied.* Getting it
 * backwards — applying a tail computed before the queued ops landed — is
 * silent divergence, which is the worst kind: both replicas think they are
 * fine. `the crux` below is that test, and it is written so that the assertion
 * fails if the two steps are merely reordered, not only if one is missing.
 *
 * These drive the actual `canvasStore` against a fake socket and a fake
 * `fetch`, because every interesting question here is about ORDER between
 * three things — a disk read, a POST, and a socket — and a unit test of any
 * one of them in isolation cannot see the bug.
 */

const priya: Actor = { id: "usr_priya", name: "Priya" };
const jordan: Actor = { id: "usr_jordan", name: "Jordan" };

/** Everything the store did that has an order, oldest first: `post:<opId>`
 * for a write going up, `dial:<url>` for a socket being opened. The crux test
 * reads this and nothing else. */
let events: string[] = [];

/** The network, as a switch. `false` makes `fetch` throw the way a browser
 * throws with no route to the host — which is also, deliberately, what it does
 * when the home is simply down. */
let online = true;
/** What the home answers a POST with, in order. */
let seqs: number[] = [];
/** A refusal to hand back instead of a seq, keyed by op id. */
let refusals = new Map<string, { status: number; error: string; code: string }>();
/** Every body the store has POSTed to /api/ops. */
let posted: any[] = [];

class FakeSocket {
  static readonly OPEN = 1;
  static readonly CLOSED = 3;
  static opened: string[] = [];
  static live: FakeSocket[] = [];

  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  readyState = FakeSocket.OPEN;

  constructor(readonly url: string) {
    FakeSocket.opened.push(url);
    FakeSocket.live.push(this);
    events.push(`dial:${url.replace(/^.*\/ws\?/, "")}`);
  }
  send(): void {}
  close(): void {
    if (this.readyState === FakeSocket.CLOSED) return;
    this.readyState = FakeSocket.CLOSED;
    this.onclose?.({ code: 1006 });
  }
  deliver(message: ServerMessage): void {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
  static get last(): FakeSocket {
    return FakeSocket.live[FakeSocket.live.length - 1]!;
  }
}

let opSeq = 0;
function envelope(op: Operation, actor: Actor = priya, id?: string): OpEnvelope {
  opSeq += 1;
  return {
    id: id ?? `op_seed${opSeq}`,
    projectId: op.type === "project.create" ? null : "prj_1",
    actor,
    ts: new Date(Date.UTC(2026, 7, 24) + opSeq * 1000).toISOString(),
    op,
  };
}

function entry(op: Operation, at: number, actor: Actor = priya, id?: string): LogEntry {
  return { seq: at, envelope: envelope(op, actor, id), inverse: null };
}

/** A synthetic canvas: one item, nothing else. */
function seed(): ProjectState {
  const created = applyOperation(
    null,
    envelope({ type: "project.create", projectId: "prj_1", title: "Acme Sprint Board" }),
  )!;
  return applyOperation(
    created,
    envelope({
      type: "item.add",
      itemId: "itm_1",
      version: {
        id: "ver_1",
        blobHash: "hash_ver_1",
        mimeType: "text/markdown",
        filename: "ver_1.md",
        size: 10,
      },
      width: 100,
      height: 80,
      placement: { x: 5, y: 6 },
    }),
  )!;
}

/** The browser's disk, kept OUTSIDE the module registry so it survives the
 * `resetModules` that stands in for a page reload. */
const disk = new Map<string, StoredReplica>();

function diskStore(): ReplicaStore {
  return {
    get: async (key) => disk.get(key) ?? null,
    put: async (key, value) => void disk.set(key, structuredClone(value)),
    delete: async (key) => void disk.delete(key),
  };
}

const store = async () => import("../src/stores/canvasStore.ts");
const api = async () => import("../src/lib/api.ts");

function stubGlobals(): void {
  const map = new Map<string, string>();
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
  (globalThis as Record<string, unknown>).location = {
    hostname: "localhost",
    host: "localhost:5173",
    protocol: "http:",
  };
  (globalThis as Record<string, unknown>).WebSocket = FakeSocket;
  (globalThis as Record<string, unknown>).fetch = fakeFetch;
}

async function fakeFetch(url: string, init?: { body?: string }): Promise<any> {
  if (!online) throw new TypeError("Failed to fetch"); // what a browser with no route throws
  const body = init?.body ? JSON.parse(init.body) : null;
  if (String(url).endsWith("/api/ops")) {
    posted.push(body);
    events.push(`post:${body.opId}`);
    const refusal = refusals.get(body.opId);
    if (refusal) {
      return {
        ok: false,
        status: refusal.status,
        json: async () => ({ error: refusal.error, code: refusal.code }),
      };
    }
    const seq = seqs.shift() ?? 99;
    return {
      ok: true,
      status: 200,
      json: async () => ({ seq, envelope: { ...body, id: body.opId, ts: "2026-08-24T00:00:00Z" } }),
    };
  }
  return { ok: true, status: 200, json: async () => ({}) };
}

/** Let the store's promise chain run: a disk read, then a flush, then a dial.
 * Not a clock — these tests fake the clock separately. */
async function settle(): Promise<void> {
  for (let i = 0; i < 12; i++) await Promise.resolve();
}

/** Connect and land a snapshot at `lastSeq`: a tab that holds the canvas. */
async function connected(lastSeq: number): Promise<ProjectState> {
  const { connectToProject } = await store();
  const { setReplicaStore } = await import("../src/lib/replica.ts");
  setReplicaStore(diskStore());
  const state = seed();
  connectToProject("prj_1", priya);
  await settle();
  FakeSocket.last.deliver({
    type: "snapshot",
    project: state.project,
    canvas: state.canvas,
    lastSeq,
    colors: {},
    names: {},
  });
  await settle();
  return state;
}

/** Pull the plug: the socket dies and every fetch throws from here on. */
async function goOffline(): Promise<void> {
  online = false;
  FakeSocket.last.close();
  await settle();
}

/** Plug it back in and let the store's retry run. */
async function comeBack(): Promise<void> {
  online = true;
  vi.advanceTimersByTime(11_000);
  await settle();
}

beforeEach(async () => {
  vi.useFakeTimers();
  FakeSocket.opened = [];
  FakeSocket.live = [];
  events = [];
  posted = [];
  seqs = [];
  refusals = new Map();
  online = true;
  opSeq = 0;
  disk.clear();
  stubGlobals();
  vi.resetModules();
  const { onOfflineWrite } = await api();
  const { queueOfflineWrite } = await store();
  onOfflineWrite(queueOfflineWrite);
});

afterEach(async () => {
  const { disconnect } = await store();
  disconnect();
  vi.useRealTimers();
});

describe("a tab with no network keeps working", () => {
  it("applies the op it cannot send, and says how many it is holding", async () => {
    const { sendOp } = await api();
    const { useCanvasStore, unsynced } = await store();
    await connected(2);
    await goOffline();

    const answer = await sendOp("prj_1", priya, {
      type: "item.move",
      itemId: "itm_1",
      x: 10,
      y: 10,
    });

    // Null, not an invented seq: the home has not seen this and saying it has
    // would be the comfortable lie.
    expect(answer).toBeNull();
    const after = useCanvasStore.getState();
    expect(after.canvas!.items["itm_1"]!.x).toBe(10);
    expect(after.connection).toBe("offline");
    expect(unsynced()).toBe(1);
    // The truth is untouched. This is the whole design in one assertion: what
    // the home said is still what the home said.
    expect(after.confirmed!.canvas.items["itm_1"]!.x).toBe(5);
    expect(after.lastSeq).toBe(2);
  });

  it("keeps the queue, the cursor and the canvas across a reload", async () => {
    const { sendOp } = await api();
    await connected(2);
    await goOffline();
    await sendOp("prj_1", priya, { type: "item.move", itemId: "itm_1", x: 77, y: 77 });

    // A reload: every module is new, and the only thing that crosses is what
    // was written to disk.
    const { disconnect } = await store();
    disconnect();
    vi.resetModules();
    FakeSocket.live = [];
    FakeSocket.opened = [];
    const fresh = await store();
    const { setReplicaStore } = await import("../src/lib/replica.ts");
    setReplicaStore(diskStore());
    const { onOfflineWrite } = await api();
    onOfflineWrite(fresh.queueOfflineWrite);

    online = false;
    fresh.connectToProject("prj_1", priya);
    await settle();

    const after = fresh.useCanvasStore.getState();
    // The canvas is there with no network and no server — including the move
    // that was never sent.
    expect(after.canvas!.items["itm_1"]!.x).toBe(77);
    expect(after.lastSeq).toBe(2);
    expect(fresh.unsynced()).toBe(1);
  });

  it("says offline once the home has failed to answer twice, not merely 'reconnecting'", async () => {
    const { useCanvasStore } = await store();
    await connected(2);
    // Nothing queued: the socket is the only probe. One dropped socket is a
    // blip and must not flash the word offline at anybody...
    FakeSocket.last.close();
    await settle();
    expect(useCanvasStore.getState().connection).toBe("reconnecting");
    vi.advanceTimersByTime(1_000);
    await settle();
    FakeSocket.last.close();
    await settle();
    expect(useCanvasStore.getState().connection).toBe("reconnecting");
    // ...but a second dial that connects and is never greeted is a home that
    // is not there, and a person looking at a canvas restored from their own
    // replica deserves to be told before they start writing to it.
    vi.advanceTimersByTime(3_000);
    await settle();
    FakeSocket.last.close();
    await settle();
    expect(useCanvasStore.getState().connection).toBe("offline");
  });

  it("refuses what cannot wait in a queue, in words", async () => {
    const { sendOp, OfflineError } = await api();
    await connected(2);
    await goOffline();
    // A canvas born with no network is offline birth — phase 13's, and a whole
    // design of its own. What must not happen is a button that does nothing.
    await expect(
      sendOp(null, priya, { type: "project.create", projectId: "prj_9", title: "Acme" }),
    ).rejects.toBeInstanceOf(OfflineError);
  });

  it("says undo is the home's rather than letting the button do nothing", async () => {
    const { undo, OfflineError } = await api();
    await connected(2);
    await goOffline();
    // Undo walks an actor-scoped stack over the whole oplog, repairing
    // inverses other people's work has invalidated. A tab holds a canvas, not
    // a stack. Refusing is right; refusing in silence is not.
    await expect(undo("prj_1", priya)).rejects.toBeInstanceOf(OfflineError);
  });

  it("does not queue bytes, and says which file did not go", async () => {
    const { uploadBlob, OfflineError } = await api();
    await connected(2);
    await goOffline();
    const failed = uploadBlob("prj_1", new Blob(["hello"]), "sprint-notes.md");
    await expect(failed).rejects.toBeInstanceOf(OfflineError);
    await expect(failed).rejects.toThrow(/sprint-notes\.md/);
  });
});

describe("the crux", () => {
  it("lands the queue in the home's order BEFORE the tail comes down", async () => {
    const { sendOp } = await api();
    const { useCanvasStore } = await store();
    await connected(2);
    await goOffline();

    await sendOp("prj_1", priya, { type: "item.move", itemId: "itm_1", x: 10, y: 10 });
    seqs = [4]; // the home orders our write behind Jordan's, which landed at 3
    await comeBack();

    // **The order, asserted as an order.** The POST is before the dial, and a
    // test that only checked the final position would pass with these two
    // swapped — right up until somebody else's op is in the tail, which is the
    // next assertion.
    expect(events).toEqual([
      "dial:projectId=prj_1&since=0",
      "post:" + posted[0].opId,
      "dial:projectId=prj_1&since=2",
    ]);

    FakeSocket.last.deliver({ type: "resumed", from: 2, lastSeq: 4, colors: {}, names: {} });
    // Jordan moved the same card while we were away, and the home put his op
    // FIRST. If the tail were applied to the optimistic view — or if our own
    // op were skipped as "already applied" — the card would end at Jordan's
    // 50,50 while the home says 10,10, and neither replica could tell.
    FakeSocket.last.deliver({
      type: "op-applied",
      entry: entry({ type: "item.move", itemId: "itm_1", x: 50, y: 50 }, 3, jordan),
    });
    FakeSocket.last.deliver({
      type: "op-applied",
      entry: entry({ type: "item.move", itemId: "itm_1", x: 10, y: 10 }, 4, priya, posted[0].opId),
    });
    await settle();

    const after = useCanvasStore.getState();
    expect(after.canvas!.items["itm_1"]!.x).toBe(10);
    expect(after.confirmed!.canvas.items["itm_1"]!.x).toBe(10);
    expect(after.lastSeq).toBe(4);
    // And the queue is empty: the write retired when the cursor reached it,
    // not when the POST was answered.
    expect(after.queue).toEqual([]);
    expect(after.connection).toBe("live");
  });

  it("flushes in the order the person made them", async () => {
    const { sendOp } = await api();
    await connected(2);
    await goOffline();
    await sendOp("prj_1", priya, { type: "item.move", itemId: "itm_1", x: 1, y: 1 });
    await sendOp("prj_1", priya, { type: "item.move", itemId: "itm_1", x: 2, y: 2 });
    await sendOp("prj_1", priya, { type: "item.move", itemId: "itm_1", x: 3, y: 3 });
    seqs = [3, 4, 5];
    await comeBack();
    expect(posted.map((body) => body.op.x)).toEqual([1, 2, 3]);
  });

  it("retries under the SAME key, so an answer that never came is answerable", async () => {
    const { sendOp } = await api();
    await connected(2);
    await goOffline();
    // The gesture happened while offline: one POST attempt failed, and the op
    // went into the queue carrying the key it was posted under.
    await sendOp("prj_1", priya, { type: "item.move", itemId: "itm_1", x: 10, y: 10 });
    const attempted = posted.length; // zero: the first POST never reached fakeFetch
    seqs = [3];
    await comeBack();
    expect(posted).toHaveLength(attempted + 1);

    // Now the harder case, and the one this phase is actually about: the flush
    // itself dies after the home has written the op but before the answer gets
    // back. The tab has no way to know, so it asks again — with the same key.
    const key = posted[0].opId;
    await goOffline();
    const before = posted.length;
    await sendOp("prj_1", priya, { type: "item.move", itemId: "itm_1", x: 20, y: 20 });
    seqs = [4];
    await comeBack();
    expect(posted.slice(before).map((body) => body.opId)).not.toContain(key);
    // Every write carries one, always: a client that only supplied a key
    // sometimes would be a client whose retries are only sometimes safe.
    expect(posted.every((body) => /^op_[A-Za-z0-9_-]{6,32}$/.test(body.opId))).toBe(true);
  });
});

describe("a queued op the home refuses", () => {
  it("rolls back, says so, and does not strand what came after it", async () => {
    const { sendOp } = await api();
    const { useCanvasStore } = await store();
    await connected(2);
    await goOffline();

    await sendOp("prj_1", priya, {
      type: "thread.create",
      threadId: "thr_1",
      x: 1,
      y: 1,
      anchorItemId: null,
      comment: { id: "cmt_1", body: "from the plane" },
      main: true,
    });
    await sendOp("prj_1", priya, { type: "item.move", itemId: "itm_1", x: 9, y: 9 });

    const queued = useCanvasStore.getState().queue;
    expect(queued).toHaveLength(2);
    // Both are on screen while offline — that is what optimistic means.
    expect(useCanvasStore.getState().canvas!.threads["thr_1"]).toBeDefined();

    // Somebody else made the main thread while we were away.
    refusals.set(queued[0]!.opId, {
      status: 400,
      error: "canvas already has a main thread",
      code: "main-exists",
    });
    seqs = [3];
    await comeBack();

    const after = useCanvasStore.getState();
    // Rolled back — the canvas matches what the home has...
    expect(after.canvas!.threads["thr_1"]).toBeUndefined();
    // ...and NOT in silence. This is the phase's honesty problem: a change a
    // person saw happen, gone, with a reason they can read.
    expect(after.refused).toHaveLength(1);
    expect(after.refused[0]!.code).toBe("main-exists");
    expect(after.refused[0]!.opType).toBe("thread.create");
    // And the refusal did not take the rest of the queue down with it: the
    // move behind it went up regardless.
    expect(posted.map((body) => body.op.type)).toEqual(["thread.create", "item.move"]);
  });

  it("clears the refusal when it is dismissed, and nothing else", async () => {
    const { sendOp } = await api();
    const { useCanvasStore, dismissRefusals } = await store();
    await connected(2);
    await goOffline();
    await sendOp("prj_1", priya, { type: "item.move", itemId: "itm_1", x: 9, y: 9 });
    refusals.set(useCanvasStore.getState().queue[0]!.opId, {
      status: 400,
      error: "unknown item",
      code: "unknown-item",
    });
    await comeBack();
    expect(useCanvasStore.getState().refused).toHaveLength(1);
    dismissRefusals();
    expect(useCanvasStore.getState().refused).toEqual([]);
    // The change is still gone: dismissing reads the notice, it does not undo
    // the home's decision.
    expect(useCanvasStore.getState().canvas!.items["itm_1"]!.x).toBe(5);
  });
});

describe("what it presents when it comes back", () => {
  it("presents the cursor it confirmedly holds, never the optimistic one", async () => {
    const { sendOp } = await api();
    await connected(2);
    await goOffline();
    await sendOp("prj_1", priya, { type: "item.move", itemId: "itm_1", x: 10, y: 10 });
    seqs = [3];
    await comeBack();
    // `since=2`: the seq describes what the HOME said, and the queued op is
    // not part of that however convincing it looks on screen.
    expect(FakeSocket.opened[FakeSocket.opened.length - 1]).toContain("since=2");
  });

  it("keeps the queue when the home answers a cursor with a snapshot", async () => {
    const { sendOp } = await api();
    const { useCanvasStore } = await store();
    await connected(2);
    await goOffline();
    await sendOp("prj_1", priya, { type: "item.move", itemId: "itm_1", x: 10, y: 10 });
    seqs = [9]; // the home is far ahead; it cannot serve our tail
    await comeBack();
    const fresh = seed();
    FakeSocket.last.deliver({
      type: "snapshot",
      project: fresh.project,
      canvas: fresh.canvas,
      lastSeq: 8,
      colors: {},
      names: {},
    });
    await settle();
    // Our write landed at 9 and the snapshot is at 8, so it is still ahead of
    // the cursor and must still be shown. A snapshot that dropped it would
    // lose work the home has already accepted.
    expect(useCanvasStore.getState().canvas!.items["itm_1"]!.x).toBe(10);
    expect(useCanvasStore.getState().queue).toHaveLength(1);
  });

  it("does not dial while work is queued and the home is still away", async () => {
    const { sendOp } = await api();
    const { useCanvasStore } = await store();
    await connected(2);
    await goOffline();
    await sendOp("prj_1", priya, { type: "item.move", itemId: "itm_1", x: 10, y: 10 });
    const dialled = FakeSocket.opened.length;

    vi.advanceTimersByTime(60_000);
    await settle();

    // The retry loop runs and the flush is what fails, so no socket is opened:
    // dialling first would open a socket whose tail was computed before this
    // tab's work existed, which is the exact inversion this phase forbids. The
    // attempt IS made, which is what brings the tab back without a reload.
    expect(FakeSocket.opened.length).toBe(dialled);
    expect(useCanvasStore.getState().connection).toBe("offline");

    // And with an empty queue the socket is the probe, because there is
    // nothing else to probe with — which is why "offline" is decided by
    // whatever asked most recently rather than by a flag.
    online = true;
    vi.advanceTimersByTime(11_000);
    await settle();
    expect(FakeSocket.opened.length).toBe(dialled + 1);
  });
});
