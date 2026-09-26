// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement, Suspense } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import type { CanvasContents, Item } from "@isocan/core";
import { useCanvasStore } from "../src/stores/canvasStore.ts";
import { useRoundMarks, useVotesHiddenOn } from "../src/lib/sprint.ts";
import MarkdownBody from "../src/lib/markdown-body.tsx";
import { useItemRefRoster } from "../src/lib/itemrefs.ts";

/**
 * **One collaborator moving one item must not re-render every item.**
 *
 * Measured 26 Sep 2026 on 250 notes at 4x CPU: while somebody else dragged a
 * single item, 60 moves cost 15,455 `ItemView` renders and 15,000 markdown
 * parses — every card, every op — and frames of half a second. Two hooks every
 * `ItemView` calls (`useVotesHiddenOn`, `useRoundMarks`) subscribed to the
 * whole canvas, and so did every note's renderer. After: 60 item renders, the
 * moved one only.
 *
 * So this counts renders, the only instrument that can say it: fifty
 * components doing what an item does, and a canvas that changes somewhere
 * else. A render count is what a profile cannot give — it says a component
 * rendered, and why twice.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function item(i: number, x = i * 300): Item {
  return {
    id: `itm_${i}`, x, y: 0, width: 200, height: 150, title: `Acme ${i}`, description: "", properties: {},
    currentVersionId: `ver_${i}`,
    versions: [{ id: `ver_${i}`, blobHash: "a".repeat(64), mimeType: "text/markdown", filename: `acme-${i}.md`, size: 10, createdAt: "2026-09-26T00:00:00.000Z", createdBy: { id: "usr_acme", name: "Acme" } }],
    createdAt: "2026-09-26T00:00:00.000Z", createdBy: { id: "usr_acme", name: "Acme" },
    updatedAt: "2026-09-26T00:00:00.000Z", updatedBy: { id: "usr_acme", name: "Acme" },
  } as unknown as Item;
}
const canvasOf = (items: Item[]): CanvasContents => ({ items: Object.fromEntries(items.map((one) => [one.id, one])), threads: {}, trash: [] } as unknown as CanvasContents);

/** The reducer's own shape: a new canvas and a new items map, the moved item new, every other item the same object. */
function moveOne(canvas: CanvasContents, id: string): CanvasContents {
  const moved = { ...canvas.items[id]!, x: canvas.items[id]!.x + 7 };
  return { ...canvas, items: { ...canvas.items, [id]: moved } };
}

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("an operation somewhere else re-renders nothing here", () => {
  it("the item hooks answer from a selector, so fifty items stay still while one moves", () => {
    const items = Array.from({ length: 51 }, (_, i) => item(i));
    const renders = new Map<string, number>();
    function Card({ it }: { it: Item }) {
      useVotesHiddenOn(it);
      useRoundMarks(it);
      renders.set(it.id, (renders.get(it.id) ?? 0) + 1);
      return null;
    }
    act(() => useCanvasStore.setState({ canvas: canvasOf(items) }));
    // Fifty cards; the fifty-first is the one somebody else moves, and it has no card here.
    act(() => root.render(createElement("div", null, ...items.slice(0, 50).map((it) => createElement(Card, { key: it.id, it })))));
    const before = [...renders.values()].reduce((a, b) => a + b, 0);
    for (let n = 0; n < 10; n++) act(() => useCanvasStore.setState((s) => ({ canvas: moveOne(s.canvas!, "itm_50") })));
    const after = [...renders.values()].reduce((a, b) => a + b, 0);
    expect(after - before).toBe(0);
  });

  it("a note whose links are all external is parsed once, however the canvas changes", async () => {
    const items = [item(0), item(1)];
    // A rehype plugin runs once per parse — the cost the subscription paid.
    let parses = 0;
    const countParses = [() => () => { parses++; }];
    act(() => useCanvasStore.setState({ canvas: canvasOf(items), canvasId: "prj_acme" }));
    await act(async () => {
      root.render(createElement(MemoryRouter, null, createElement(Suspense, { fallback: null }, createElement(MarkdownBody, {
        attention: { itemId: "itm_0", versionId: "ver_0", blobHash: "a".repeat(64), active: false, flavor: "document" },
        rehypePlugins: countParses,
        children: "# Acme\n\nSee [the site](https://example.com) and [below](#acme).",
      }))));
    });
    expect(host.textContent).toContain("the site");
    const parsed = parses;
    expect(parsed).toBeGreaterThan(0);
    for (let n = 0; n < 10; n++) act(() => useCanvasStore.setState((s) => ({ canvas: moveOne(s.canvas!, "itm_1") })));
    expect(parses).toBe(parsed);
  });

  it("a note that links to a file on the canvas still follows the canvas", async () => {
    const items = [item(0), item(1)];
    let parses = 0;
    const countParses = [() => () => { parses++; }];
    act(() => useCanvasStore.setState({ canvas: canvasOf(items), canvasId: "prj_acme" }));
    await act(async () => {
      root.render(createElement(MemoryRouter, null, createElement(Suspense, { fallback: null }, createElement(MarkdownBody, {
        attention: { itemId: "itm_0", versionId: "ver_0", blobHash: "a".repeat(64), active: false, flavor: "document" },
        rehypePlugins: countParses,
        children: "See [the other note](acme-1.md).",
      }))));
    });
    const settled = parses;
    act(() => useCanvasStore.setState((s) => ({ canvas: moveOne(s.canvas!, "itm_1") })));
    // A path is resolved against the canvas, so a change to it must reach the note.
    expect(parses).toBeGreaterThan(settled);
  });
  it("the # roster keeps its names while only positions change, and not a moment longer", () => {
    const items = [item(0), item(1), item(2)];
    const seen: unknown[] = [];
    function Roster() {
      seen.push(useItemRefRoster().candidates);
      return null;
    }
    act(() => useCanvasStore.setState({ canvas: canvasOf(items) }));
    act(() => root.render(createElement(Roster)));
    for (let n = 0; n < 5; n++) act(() => useCanvasStore.setState((s) => ({ canvas: moveOne(s.canvas!, "itm_1") })));
    // Every render handed out the same list, so every chip plugin built on it held.
    expect(new Set(seen).size).toBe(1);
    act(() => useCanvasStore.setState((s) => ({ canvas: { ...s.canvas!, items: { ...s.canvas!.items, itm_2: { ...s.canvas!.items.itm_2!, title: "Acme renamed" } } } })));
    const last = seen[seen.length - 1] as { title: string }[];
    expect(new Set(seen).size).toBe(2);
    expect(last.some((c) => c.title === "Acme renamed")).toBe(true);
  });
});
