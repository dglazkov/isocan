// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import type { CanvasContents, Item } from "@isocan/core";

/**
 * **A pan frame is a transform, not a re-render** (cleanup RP-9, 27 Sep 2026).
 *
 * `CanvasViewport` subscribed to the viewport for the two styles that follow
 * the camera — the grid under everything and the world's transform — so every
 * pan and zoom frame re-rendered the whole viewport: every item re-sorted, with
 * `groupAncestors` walked inside the comparator, 250 memoised `ItemView`s
 * compared, and each layer that reads no viewport at all (the ink, the text
 * composer, the module underlays, the sketch bar) rendered again for nothing.
 *
 * Counted on the real viewport: the sort's `groupAncestors` calls, through a
 * spy on core, and the ink layer's renders, through a stand-in that counts —
 * a stand-in rather than the real one, because what is under test is whether
 * the PARENT hands it a new render, which the stand-in sees exactly.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const walks = vi.hoisted(() => ({ n: 0 }));
vi.mock("@isocan/core", async (importOriginal) => {
  const core = await importOriginal<typeof import("@isocan/core")>();
  return { ...core, groupAncestors: (...args: Parameters<typeof core.groupAncestors>) => { walks.n++; return core.groupAncestors(...args); } };
});
const inkRenders = vi.hoisted(() => ({ n: 0 }));
vi.mock("../src/components/InkLayer.tsx", () => ({
  InkLayer: () => { inkRenders.n++; return null; },
  SketchBar: () => null,
}));

const { useCanvasStore } = await import("../src/stores/canvasStore.ts");
const { useUiStore } = await import("../src/stores/uiStore.ts");
const { CanvasViewport } = await import("../src/components/CanvasViewport.tsx");

const actor = { id: "usr_acme", name: "Acme" };
const stamp = { createdAt: "2026-09-27T00:00:00.000Z", createdBy: actor, updatedAt: "2026-09-27T00:00:00.000Z", updatedBy: actor };
function note(id: string, extra: Partial<Item> = {}): Item {
  return {
    id, title: `Acme ${id}`, description: "", x: 0, y: 0, width: 200, height: 150, properties: {},
    currentVersionId: `ver_${id}`,
    versions: [{ id: `ver_${id}`, blobHash: "a".repeat(64), mimeType: "text/markdown", filename: `${id}.md`, size: 1, ...stamp }],
    ...stamp, ...extra,
  } as Item;
}
const group = (id: string, extra: Partial<Item> = {}) => note(id, { properties: { kind: "group" }, width: 900, height: 700, ...extra });

/** Six sheets, each holding a sheet, and forty notes: enough groups that a sort compares groups with groups. */
function board(): CanvasContents {
  const items: Item[] = [];
  for (let g = 0; g < 6; g++) {
    items.push(group(`itm_outer${g}`, { x: g * 1000 }));
    items.push(group(`itm_inner${g}`, { x: g * 1000 + 50, y: 50, width: 400, height: 300, containerId: `itm_outer${g}` }));
  }
  for (let i = 0; i < 40; i++) items.push(note(`itm_${i}`, { x: (i % 10) * 250, y: 800 + Math.floor(i / 10) * 200 }));
  return { items: Object.fromEntries(items.map((one) => [one.id, one])), threads: {}, trash: [] } as unknown as CanvasContents;
}

let host: HTMLDivElement;
let root: Root;
beforeEach(async () => {
  useCanvasStore.setState({ canvas: board(), canvasId: "prj_acme" });
  useUiStore.setState({ viewport: { tx: 0, ty: 0, scale: 1 } });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  // Async, so the notes' lazily loaded bodies land inside the act rather than after it.
  await act(async () => root.render(h(MemoryRouter, null, h(CanvasViewport, { canvasId: "prj_acme", actor }))));
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useCanvasStore.setState({ canvas: null });
});

describe("panning the canvas", () => {
  it("moves the camera without re-sorting the items or re-rendering the layers that read no viewport", () => {
    expect(host.querySelectorAll("[data-item-id]").length).toBe(52);
    walks.n = 0;
    inkRenders.n = 0;
    for (let i = 1; i <= 30; i++) act(() => useUiStore.getState().setViewport({ tx: i * 11, ty: -i * 7, scale: 1 }));
    expect.soft(walks.n, "the sort walked group ancestry on a pan frame").toBe(0);
    expect.soft(inkRenders.n, "the ink layer re-rendered on a pan frame").toBe(0);
    // And the camera did move: the world and the grid under it follow the viewport.
    const world = host.querySelector<HTMLElement>(".world")!;
    expect(world.style.transform).toBe("translate(330px, -210px) scale(1)");
    const ground = host.querySelector<HTMLElement>(".canvas-viewport")!;
    expect(ground.style.backgroundPosition).toBe("330px -210px");
  });

  it("still paints sheets under what sits on them, the outer sheet under the inner", () => {
    const order = [...host.querySelectorAll("[data-item-id]")].map((el) => el.getAttribute("data-item-id"));
    // Groups first, shallower groups before deeper ones, then everything else in the order it came.
    expect(order.slice(0, 12).every((id) => id!.startsWith("itm_outer") || id!.startsWith("itm_inner"))).toBe(true);
    for (let g = 0; g < 6; g++) expect(order.indexOf(`itm_outer${g}`)).toBeLessThan(order.indexOf(`itm_inner${g}`));
    expect(order.slice(12)).toEqual(Array.from({ length: 40 }, (_, i) => `itm_${i}`));
  });
});
