// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { applyOperation, type Actor, type CanvasState, type Operation, type ServerMessage } from "@isocan/core";

/**
 * **An operation on the canvas does not re-render the page around it**
 * (cleanup RP-6, 27 Sep 2026).
 *
 * `CanvasSurface` — the page every canvas chrome hangs from — subscribed to the
 * whole canvas and to the actor joins for two effects: fit the camera once,
 * and write the tab's title with its unread count. Neither draws anything, but
 * a subscription re-renders its component, so every op anybody made and every
 * change to the joins rendered the toolbar, the panels, the rail and the rest
 * of the chrome again.
 *
 * Counted with a stand-in for one piece of chrome that has no subscription of
 * its own: it renders exactly when the page hands it a render. The page itself
 * is real, and so is the socket handler feeding its store.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const chrome = vi.hoisted(() => ({ renders: 0 }));
vi.mock("../src/components/ZoomControls.tsx", () => ({ ZoomControls: () => { chrome.renders++; return null; } }));
// The door asks the home where this canvas lives; here, always here.
vi.mock("../src/lib/homes.ts", () => ({ useCanvasHome: () => ({ state: "here" }) }));

const { CanvasPage } = await import("../src/pages/CanvasPage.tsx");
const { disconnect, useCanvasStore } = await import("../src/stores/canvasStore.ts");

const acme: Actor = { id: "usr_acme", name: "Acme" };

class FakeSocket {
  static readonly OPEN = 1;
  static readonly CLOSED = 3;
  static live: FakeSocket[] = [];
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  readyState = FakeSocket.OPEN;
  constructor(readonly url: string) { FakeSocket.live.push(this); }
  send(): void {}
  close(): void {
    if (this.readyState === FakeSocket.CLOSED) return;
    this.readyState = FakeSocket.CLOSED;
    this.onclose?.({ code: 1000 });
  }
  deliver(message: ServerMessage): void { this.onmessage?.({ data: JSON.stringify(message) }); }
}

let n = 0;
const envelope = (op: Operation) => ({ id: `op_${++n}`, canvasId: op.type === "project.create" ? null : "prj_acme", actor: acme, ts: new Date(Date.UTC(2026, 8, 27) + n * 1000).toISOString(), op });
function seed(): CanvasState {
  let state = applyOperation(null, envelope({ type: "project.create", canvasId: "prj_acme", title: "Acme board" }))!;
  for (let i = 0; i < 3; i++) {
    state = applyOperation(state, envelope({
      type: "item.add", itemId: `itm_${i}`,
      version: { id: `ver_${i}`, blobHash: "a".repeat(64), mimeType: "text/markdown", filename: `acme-${i}.md`, size: 10 },
      width: 200, height: 150, placement: { x: i * 240, y: 0 },
    }))!;
  }
  return state;
}

let host: HTMLDivElement;
let root: Root;
let socket: FakeSocket;
beforeEach(async () => {
  FakeSocket.live = [];
  (globalThis as Record<string, unknown>).WebSocket = FakeSocket;
  (globalThis as Record<string, unknown>).fetch = () => new Promise(() => {});
  // jsdom has no media queries; a wide desk, so the page is the desktop one.
  window.matchMedia = ((query: string) => ({ matches: false, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false })) as typeof window.matchMedia;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root.render(h(MemoryRouter, { initialEntries: ["/p/prj_acme"] }, h(Routes, null, h(Route, { path: "/p/:canvasId", element: h(CanvasPage, { actor: acme, onIdentity: () => {} }) })))));
  for (let i = 0; i < 8 && FakeSocket.live.length === 0; i++) await act(async () => { await Promise.resolve(); });
  socket = FakeSocket.live[FakeSocket.live.length - 1]!;
  const state = seed();
  await act(async () => socket.deliver({ type: "snapshot", project: state.project, canvas: state.canvas, lastSeq: 4, colors: {}, names: {} }));
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  disconnect();
});

describe("the page around the canvas", () => {
  it("does not render again when somebody moves an item or a join lands", async () => {
    expect(useCanvasStore.getState().canvas?.items.itm_2).toBeDefined();
    expect(document.title).toContain("Acme board");
    const before = chrome.renders;
    for (let i = 0; i < 10; i++) {
      await act(async () => socket.deliver({ type: "op-applied", entry: { seq: 5 + i, envelope: envelope({ type: "item.move", itemId: "itm_2", x: 500 + i * 7, y: 0 }), inverse: null } } as ServerMessage));
    }
    expect(useCanvasStore.getState().canvas?.items.itm_2?.x).toBe(563);
    await act(async () => socket.deliver({ type: "presence-roster", sessions: [], colors: {}, names: {}, joined: { usr_acme_old: "usr_acme" } }));
    expect(useCanvasStore.getState().actorJoins).toEqual({ usr_acme_old: "usr_acme" });
    expect(chrome.renders - before, "the page's chrome rendered again for an op or a join").toBe(0);
  });
});
