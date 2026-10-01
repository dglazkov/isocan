// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { applyOperation, resolveGroupOperation, type CanvasState, type GroupAction } from "@isocan/core";
import { aimKeys, aimNowhere, aimPointer } from "../src/lib/aim.ts";
import { frameGap } from "../src/lib/canvasgroups.ts";
import { useCanvasStore } from "../src/stores/canvasStore.ts";
import { useUiStore } from "../src/stores/uiStore.ts";

/**
 * **The hover outline is the press's answer, read from the DOM the pointer
 * is actually over** (groups-by-hand phase 2). Core's `groupAim` is tested
 * row by row in `core/test/canvas-groups.test.ts`; this file holds the web's
 * half — that a card, a frame's handle and a frame's open space each become
 * the right hit, that ⌘ under a still pointer re-aims, and that the CSS draws
 * the outline from `.hover-target`, never from `:hover`.
 */

const actor = { id: "usr_acme", name: "Acme" };
const ts = "2026-10-01T12:00:00.000Z";
let seq = 0;
const version = (id: string) => ({ id: `ver_${id}`, blobHash: `hash_${id}`, mimeType: "text/markdown", filename: `${id}.md`, size: 12 });
function add(state: CanvasState | null, op: Parameters<typeof applyOperation>[1]["op"]): CanvasState {
  return applyOperation(state, { id: `op_${++seq}`, canvasId: "can_acme", actor, ts, op })!;
}
function group(state: CanvasState, action: GroupAction): CanvasState {
  const op = resolveGroupOperation(state, { type: "group.change", action }, { actor, ts, opId: `op_${++seq}` });
  return add(state, op);
}
/** A group "g" at the canvas root holding the card "a", and a loose card. */
function canvas(): CanvasState {
  let state = add(null, { type: "project.create", canvasId: "can_acme", title: "Acme", groupMode: "groups" });
  state = add(state, { type: "item.add", itemId: "a", width: 200, height: 200, placement: { x: 100, y: 200, chosen: true }, version: version("a"), properties: {} });
  state = add(state, { type: "item.add", itemId: "loose", width: 100, height: 100, placement: { x: 2000, y: 2000, chosen: true }, version: version("loose"), properties: {} });
  return group(state, { kind: "create", group: { id: "g", title: "Acme group", version: version("g") }, itemIds: ["a"] });
}

/** The shapes ItemView renders: a card, and a frame with a title strip. */
function dom() {
  document.body.innerHTML = `
    <div class="item canvas-group pressable" data-item-id="g"><div class="area-title">Acme group</div><div class="group-grid"><span class="group-grid-cell"></span></div></div>
    <div class="item" data-item-id="a"><div class="item-content"><p>Acme</p></div></div>
    <div class="world"></div>`;
  const q = (selector: string) => document.querySelector(selector)!;
  return { frame: q('[data-item-id="g"]'), title: q(".area-title"), cell: q(".group-grid-cell"), card: q('[data-item-id="a"] p'), world: q(".world") };
}
const move = (target: Element, opts: { meta?: boolean; x?: number; y?: number } = {}) =>
  aimPointer({ clientX: opts.x ?? 0, clientY: opts.y ?? 0, target, buttons: 0, pointerType: "mouse", metaKey: !!opts.meta, ctrlKey: !!opts.meta });
const aim = () => useUiStore.getState().aim;

beforeEach(() => {
  const state = canvas();
  useCanvasStore.setState({ canvas: state.canvas, record: state.project } as never);
  useUiStore.setState({ activeGroupId: null, activeTool: "select", commentMode: false, aim: null, viewport: { tx: 0, ty: 0, scale: 1 } });
});

describe("aim, from what the pointer is over", () => {
  it("knows a frame's open space from its handles", () => {
    const { frame, title, cell, card } = dom();
    expect(frameGap(frame)).toBe("g");
    expect(frameGap(cell)).toBe("g");
    expect(frameGap(title)).toBeNull();
    expect(frameGap(card)).toBeNull();
  });
  it("at the canvas level: a member, the open space and the title all outline the group", () => {
    const { frame, title, card } = dom();
    move(card); expect(aim()?.itemId).toBe("g");
    move(frame); expect(aim()?.itemId).toBe("g");
    move(title); expect(aim()?.itemId).toBe("g");
  });
  it("with ⌘ (held either way the platform spells it): the member, inside its group; over the space, its members", () => {
    const { frame, card } = dom();
    move(card, { meta: true }); expect(aim()).toEqual({ itemId: "a", inside: "g", among: null });
    move(frame, { meta: true }); expect(aim()).toEqual({ itemId: null, inside: null, among: "g" });
  });
  it("re-aims when ⌘ goes down or up under a still pointer", () => {
    const { card } = dom();
    move(card); expect(aim()?.itemId).toBe("g");
    aimKeys({ key: "Meta", metaKey: true, ctrlKey: true }); expect(aim()?.itemId).toBe("a");
    aimKeys({ key: "Meta", metaKey: false, ctrlKey: false }); expect(aim()?.itemId).toBe("g");
  });
  it("inside the group: the member is itself, and the open space (the scope's own floor) outlines nothing", () => {
    const { card, world } = dom();
    useUiStore.setState({ activeGroupId: "g" });
    move(card); expect(aim()?.itemId).toBe("a");
    // The scope's frame is not pressable there, so the pointer reaches the
    // canvas; the frame is found by geometry, and is floor.
    move(world, { x: 90, y: 410 }); expect(aim()).toEqual({ itemId: null, inside: null, among: null });
    move(world, { x: 90, y: 410, meta: true }); expect(aim()?.among).toBe("g");
  });
  it("lets the Text tool through a frame's open space, and the Pen outlines nothing", () => {
    const { frame, card } = dom();
    useUiStore.setState({ activeTool: "text" });
    move(frame); expect(aim()).toBeNull();
    move(card); expect(aim()?.itemId).toBe("g");
    useUiStore.setState({ activeTool: "pen" });
    move(card); expect(aim()).toBeNull();
  });
  it("holds the aim through a gesture, and drops it when the pointer leaves", () => {
    const { card, frame } = dom();
    move(card);
    aimPointer({ clientX: 0, clientY: 0, target: frame, buttons: 1, pointerType: "mouse", metaKey: true, ctrlKey: true });
    expect(aim()?.itemId).toBe("g");
    aimNowhere(); expect(aim()).toBeNull();
  });
});

describe("the outline is drawn from the aim, not from :hover", () => {
  const css = readFileSync(path.join(process.cwd(), "packages/web/src/styles.css"), "utf8");
  it("has no dashed hover rule on .item:hover any more, and draws .hover-target counter-scaled", () => {
    expect(css).not.toMatch(/\.canvas-viewport:not\(\.pen\) \.item:hover\s*\{/);
    expect(css).not.toMatch(/\.item\.selected:hover/);
    const rule = css.match(/\.canvas-viewport:not\(\.pen\) \.item\.hover-target \{([^}]*)\}/)?.[1] ?? "";
    expect(rule).toMatch(/outline:\s*calc\(1px \/ var\(--scale, 1\)\) dashed var\(--accent\)/);
    expect(css).toMatch(/\.item\.reach-inside:not\(\.selected\) \{[^}]*solid/);
    expect(css).toMatch(/\.item\.reach-among:not\(\.selected\) \{[^}]*dashed/);
  });
  it("lets a pressable frame's open space take the pointer only for the Select tool", () => {
    expect(css).toMatch(/\.canvas-viewport\.own-cursor-on \.item\.canvas-group\.pressable \{ pointer-events: auto; \}/);
  });
});
