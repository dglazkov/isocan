// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement as h, Suspense } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import type { CanvasContents, Item, PresenceSession } from "@isocan/core";

/**
 * **The Chat parses a message once** (cleanup RP-2, re-measured 27 Sep 2026).
 *
 * Every message in the Chat is markdown, and react-markdown parses on every
 * render; `Markdown` is memoised (`cb9308c1`), so a message re-parses only when
 * its words or its chip plugin change. The plugin is built from the `@` roster
 * — and that roster was memoised on the whole canvas and the whole session
 * list, so every operation anybody made and every beat of anybody's cursor
 * handed every message a new plugin and parsed the whole conversation again.
 *
 * Counted on the real Chat: the chip plugin's transformer runs once per parse,
 * so a stand-in that wraps the real one counts parses without changing them.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const parses = vi.hoisted(() => ({ n: 0 }));
vi.mock("../src/lib/chips.ts", async (importOriginal) => {
  const real = await importOriginal<typeof import("../src/lib/chips.ts")>();
  return {
    ...real,
    rehypeChips: (...args: Parameters<typeof real.rehypeChips>) => {
      const attacher = real.rehypeChips(...args);
      return function counted(this: unknown) {
        const transform = (attacher as (this: unknown) => ((tree: unknown) => void) | undefined).call(this);
        return (tree: unknown) => { parses.n++; transform?.(tree); };
      };
    },
  };
});

const { useCanvasStore } = await import("../src/stores/canvasStore.ts");
const { MainThreadBody } = await import("../src/components/MainThreadPanel.tsx");

const acme = { id: "usr_acme", name: "Acme" };
const other = { id: "usr_acme_two", name: "Acme Two" };
const at = "2026-09-27T00:00:00.000Z";
function note(i: number): Item {
  return {
    id: `itm_${i}`, x: i * 300, y: 0, width: 200, height: 150, title: `Acme ${i}`, description: "", properties: {},
    currentVersionId: `ver_${i}`,
    versions: [{ id: `ver_${i}`, blobHash: "a".repeat(64), mimeType: "text/markdown", filename: `acme-${i}.md`, size: 1, createdAt: at, createdBy: acme }],
    createdAt: at, createdBy: acme, updatedAt: at, updatedBy: acme,
  } as unknown as Item;
}
const MESSAGES = 12;
function board(): CanvasContents {
  const comments = Array.from({ length: MESSAGES }, (_, i) => ({ id: `cmt_${i}`, author: i % 2 ? other : acme, body: `Message ${i} about **Acme ${i % 3}**, for @Acme Two`, createdAt: at }));
  return {
    items: Object.fromEntries([0, 1, 2].map((i) => [`itm_${i}`, note(i)])),
    threads: { thr_main: { id: "thr_main", x: 0, y: 0, anchorItemId: null, comments, main: true, createdAt: at, createdBy: acme } },
    trash: [],
  } as unknown as CanvasContents;
}
const moveOne = (canvas: CanvasContents): CanvasContents => ({ ...canvas, items: { ...canvas.items, itm_2: { ...canvas.items.itm_2!, x: canvas.items.itm_2!.x + 7 } } });
function cursorAt(x: number): PresenceSession {
  return { sessionId: "ses_other", actor: other, kind: "web", harness: null, label: null, cursor: { x, y: 40 }, selection: [], status: null, statusSource: null, activity: null, onThread: null, lastSeen: at };
}

let host: HTMLDivElement;
let root: Root;
beforeEach(async () => {
  (globalThis as Record<string, unknown>).fetch = () => new Promise(() => {});
  useCanvasStore.setState({ canvasId: "prj_acme", canvas: board(), sessions: [cursorAt(0)] });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root.render(h(MemoryRouter, null, h(Suspense, { fallback: null }, h(MainThreadBody, { canvasId: "prj_acme", actor: acme })))));
  // The markdown chunk is lazy: let it land and the messages parse.
  for (let i = 0; i < 20 && parses.n < MESSAGES; i++) await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useCanvasStore.setState({ canvas: null, sessions: [] });
});

describe("the Chat, while things happen around it", () => {
  it("parses each message once, then not again for typing, operations or cursors", async () => {
    expect(host.textContent).toContain("Message 11");
    expect(parses.n).toBeGreaterThanOrEqual(MESSAGES);
    const typing = parses.n;
    // Typed the way a browser types: the textarea's value, then its input event.
    const field = host.querySelector("textarea")!;
    const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
    for (const next of ["h", "he", "hel", "hell", "hello"]) {
      await act(async () => { setValue.call(field, next); field.dispatchEvent(new Event("input", { bubbles: true })); });
    }
    expect(field.value).toBe("hello");
    expect.soft(parses.n - typing, "a keystroke re-parsed the conversation").toBe(0);
    const ops = parses.n;
    for (let i = 0; i < 5; i++) await act(async () => useCanvasStore.setState((s) => ({ canvas: moveOne(s.canvas!) })));
    expect.soft(parses.n - ops, "an operation elsewhere re-parsed the conversation").toBe(0);
    const cursors = parses.n;
    for (let i = 1; i <= 5; i++) await act(async () => useCanvasStore.setState({ sessions: [cursorAt(i * 30)] }));
    expect.soft(parses.n - cursors, "a cursor moving re-parsed the conversation").toBe(0);
  });
});
