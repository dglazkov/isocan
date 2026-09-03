import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Actor, CanvasState, OpEnvelope, ServerMessage } from "@isocan/core";
import { applyOperation, WITHDRAWN, WS_NOT_ADMITTED } from "@isocan/core";
import type { ReplicaStore } from "../src/lib/replica.ts";

/**
 * **A rung change reaches the open tab, and an expulsion says the right
 * sentence** (roles design, "Reaching an open socket"; phase 2).
 *
 * Driven through the real store against a fake socket, like `offline.test.ts`:
 * the `standing` message sets `capability`, which is what `CanvasPage` picks
 * its surface from, so the toolbar appears with no reload; a close with
 * `WS_NOT_ADMITTED` and the reason `withdrawn` lands on `withdrawn` rather
 * than `refused`, because the person was inside and the difference is the
 * whole message. The sentence itself is checked in the page's source, the
 * way `readonly.test.ts` checks the gates.
 */

const priya: Actor = { id: "usr_priya", name: "Priya" };

class FakeSocket {
  static readonly OPEN = 1;
  static readonly CLOSED = 3;
  static live: FakeSocket[] = [];
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number; reason?: string }) => void) | null = null;
  readyState = FakeSocket.OPEN;
  constructor(readonly url: string) {
    FakeSocket.live.push(this);
  }
  send(): void {}
  close(): void {
    if (this.readyState === FakeSocket.CLOSED) return;
    this.readyState = FakeSocket.CLOSED;
    this.onclose?.({ code: 1006 });
  }
  /** The home hangs up with a code and a reason. */
  hangUp(code: number, reason?: string): void {
    this.readyState = FakeSocket.CLOSED;
    this.onclose?.({ code, ...(reason !== undefined ? { reason } : {}) });
  }
  deliver(message: ServerMessage): void {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
  static get last(): FakeSocket {
    return FakeSocket.live[FakeSocket.live.length - 1]!;
  }
}

function envelope(op: Parameters<typeof applyOperation>[1]["op"]): OpEnvelope {
  return {
    id: `op_${Math.random().toString(36).slice(2)}`,
    canvasId: op.type === "project.create" ? null : "prj_1",
    actor: priya,
    ts: new Date(Date.UTC(2026, 8, 2)).toISOString(),
    op,
  };
}

function seed(): CanvasState {
  return applyOperation(
    null,
    envelope({ type: "project.create", canvasId: "prj_1", title: "Acme Sprint Board" }),
  )!;
}

const disk = new Map<string, unknown>();
const diskStore = (): ReplicaStore => ({
  get: async (key) => (disk.get(key) as never) ?? null,
  put: async (key, value) => void disk.set(key, value),
  delete: async (key) => void disk.delete(key),
});

const store = async () => import("../src/stores/canvasStore.ts");

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
  (globalThis as Record<string, unknown>).fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({}),
  });
}

async function settle(): Promise<void> {
  for (let i = 0; i < 12; i++) await Promise.resolve();
}

async function connected(capability?: "view" | "read" | "edit" | "own"): Promise<void> {
  const { connectToCanvas } = await store();
  const { setReplicaStore } = await import("../src/lib/replica.ts");
  setReplicaStore(diskStore());
  const state = seed();
  connectToCanvas("prj_1", priya);
  await settle();
  FakeSocket.last.deliver({
    type: "snapshot",
    project: state.project,
    canvas: state.canvas,
    lastSeq: 1,
    colors: {},
    names: {},
    ...(capability ? { capability } : {}),
  });
  await settle();
}

beforeEach(() => {
  vi.useFakeTimers();
  FakeSocket.live = [];
  disk.clear();
  stubGlobals();
  vi.resetModules();
});

afterEach(async () => {
  const { disconnect } = await store();
  disconnect();
  vi.useRealTimers();
});

describe("the standing message", () => {
  it("sets the rung the page picks its surface from, on the same connection", async () => {
    const { useCanvasStore } = await store();
    await connected("read");
    expect(useCanvasStore.getState().capability).toBe("read");
    const socket = FakeSocket.last;

    socket.deliver({ type: "standing", capability: "edit" });
    expect(useCanvasStore.getState().capability).toBe("edit");
    // No reconnect, no reload: the socket is the same one.
    expect(FakeSocket.live).toHaveLength(1);
    expect(useCanvasStore.getState().connection).toBe("live");

    socket.deliver({ type: "standing", capability: "own" });
    expect(useCanvasStore.getState().capability).toBe("own");
    socket.deliver({ type: "standing", capability: "view" });
    expect(useCanvasStore.getState().capability).toBe("view");
  });
});

describe("withdrawn", () => {
  it("lands on `withdrawn` for a not-admitted close that says so, and `refused` for one that does not", async () => {
    const { useCanvasStore } = await store();
    await connected();
    FakeSocket.last.hangUp(WS_NOT_ADMITTED, WITHDRAWN);
    await settle();
    expect(useCanvasStore.getState().connection).toBe("withdrawn");
    // Final: nothing redials a door that just said no.
    vi.advanceTimersByTime(30_000);
    expect(FakeSocket.live).toHaveLength(1);

    await connected();
    FakeSocket.last.hangUp(WS_NOT_ADMITTED);
    await settle();
    expect(useCanvasStore.getState().connection).toBe("refused");
  });

  it("renders its own sentence on both surfaces", () => {
    const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
    const page = read("../src/pages/CanvasPage.tsx");
    expect(page).toContain('withdrawn: {\n      note: "Your access to this canvas was withdrawn."');
    expect(page).toContain('note: "This canvas will not have you."');
    const viewer = read("../src/components/Viewer.tsx");
    expect(viewer).toContain('connection === "withdrawn"');
    expect(viewer).toContain("Your access to this canvas was withdrawn.");
  });
});
