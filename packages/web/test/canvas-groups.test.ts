import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { Actor, CanvasState, Operation, OpEnvelope } from "@isocan/core";
import { applyOperation, groupChildren, groupContentBox, invertOperation, newOpId } from "@isocan/core";
import { useCanvasStore, sendEchoedResult } from "../src/stores/canvasStore.ts";
import { useUiStore } from "../src/stores/uiStore.ts";
import { changeCanvasGroup, createCanvasGroup, detachGroupInk, enterCanvasGroup, leaveCanvasGroup, leaveGroupAtPoint, removeFromCanvasGroup, scopedHit, selectGroupContents, PendingGroupWriteError } from "../src/lib/canvasgroups.ts";
import { canvasMenu, itemMenu } from "../src/lib/menuentries.tsx";
import { canvasGroupEntries } from "../src/lib/canvasgroupmenus.ts";
import { stageRect } from "../src/lib/stage.ts";
import { worldToScreen } from "../src/lib/viewport.ts";
import type { MenuAction, MenuEntry } from "../src/components/ContextMenu.tsx";

const actor: Actor = { id: "usr_acme", name: "Acme" };
let state: CanvasState;
let posted: Operation[];
let seq: number;
let reject = false;
let offline = false;
let envelopeNumber = 0;
const ctx = { canvasId: "prj_groups", actor, world: { x: 0, y: 0 }, navigate: vi.fn() };
function envelope(op: Operation): OpEnvelope { return { id: `op_test_${++envelopeNumber}`, canvasId: "prj_groups", actor, ts: "2026-09-12T00:00:00.000Z", op }; }
function apply(op: Operation) { state = applyOperation(state, envelope(op))!; }
function add(id: string, x: number, kind?: string) {
  apply({ type: "item.add", itemId: id, title: id, width: 180, height: 120, placement: { x, y: 160, chosen: true }, properties: kind ? { kind } : {}, version: { id: `ver_${id}`, blobHash: `hash_${id}`, filename: `${id}.md`, mimeType: "text/markdown", size: 1 } });
}
function land() { useCanvasStore.setState({ canvasId: state.project.id, project: state.project, canvas: state.canvas, confirmed: state, queue: [], refused: [], lastSeq: seq, capability: "edit" }); }
const actions = (entries: MenuEntry[]) => entries.filter((entry): entry is MenuAction => !("separator" in entry));
const action = (entries: MenuEntry[], label: string) => actions(entries).find((entry) => entry.label === label)!;
beforeEach(() => {
  posted = []; seq = 0; reject = false; offline = false;
  vi.stubGlobal("window", { innerWidth: 1280, innerHeight: 900 });
  state = applyOperation(null, envelope({ type: "project.create", canvasId: "prj_groups", title: "Acme groups", groupMode: "groups" }))!;
  add("itm_a", 80); add("itm_b", 300); add("itm_outside", 90);
  land();
  useUiStore.setState({ activeGroupId: null, groupDialog: null, selectedItemIds: [], enteredItemId: null, contextMenu: null });
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (offline) throw new TypeError("Failed to fetch");
    if (url.endsWith("/blobs")) return new Response(JSON.stringify({ blobHash: "hash_group", size: 10 }), { status: 200 });
    const request = JSON.parse(String(init?.body));
    posted.push(request.op);
    if (reject) return new Response(JSON.stringify({ error: "Acme member changed; try again", code: "group-conflict" }), { status: 409 });
    try {
      const env = { ...envelope(request.op), id: request.opId ?? newOpId() };
      state = applyOperation(state, env)!;
      return new Response(JSON.stringify({ seq: ++seq, envelope: env }), { status: 200 });
    } catch (err) { return new Response(JSON.stringify({ error: (err as Error).message, code: "bad-op" }), { status: 400 }); }
  }));
});
afterEach(() => vi.unstubAllGlobals());
async function wrap() {
  const id = await createCanvasGroup(state.project.id, actor, "Acme ideas", "Review these ideas", ["itm_a", "itm_b"], { x: 0, y: 0 });
  land(); return id;
}

describe("canvas group membership through the real web write path", () => {
  it("wraps once, preserves positions, reserves the brief, and leaves overlap unrelated", async () => {
    const before = structuredClone(state.canvas.items);
    useUiStore.getState().setViewport({ tx: 0, ty: -240, scale: 1.41 });
    const id = await wrap();
    expect(posted).toHaveLength(1);
    expect(posted[0]).toMatchObject({ type: "group.change", action: { kind: "create" } });
    expect(groupChildren(state.canvas, id).map((item) => item.id)).toEqual(["itm_a", "itm_b"]);
    expect(state.canvas.items.itm_outside!.containerId).toBeUndefined();
    expect(state.canvas.items.itm_a).toMatchObject({ x: before.itm_a!.x, y: before.itm_a!.y });
    const content = groupContentBox(state.canvas.items[id]!);
    expect(content.y).toBeLessThanOrEqual(state.canvas.items.itm_a!.y);
    expect(state.canvas.items[id]!.groupLayout?.briefHeight).toBe(120);
    const frame = state.canvas.items[id]!;
    const viewport = useUiStore.getState().viewport;
    const topLeft = worldToScreen(viewport, frame.x, frame.y);
    const bottomRight = worldToScreen(viewport, frame.x + frame.width, frame.y + frame.height);
    const stage = stageRect();
    expect(topLeft.y).toBeGreaterThanOrEqual(stage.y);
    expect(topLeft.x).toBeGreaterThanOrEqual(stage.x);
    expect(bottomRight.y).toBeLessThanOrEqual(stage.y + stage.height);
    expect(bottomRight.x).toBeLessThanOrEqual(stage.x + stage.width);
  });
  it("root click, Enter scope, explicit contents and Escape keep a single frame selection", async () => {
    const id = await wrap();
    expect(scopedHit("itm_a")).toBe(id);
    enterCanvasGroup(id);
    expect(useUiStore.getState().selectedItemIds).toEqual([]);
    expect(scopedHit("itm_a")).toBe("itm_a");
    expect(useUiStore.getState().enteredItemId).toBeNull();
    selectGroupContents(id);
    expect(useUiStore.getState().selectedItemIds).toEqual(["itm_a", "itm_b"]);
    leaveCanvasGroup();
    expect(useUiStore.getState()).toMatchObject({ activeGroupId: null, selectedItemIds: [id] });
    enterCanvasGroup(id);
    expect(scopedHit("itm_outside")).toBe("itm_outside");
    expect(useUiStore.getState().activeGroupId).toBeNull();
  });
  it("mouse and touch background exits clear the old scope before additive selection", async () => {
    const id = await wrap();
    const group = state.canvas.items[id]!;
    enterCanvasGroup(id); useUiStore.getState().select("itm_a");
    leaveGroupAtPoint({ x: group.x + 10, y: group.y + 10 });
    expect(useUiStore.getState().activeGroupId).toBe(id);
    leaveGroupAtPoint({ x: group.x + group.width + 100, y: group.y + 10 });
    expect(useUiStore.getState()).toMatchObject({ activeGroupId: null, selectedItemIds: [] });
  });
  it("remove preserves world position, re-add fits atomically, ungroup preserves children", async () => {
    const id = await wrap();
    const before = structuredClone(state.canvas.items.itm_a);
    await removeFromCanvasGroup(state.project.id, actor, ["itm_a"]); land();
    expect(state.canvas.items.itm_a).toMatchObject({ x: before!.x, y: before!.y });
    expect(state.canvas.items.itm_a!.containerId).toBeUndefined();
    await changeCanvasGroup(state.project.id, actor, { kind: "reparent", itemIds: ["itm_a"], containerId: id }); land();
    expect(state.canvas.items.itm_a!.containerId).toBe(id);
    await changeCanvasGroup(state.project.id, actor, { kind: "ungroup", itemIds: [id] }); land();
    expect(state.canvas.items[id]).toBeUndefined();
    expect(state.canvas.items.itm_a!.containerId).toBeUndefined();
    expect(state.canvas.items.itm_b).toBeDefined();
    expect(posted).toHaveLength(4);
  });
  it("ink refuses independent remove until one detach clears both properties, with undo", async () => {
    const id = await wrap();
    add("itm_ink", 100, "drawing");
    apply({ type: "group.change", action: { kind: "reparent", itemIds: ["itm_ink"], containerId: id } });
    apply({ type: "item.update", itemId: "itm_ink", patch: { properties: { annotates: "itm_a", region: "0,0,1,1" } } }); land();
    const before = structuredClone(state.canvas.items.itm_ink!);
    await expect(removeFromCanvasGroup(state.project.id, actor, ["itm_ink"])).rejects.toThrow(); land();
    const detached = { type: "item.update", itemId: "itm_ink", patch: { removeProperties: ["annotates", "region"] } } as const;
    const undo = invertOperation(state, { ...detached, patch: { removeProperties: [...detached.patch.removeProperties] } })!;
    await detachGroupInk(state.project.id, actor, before); land();
    expect(posted.at(-1)).toEqual(detached);
    expect(state.canvas.items.itm_ink).toMatchObject({ x: before.x, y: before.y, width: before.width, height: before.height, containerId: id });
    expect(state.canvas.items.itm_ink!.properties.annotates).toBeUndefined();
    expect(state.canvas.items.itm_ink!.properties.region).toBeUndefined();
    await removeFromCanvasGroup(state.project.id, actor, ["itm_ink"]); land();
    await changeCanvasGroup(state.project.id, actor, { kind: "reparent", itemIds: ["itm_ink"], containerId: id }); land();
    apply(undo);
    expect(state.canvas.items.itm_ink!.properties.annotates).toBe("itm_a");
  });
  it("server rejection does not announce creation or select a nonexistent frame", async () => {
    useUiStore.getState().select("itm_a");
    reject = true;
    await expect(createCanvasGroup(state.project.id, actor, "Acme group", "", ["itm_a"], { x: 0, y: 0 })).rejects.toThrow("Acme member changed");
    expect(useUiStore.getState().selectedItemIds).toEqual(["itm_a"]);
    expect(useCanvasStore.getState().refused).toHaveLength(1);
    expect(Object.keys(state.canvas.items)).toHaveLength(3);
  });
  it("a member deleted during the brief upload refuses the complete creation", async () => {
    const normalFetch = fetch;
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/blobs")) await held;
      return normalFetch(url, init);
    }));
    useUiStore.getState().select("itm_a");
    const creation = createCanvasGroup(state.project.id, actor, "Acme delayed", "", ["itm_a", "itm_b"], { x: 0, y: 0 });
    apply({ type: "item.delete", itemId: "itm_a" }); land();
    release();
    await expect(creation).rejects.toThrow("unknown item");
    expect(state.canvas.items.itm_b!.containerId).toBeUndefined();
    expect(Object.values(state.canvas.items).some((item) => item.properties.kind === "group")).toBe(false);
    expect(useUiStore.getState().selectedItemIds).toEqual(["itm_a"]);
  });
  it("queued edits stay pending and retain the existing durable queue semantics", async () => {
    const id = await wrap(); offline = true;
    await expect(removeFromCanvasGroup(state.project.id, actor, ["itm_a"])).rejects.toBeInstanceOf(PendingGroupWriteError);
    expect(useCanvasStore.getState().queue).toHaveLength(1);
    expect(useCanvasStore.getState().queue[0]!.inflight).toBe(false);
    expect(state.canvas.items.itm_a!.containerId).toBe(id);
  });
  it("legacy and reader mutations refuse before any upload or op", async () => {
    useCanvasStore.setState({ project: { ...state.project, groupMode: "legacy" } });
    await expect(createCanvasGroup(state.project.id, actor, "Acme", "", [], { x: 0, y: 0 })).rejects.toThrow("not enabled");
    useCanvasStore.setState({ project: state.project, capability: "read" });
    await expect(changeCanvasGroup(state.project.id, actor, { kind: "ungroup", itemIds: ["itm_a"] })).rejects.toThrow("read-only");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("actual menus preserve reader navigation and name mixed removable roots", async () => {
    const id = await wrap();
    const mixed = canvasGroupEntries([state.canvas.items.itm_a!, state.canvas.items.itm_outside!], ctx);
    expect(action(mixed, "Remove 1 member from group")).toBeDefined();
    action(mixed, "Remove 1 member from group").run();
    await vi.waitFor(() => expect(state.canvas.items.itm_a!.containerId).toBeUndefined()); land();
    useCanvasStore.setState({ capability: "read" });
    const menu = itemMenu([state.canvas.items[id]!], ctx);
    expect(actions(menu).some((entry) => entry.writes)).toBe(false);
    expect(action(menu, "Enter group")).toBeDefined();
    expect(action(menu, "Select contents")).toBeDefined();
    expect(action(menu, "Open brief")).toBeDefined();
    expect(action(menu, "Open full screen")).toBeUndefined();
    expect(action(itemMenu([state.canvas.items.itm_b!], ctx), "Open full screen")).toBeDefined();
    expect(actions(canvasMenu(ctx)).some((entry) => entry.label === "New group")).toBe(false);
  });
});
