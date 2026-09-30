// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement as h, Profiler } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { applyOperation, type Actor, type CanvasState, type Operation, type PresenceSession, type ServerMessage } from "@isocan/core";
import { connectToCanvas, disconnect, useCanvasStore } from "../src/stores/canvasStore.ts";
import { useUiStore } from "../src/stores/uiStore.ts";
import { ItemView } from "../src/components/ItemView.tsx";

/**
 * **Somebody merely being here re-renders nothing** (cleanup RP-1 and RP-8,
 * 27 Sep 2026).
 *
 * The daemon sends a `presence-roster` up to 25 times a second while anybody's
 * cursor moves — and echoes a person's own beats back to them, so a person
 * alone gets them too. Each one carries the actor registry (colours, names,
 * joins) whether or not it changed, and the store took the fresh maps as
 * given: every `ItemView` subscribes to the colours and names, so every card
 * on the canvas re-rendered, past its `memo`, for every roster.
 *
 * Counted the only way that can say it: real `ItemView`s, each under its own
 * `Profiler`, on a store fed through its real socket handler. A static root
 * above them never re-renders, so every commit a profiler reports is that
 * item's own subscription firing.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const acme: Actor = { id: "usr_acme", name: "Acme" };
const other: Actor = { id: "usr_acme_two", name: "Acme Two" };

/** A WebSocket the test can drive (the shape `resume.test.ts` uses). */
class FakeSocket {
  static readonly OPEN = 1;
  static readonly CLOSED = 3;
  static live: FakeSocket[] = [];
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  readyState = FakeSocket.OPEN;
  readonly sent: string[] = [];
  constructor(readonly url: string) { FakeSocket.live.push(this); }
  send(data: string): void { this.sent.push(data); }
  close(): void {
    if (this.readyState === FakeSocket.CLOSED) return;
    this.readyState = FakeSocket.CLOSED;
    this.onclose?.({ code: 1000 });
  }
  /** Through JSON, as the wire does it: every message's maps are fresh objects. */
  deliver(message: ServerMessage): void { this.onmessage?.({ data: JSON.stringify(message) }); }
}

let n = 0;
const envelope = (op: Operation) => ({ id: `op_${++n}`, canvasId: op.type === "project.create" ? null : "prj_acme", actor: acme, ts: new Date(Date.UTC(2026, 8, 27) + n * 1000).toISOString(), op });

const ITEMS = 40;
function seed(): CanvasState {
  let state = applyOperation(null, envelope({ type: "project.create", canvasId: "prj_acme", title: "Acme board" }))!;
  for (let i = 0; i < ITEMS; i++) {
    state = applyOperation(state, envelope({
      type: "item.add",
      itemId: `itm_${i}`,
      version: { id: `ver_${i}`, blobHash: "a".repeat(64), mimeType: "text/markdown", filename: `acme-${i}.md`, size: 10 },
      width: 200,
      height: 150,
      placement: { x: (i % 8) * 240, y: Math.floor(i / 8) * 180 },
    }))!;
  }
  return state;
}

const colors = { [other.id]: "#c2410c" };
const names = { [other.id]: "Acme Two" };
function cursorAt(x: number): PresenceSession {
  return { sessionId: "ses_other", actor: other, kind: "web", harness: null, label: null, cursor: { x, y: 40 }, selection: [], status: null, statusSource: null, activity: null, onThread: null, lastSeen: "2026-09-27T00:00:00.000Z" };
}

let host: HTMLDivElement;
let root: Root;
let socket: FakeSocket;
let commits: Map<string, number>;
const total = () => [...commits.values()].reduce((a, b) => a + b, 0);

beforeEach(async () => {
  FakeSocket.live = [];
  (globalThis as Record<string, unknown>).WebSocket = FakeSocket;
  connectToCanvas("prj_acme", acme);
  // The store reads its replica (none, in jsdom) and flushes its queue before it dials.
  for (let i = 0; i < 8 && FakeSocket.live.length === 0; i++) await act(async () => { await Promise.resolve(); });
  socket = FakeSocket.live[FakeSocket.live.length - 1]!;
  const state = seed();
  act(() => socket.deliver({ type: "snapshot", project: state.project, canvas: state.canvas, lastSeq: 1, colors, names }));

  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  commits = new Map();
  const items = Object.values(useCanvasStore.getState().canvas!.items);
  expect(items).toHaveLength(ITEMS);
  await act(async () => {
    root.render(h(MemoryRouter, null, ...items.map((item) =>
      h(Profiler, { key: item.id, id: item.id, onRender: (id: string) => commits.set(id, (commits.get(id) ?? 0) + 1) },
        h(ItemView, { item, canvasId: "prj_acme", actor: acme })))));
  });
  commits.clear();
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  disconnect();
});

describe("a cursor stream re-renders no item", () => {
  it("rosters whose registry has not changed leave every item alone", () => {
    // Somebody else's cursor crossing the canvas: 25 rosters, the registry the same by value every time.
    for (let x = 0; x < 25; x++) act(() => socket.deliver({ type: "presence-roster", sessions: [cursorAt(x * 30)], colors, names }));
    expect(useCanvasStore.getState().sessions[0]?.cursor?.x).toBe(24 * 30);
    expect(total(), `${total()} item renders for ${ITEMS} items under 25 unchanged rosters`).toBe(0);
  });

  it("a roster that does change the registry still reaches the items that show it", () => {
    act(() => socket.deliver({ type: "presence-roster", sessions: [cursorAt(0)], colors, names }));
    const held = useCanvasStore.getState().actorColors;
    act(() => socket.deliver({ type: "presence-roster", sessions: [cursorAt(30)], colors: { [other.id]: "#1d4ed8" }, names }));
    expect(useCanvasStore.getState().actorColors).not.toBe(held);
    expect(useCanvasStore.getState().actorColors[other.id]).toBe("#1d4ed8");
    // Every item holds the whole map, so a recolour is one render each — and only one.
    expect(total()).toBe(ITEMS);
  });

  it("a person alone gets their own beats back, and they cost nothing either", () => {
    const before = useCanvasStore.getState();
    for (let i = 0; i < 10; i++) act(() => socket.deliver({ type: "presence-roster", sessions: [], colors, names }));
    const after = useCanvasStore.getState();
    expect(after.sessions).toBe(before.sessions);
    expect(after.actorColors).toBe(before.actorColors);
    expect(after.actorNames).toBe(before.actorNames);
    expect(after.actorJoins).toBe(before.actorJoins);
    expect(total()).toBe(0);
  });
});

describe("a marquee sweeping over nothing new writes no selection (RP-8)", () => {
  it("the same ids are the same selection, so nothing downstream hears of it", () => {
    let heard = 0;
    const stop = useUiStore.subscribe((s, prev) => { if (s.selectedItemIds !== prev.selectedItemIds) heard++; });
    try {
      act(() => useUiStore.getState().setSelection(["itm_1", "itm_2"]));
      expect(heard).toBe(1);
      const held = useUiStore.getState().selectedItemIds;
      // A marquee's pointermoves inside the same two items: a new array every time, the same ids.
      for (let i = 0; i < 20; i++) act(() => useUiStore.getState().setSelection(["itm_1", "itm_2"]));
      expect(useUiStore.getState().selectedItemIds).toBe(held);
      expect(heard, "each unchanged sweep published a new selection").toBe(1);
      // And it still selects live: a third item under the band is a new selection.
      act(() => useUiStore.getState().setSelection(["itm_1", "itm_2", "itm_3"]));
      expect(heard).toBe(2);
    } finally {
      stop();
      act(() => useUiStore.getState().setSelection([]));
    }
  });
});
