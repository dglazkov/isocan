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

/**
 * The tab's half of the lid-close beat (journey, Scene 4, beat 7).
 *
 * A reconnect used to take a fresh snapshot of the whole canvas. It now says
 * "I have through N" and applies the tail — the same handshake phase 6's home
 * connection speaks from the other end, which is the isomorphism thesis paying
 * again. What has to stay true through that change is everything this file
 * already had reasons for: the canvas must not unmount mid-resume, the gap
 * check must still be the belt to the resume's braces, and an evening's
 * comments must arrive as unread badges rather than as a burst of toasts.
 */

const priya: Actor = { id: "usr_priya", name: "Priya" };

/** A WebSocket the test can drive. `readyState`/`OPEN` are read by the store's
 * presence flush, so the stand-in has to carry them. */
class FakeSocket {
  static readonly OPEN = 1;
  static readonly CLOSED = 3;
  /** Every URL the store has opened, oldest first — the cursor is in there. */
  static opened: string[] = [];
  static live: FakeSocket[] = [];

  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  readyState = FakeSocket.OPEN;
  readonly sent: string[] = [];

  constructor(readonly url: string) {
    FakeSocket.opened.push(url);
    FakeSocket.live.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

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

let seq = 0;
function envelope(op: Operation, actor: Actor = priya): OpEnvelope {
  seq += 1;
  return {
    id: `op_${seq}`,
    projectId: op.type === "project.create" ? null : "prj_1",
    actor,
    ts: new Date(Date.UTC(2026, 7, 22) + seq * 1000).toISOString(),
    op,
  };
}

function entry(op: Operation, at: number, actor: Actor = priya): LogEntry {
  return { seq: at, envelope: envelope(op, actor), inverse: null };
}

/** A synthetic canvas: one item, nothing else. */
function seed(): ProjectState {
  const created = applyOperation(null, envelope({
    type: "project.create",
    projectId: "prj_1",
    title: "Acme Sprint Board",
  }))!;
  return applyOperation(created, envelope({
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
  }))!;
}

const store = async () => import("../src/stores/canvasStore.ts");
const unread = async () => import("../src/stores/unreadStore.ts");

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
}

/** Connect and land a snapshot at `lastSeq`, which is where every test starts:
 * a tab that already holds state for this canvas. */
async function connected(lastSeq: number): Promise<ProjectState> {
  const { connectToProject } = await store();
  const state = seed();
  connectToProject("prj_1", priya);
  FakeSocket.last.deliver({
    type: "snapshot",
    project: state.project,
    canvas: state.canvas,
    lastSeq,
    colors: {},
    names: {},
  });
  return state;
}

beforeEach(async () => {
  vi.useFakeTimers();
  FakeSocket.opened = [];
  FakeSocket.live = [];
  seq = 0;
  stubGlobals();
  vi.resetModules();
});

afterEach(async () => {
  const { disconnect } = await store();
  disconnect();
  vi.useRealTimers();
});

/** Kill the live socket and let the store's 800ms backoff bring it back. */
function reconnect(): void {
  FakeSocket.last.close();
  vi.advanceTimersByTime(900);
}

describe("reconnecting with a cursor", () => {
  it("asks for nothing on a fresh connect, and for the tail on a reconnect", async () => {
    await connected(5);
    expect(FakeSocket.opened[0]).toContain("since=0");
    reconnect();
    // "I have through 241" — the beat, in a query string.
    expect(FakeSocket.opened[1]).toContain("since=5");
  });

  it("keeps the canvas mounted through the resume", async () => {
    const { useCanvasStore } = await store();
    await connected(5);
    reconnect();
    FakeSocket.last.deliver({ type: "resumed", from: 5, lastSeq: 6, colors: {}, names: {} });
    // A fresh connect nulls `project` and `canvas`; a resume must not, or the
    // canvas unmounts for as long as the tail takes to arrive.
    const after = useCanvasStore.getState();
    expect(after.project).not.toBeNull();
    expect(after.canvas).not.toBeNull();
    expect(after.connection).toBe("live");
  });

  it("applies the tail on top of the state it kept", async () => {
    const { useCanvasStore } = await store();
    await connected(2);
    reconnect();
    FakeSocket.last.deliver({ type: "resumed", from: 2, lastSeq: 4, colors: {}, names: {} });
    FakeSocket.last.deliver({
      type: "op-applied",
      entry: entry({ type: "item.move", itemId: "itm_1", x: 10, y: 10 }, 3),
    });
    FakeSocket.last.deliver({
      type: "op-applied",
      entry: entry({ type: "item.move", itemId: "itm_1", x: 30, y: 30 }, 4),
    });
    const after = useCanvasStore.getState();
    expect(after.canvas!.items["itm_1"]!.x).toBe(30);
    expect(after.lastSeq).toBe(4);
  });

  it("takes the colors and names that changed while the lid was shut", async () => {
    const { useCanvasStore } = await store();
    await connected(2);
    reconnect();
    FakeSocket.last.deliver({
      type: "resumed",
      from: 2,
      lastSeq: 2,
      colors: { [priya.id]: "#ff8800" },
      names: { [priya.id]: "Priya Sharma" },
    });
    // Neither is in the op tail — the actor registry is home-scoped — so a
    // rename would otherwise never reach the comments written before it.
    expect(useCanvasStore.getState().actorNames[priya.id]).toBe("Priya Sharma");
    expect(useCanvasStore.getState().actorColors[priya.id]).toBe("#ff8800");
  });

  it("still resyncs on a gap — the resume's braces do not replace the belt", async () => {
    await connected(2);
    reconnect();
    const resumed = FakeSocket.last;
    resumed.deliver({ type: "resumed", from: 2, lastSeq: 5, colors: {}, names: {} });
    // A tail with a hole in it: the home said 3…5 and 4 never arrived. The
    // socket closes and the next connect starts over from what we still hold.
    resumed.deliver({
      type: "op-applied",
      entry: entry({ type: "item.move", itemId: "itm_1", x: 10, y: 10 }, 3),
    });
    resumed.deliver({
      type: "op-applied",
      entry: entry({ type: "item.move", itemId: "itm_1", x: 30, y: 30 }, 5),
    });
    expect(resumed.readyState).toBe(FakeSocket.CLOSED);
  });

  it("takes a snapshot answer to a cursored question without complaint", async () => {
    const { useCanvasStore } = await store();
    await connected(2);
    reconnect();
    // The home could not serve the tail — compacted, or it is behind us. The
    // fallback is the other half of one contract, not an error.
    const fresh = seed();
    FakeSocket.last.deliver({
      type: "snapshot",
      project: fresh.project,
      canvas: fresh.canvas,
      lastSeq: 9,
      colors: {},
      names: {},
    });
    expect(useCanvasStore.getState().lastSeq).toBe(9);
    expect(useCanvasStore.getState().connection).toBe("live");
  });

  it("asks for no tail on a canvas it holds nothing for", async () => {
    const { connectToProject } = await store();
    await connected(5);
    // Switching canvases: a cursor from the last one is a seq that means
    // something else here, and applying that canvas's tail to this one would
    // be worse than a slow reconnect.
    connectToProject("prj_2", priya);
    expect(FakeSocket.opened[FakeSocket.opened.length - 1]).toContain("since=0");
  });
});

describe("what an evening away sounds like", () => {
  it("badges the comments in a replayed tail instead of toasting them", async () => {
    const { useUnreadStore } = await unread();
    const { useCanvasStore } = await store();
    await connected(2);
    reconnect();
    FakeSocket.last.deliver({ type: "resumed", from: 2, lastSeq: 3, colors: {}, names: {} });
    FakeSocket.last.deliver({
      type: "op-applied",
      entry: entry(
        {
          type: "thread.create",
          threadId: "thr_1",
          x: 10,
          y: 10,
          anchorItemId: null,
          comment: { id: "cmt_1", body: "while you were out" },
        },
        3,
        { id: "usr_jordan", name: "Jordan" },
      ),
    });
    // Scene 4 beat 7 is explicit: unread badges and a dimmed face tell her the
    // evening, and no toast queue replays. The comment is in the canvas — so
    // the unread badge is — and no toast went up.
    expect(useCanvasStore.getState().canvas!.threads["thr_1"]).toBeDefined();
    expect(useUnreadStore.getState().notices).toEqual([]);
  });

  it("still toasts a comment that arrives after the tail is done", async () => {
    const { useUnreadStore } = await unread();
    await connected(2);
    reconnect();
    FakeSocket.last.deliver({ type: "resumed", from: 2, lastSeq: 2, colors: {}, names: {} });
    FakeSocket.last.deliver({
      type: "op-applied",
      entry: entry(
        {
          type: "thread.create",
          threadId: "thr_2",
          x: 10,
          y: 10,
          anchorItemId: null,
          comment: { id: "cmt_2", body: "arriving while you are here" },
        },
        3,
        { id: "usr_jordan", name: "Jordan" },
      ),
    });
    // Toasts are for arrival-while-here. Suppressing the tail must not
    // suppress the thing the toast is actually for.
    expect(useUnreadStore.getState().notices.map((n) => n.id)).toEqual(["cmt_2"]);
  });
});
