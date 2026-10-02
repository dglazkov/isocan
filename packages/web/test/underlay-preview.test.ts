// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import type { Actor, CanvasContents, Item } from "@isocan/core";
import { useCanvasStore } from "../src/stores/canvasStore.ts";
import { useUiStore } from "../src/stores/uiStore.ts";
import { ModuleUnderlays } from "../src/components/ModuleUnderlays.tsx";
import { previewedCanvas } from "../src/lib/presentation.ts";

/**
 * **A mind map's lines follow a drag on a groups canvas** (30 Sep 2026).
 *
 * Reported as "some of it doesn't catch up until I drop it": on a groups
 * canvas — every new canvas — a drag previews through `groupPreview` boxes and
 * never sets `drag`, and the underlays were handed only `drag`. The node moved
 * under the hand; its edges stayed where the node had been until the drop
 * committed. Proved in a real browser the same day; this is the same fact in
 * the shell's own wiring: render the underlays, preview a move, read the line.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const who = { id: "usr_acme", name: "Acme" };
function node(id: string, x: number, y: number, parent?: string): Item {
  return {
    id, x, y, width: 120, height: 40, title: `Acme ${id}`, description: "",
    properties: { map: "map_acme", ...(parent ? { mapParent: parent } : {}) },
    currentVersionId: `ver_${id}`,
    versions: [{ id: `ver_${id}`, blobHash: "a".repeat(64), mimeType: "text/markdown", filename: `${id}.md`, size: 10, createdAt: "2026-09-30T00:00:00.000Z", createdBy: who }],
    createdAt: "2026-09-30T00:00:00.000Z", createdBy: who, updatedAt: "2026-09-30T00:00:00.000Z", updatedBy: who,
  } as unknown as Item;
}
const canvas = { items: { root: node("root", 0, 0), leaf: node("leaf", 300, 0, "root") }, threads: {}, trash: [] } as unknown as CanvasContents;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  useCanvasStore.setState({ canvas, past: null });
  useUiStore.setState({ drag: null, groupPreview: null });
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useUiStore.setState({ drag: null, groupPreview: null });
});

const edge = () => host.querySelector(".map-edge")?.getAttribute("d") ?? "";
const start = (d: string) => d.split(" C ")[0];

describe("the underlays read the gesture in hand", () => {
  it("a group preview moves the edge of the node it moves, before the drop", () => {
    act(() => root.render(createElement(MemoryRouter, null, createElement(ModuleUnderlays, { canvasId: "prj_acme", actor: who as Actor }))));
    const before = edge();
    expect(before, "the map draws its one edge").toMatch(/^M /);

    // What `beginGroupGesture().move` stores: the root, previewed 200 down.
    act(() => useUiStore.setState({ groupPreview: { id: "op_acme", boxes: new Map([["root", { x: 0, y: 200, width: 120, height: 40 }]]) } }));
    const during = edge();
    expect(start(during), "the edge leaves the root where the hand has it").not.toBe(start(before));
    expect(during).toContain("M 120 220");

    act(() => useUiStore.setState({ groupPreview: null }));
    expect(edge(), "and returns when the gesture is dropped or cancelled").toBe(before);
  });

  it("the legacy drag still rides, so neither canvas kind regressed", () => {
    act(() => root.render(createElement(MemoryRouter, null, createElement(ModuleUnderlays, { canvasId: "prj_acme", actor: who as Actor }))));
    act(() => useUiStore.setState({ drag: { itemIds: ["root"], dx: 0, dy: 200, moved: true } as never }));
    expect(edge()).toContain("M 120 220");
  });
});

describe("previewedCanvas", () => {
  it("is the same object when nothing is live, so a still canvas costs nothing", () => {
    expect(previewedCanvas(canvas, null)).toBe(canvas);
  });

  it("lays each box over its item and leaves the rest alone", () => {
    const out = previewedCanvas(canvas, { boxes: new Map([["root", { x: 5, y: 6, width: 7, height: 8 }], ["gone", { x: 1, y: 1, width: 1, height: 1 }]]) });
    expect(out.items.root).toMatchObject({ x: 5, y: 6, width: 7, height: 8, title: "Acme root" });
    expect(out.items.leaf).toBe(canvas.items.leaf);
    expect(out.items.gone).toBeUndefined();
    expect(canvas.items.root!.x, "never the replica itself").toBe(0);
  });

  it("moves a legacy drag's items by its delta, so a module never has to ride it", () => {
    const out = previewedCanvas(canvas, { itemIds: ["leaf", "gone"], dx: 10, dy: -5 });
    expect(out.items.leaf).toMatchObject({ x: 310, y: -5, width: 120 });
    expect(out.items.root).toBe(canvas.items.root);
  });
});

describe("the underlay contract", () => {
  it("hands no `drag`: a module draws from the canvas, which already has the gesture in it", () => {
    /**
     * Every in-tree underlay (map edges, anatomy edges, four wireframe marks)
     * rode `drag` by hand, and every one of them missed the second kind of
     * gesture. The fact is gone so the next one cannot make the same mistake.
     */
    const read = (p: string) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), "utf8");
    expect(read("../../core/src/modules.ts")).not.toMatch(/^\s*drag: \{ itemIds/m);
    expect(read("../src/components/ModuleUnderlays.tsx")).toContain("previewedCanvas(presentedCanvas(canvas, presentation), gesture)");
  });
});
