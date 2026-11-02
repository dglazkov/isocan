// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import type { CanvasContents, Item } from "@isocan/core";
import { useCanvasStore } from "../src/stores/canvasStore.ts";
import { ItemView } from "../src/components/ItemView.tsx";

/**
 * **One item's bad render costs one item** (cleanup RP-5, 27 Sep 2026).
 *
 * Two halves. The first is the throw that was found: while the scrubber shows
 * the past, `ItemView` asked the LIVE canvas how deep a group sits, and core's
 * `groupAncestors` throws `unknown-item` for anything deleted since — so
 * scrubbing to before a deletion drew the past through a selector that could
 * not see it. The second is the one that was not found yet: nothing sat above
 * the canvas to catch a render-time throw, so any of them was a blank page.
 * The Pen was the first (28 Aug); this was the third.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const actor = { id: "usr_acme", name: "Acme" };
const stamp = { createdAt: "2026-09-27T00:00:00.000Z", createdBy: actor, updatedAt: "2026-09-27T00:00:00.000Z", updatedBy: actor };

function note(id: string, extra: Partial<Item> = {}): Item {
  return {
    id, title: `Acme ${id}`, description: "", x: 40, y: 60, width: 220, height: 140, properties: {},
    currentVersionId: `ver_${id}`,
    versions: [{ id: `ver_${id}`, blobHash: "a".repeat(64), mimeType: "text/markdown", filename: `${id}.md`, size: 1, ...stamp }],
    ...stamp, ...extra,
  } as Item;
}
const group = (id: string, extra: Partial<Item> = {}) => note(id, { properties: { kind: "group" }, width: 800, height: 600, ...extra });
const canvasOf = (items: Item[]): CanvasContents =>
  ({ items: Object.fromEntries(items.map((one) => [one.id, one])), threads: {}, trash: [] }) as unknown as CanvasContents;

afterEach(() => useCanvasStore.setState({ canvas: null, past: null }));

// A real client root, not `renderToStaticMarkup`: on the server zustand
// answers from the store's INITIAL state, so a selector reading the wrong
// canvas never meets the canvas at all and a server render is green either way.
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

/** Draw items as the viewport does, with React's own error reporting kept quiet and handed back. */
function draw(...items: Item[]): unknown[][] {
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    act(() => root.render(h(MemoryRouter, null, ...items.map((item) => h(ItemView, { key: item.id, item, canvasId: "prj_acme", actor })))));
    return errors.mock.calls;
  } finally { errors.mockRestore(); }
}
const drawn = (id: string) => host.querySelector<HTMLElement>(`[data-item-id="${id}"]`);
const unrenderable = (id: string) => host.querySelector<HTMLElement>(`[data-unrenderable-item="${id}"]`);

describe("an item drawn from the past is measured against the past", () => {
  it("a group deleted since the moment on screen still draws, at its depth then", () => {
    // Then: a sheet inside a sheet. Now: both deleted.
    const outer = group("itm_outer");
    const inner = group("itm_inner", { containerId: "itm_outer", x: 100, y: 120, width: 400, height: 300 });
    useCanvasStore.setState({ canvas: canvasOf([]), past: { seq: 7, canvas: canvasOf([outer, inner]) } });
    draw(inner);
    expect(unrenderable("itm_inner"), "the past was measured against the live canvas").toBeNull();
    // One level down in the past: groups stack by depth, the parent under the child.
    expect(drawn("itm_inner")?.style.zIndex).toBe("-9999");
  });

  it("a sheet counts the members it had then, not the ones it has now", () => {
    // Then: a sheet holding two notes. Now: the same sheet, emptied.
    const sheet = group("itm_sheet");
    const then = canvasOf([sheet, note("itm_a", { containerId: "itm_sheet" }), note("itm_b", { containerId: "itm_sheet" })]);
    useCanvasStore.setState({ canvas: canvasOf([sheet]), past: { seq: 5, canvas: then } });
    draw(sheet);
    expect(drawn("itm_sheet")?.querySelector(".group-member-count")?.textContent).toBe("2 items");
  });

  it("an ordinary note deleted since draws too", () => {
    const gone = note("itm_gone");
    useCanvasStore.setState({ canvas: canvasOf([]), past: { seq: 3, canvas: canvasOf([gone]) } });
    draw(gone);
    expect(unrenderable("itm_gone")).toBeNull();
    expect(drawn("itm_gone")).not.toBeNull();
  });
});

describe("a render that throws costs its own item, not the canvas", () => {
  it("an item that cannot be drawn keeps its box and says so; its neighbour draws", () => {
    // No versions at all: `ItemView` reads the current version on its first
    // line of layout, so this throws in render — a stand-in for any shape a
    // render meets and was not written for.
    const broken = note("itm_broken", { versions: [], x: 12, y: 34, width: 256, height: 128 });
    const fine = note("itm_fine", { x: 400 });
    useCanvasStore.setState({ canvas: canvasOf([broken, fine]), past: null });
    const reported = draw(broken, fine);
    const fallback = unrenderable("itm_broken");
    expect(fallback, "the broken item left no box behind").not.toBeNull();
    expect(fallback!.textContent).toContain("could not be drawn");
    expect([fallback!.style.left, fallback!.style.top, fallback!.style.width, fallback!.style.height]).toEqual(["12px", "34px", "256px", "128px"]);
    expect(drawn("itm_fine"), "the neighbour went down with it").not.toBeNull();
    // Caught is not swallowed: the failure is still reported, with the item named.
    expect(reported.some((args) => args.some((a) => String(a).includes("itm_broken")))).toBe(true);
  });

  it("a later version of the item gets another try", () => {
    const broken = note("itm_mend", { versions: [] });
    useCanvasStore.setState({ canvas: canvasOf([broken]), past: null });
    draw(broken);
    expect(unrenderable("itm_mend")).not.toBeNull();
    const mended = note("itm_mend");
    useCanvasStore.setState({ canvas: canvasOf([mended]) });
    draw(mended);
    expect(unrenderable("itm_mend")).toBeNull();
    expect(drawn("itm_mend")).not.toBeNull();
  });
});
