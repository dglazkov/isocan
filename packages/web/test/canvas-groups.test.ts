import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { Actor, CanvasState, Operation, OpEnvelope } from "@isocan/core";
import { applyOperation, groupChildren, groupContentBox, groupDropTarget, groupResizeBox, invertOperation, newOpId, resolveCanvasGroupRequest } from "@isocan/core";
import { useCanvasStore, sendEchoedResult } from "../src/stores/canvasStore.ts";
import { useUiStore } from "../src/stores/uiStore.ts";
import { changeCanvasGroup, createCanvasGroup, detachGroupInk, enterCanvasGroup, leaveCanvasGroup, leaveGroupAtPoint, removeFromCanvasGroup, scopedHit, selectGroupContents, PendingGroupWriteError } from "../src/lib/canvasgroups.ts";
import { canvasMenu, itemMenu } from "../src/lib/menuentries.tsx";
import { canvasGroupEntries } from "../src/lib/canvasgroupmenus.ts";
import { stageRect } from "../src/lib/stage.ts";
import { worldToScreen } from "../src/lib/viewport.ts";
import type { MenuAction, MenuEntry } from "../src/components/ContextMenu.tsx";
import { beginGroupGesture, createGroupNudger } from "../src/lib/groupgestures.ts";
import { addTextNode } from "../src/lib/text.ts";
import { addAreaItem, addBrowserItem, addDocumentItem, addDrawing, addFiles } from "../src/lib/upload.ts";
import { creationDestination, selectCreatedItems } from "../src/lib/groupplacement.ts";
import { saveGroupBrief } from "../src/lib/canvasgroups.ts";
import { webHostFor } from "../src/lib/modulehost.ts";
import { pasteInto } from "../src/lib/clipboard.ts";
import { foldQueue, retire } from "../src/lib/writequeue.ts";
import { addSpeakerNote } from "../src/lib/notes.ts";
import { flushReplicaWrites, setReplicaStore, type StoredReplica } from "../src/lib/replica.ts";

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
  useCanvasStore.setState({ past: null });
  useUiStore.setState({ activeGroupId: null, groupDialog: null, selectedItemIds: [], enteredItemId: null, contextMenu: null, groupPreview: null, groupDropTargetId: null });
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (offline) throw new TypeError("Failed to fetch");
    if (url.endsWith("/blobs")) return new Response(JSON.stringify({ blobHash: "hash_group", size: 10 }), { status: 200 });
    const request = JSON.parse(String(init?.body));
    posted.push(request.op);
    if (reject) return new Response(JSON.stringify({ error: "Acme member changed; try again", code: "group-conflict" }), { status: 409 });
    try {
      const env = { ...envelope(request.op), id: request.opId ?? newOpId() };
      env.op = resolveCanvasGroupRequest(state, env.op, { actor: env.actor, ts: env.ts, opId: env.id });
      state = applyOperation(state, env)!;
      return new Response(JSON.stringify({ seq: ++seq, envelope: env }), { status: 200 });
    } catch (err) { return new Response(JSON.stringify({ error: (err as Error).message, code: "bad-op" }), { status: 400 }); }
  }));
});

describe("group gesture production previews and commits", () => {
  it("moves a group and selected child once, deriving every preview from the captured start", async () => {
    const id = await wrap(); posted = [];
    const before = state.canvas.items.itm_a!;
    const gesture = beginGroupGesture([id, "itm_a"])!;
    gesture.move(20, 10); gesture.move(45, 25);
    expect(useUiStore.getState().groupPreview!.boxes.get("itm_a")).toMatchObject({ x: before.x + 45, y: before.y + 25 });
    expect(state.canvas.items.itm_a).toEqual(before);
    expect(await gesture.commit(state.project.id, actor)).toBe(true);
    expect(posted).toHaveLength(1);
    expect(state.canvas.items.itm_a).toMatchObject({ x: before.x + 45, y: before.y + 25 });
    expect(useUiStore.getState().groupPreview).toBeNull();
    expect(useCanvasStore.getState().canvas?.items.itm_a).toMatchObject({ x: before.x + 45 });
  });
  it.each(["nw", "ne", "sw", "se"] as const)("resizes at fixed %s in one operation with preview identical to committed boxes", async (anchor) => {
    const id = await wrap(); posted = [];
    const original = state.canvas.items[id]!;
    const gesture = beginGroupGesture([id])!;
    gesture.resize(id, original.width * 1.25, original.height * 1.25, anchor, true);
    const preview = new Map(useUiStore.getState().groupPreview!.boxes);
    expect(preview.get(id)).toMatchObject(groupResizeBox(original, { width: original.width * 1.25, height: original.height * 1.25 }, anchor));
    expect(preview.get("itm_a")!.width).toBeGreaterThan(state.canvas.items.itm_a!.width);
    expect(await gesture.commit(state.project.id, actor)).toBe(true);
    expect(posted).toHaveLength(1);
    for (const [itemId, box] of preview) expect(state.canvas.items[itemId]).toMatchObject(box);
  });
  it("cancels without a write and cannot resurrect a cancelled preview", async () => {
    const id = await wrap(); posted = [];
    const before = structuredClone(state.canvas);
    const gesture = beginGroupGesture([id])!;
    gesture.move(200, 100); gesture.cancel(); gesture.move(300, 300);
    expect(await gesture.commit(state.project.id, actor)).toBe(false);
    expect(posted).toEqual([]); expect(state.canvas).toEqual(before);
    expect(useUiStore.getState().groupPreview).toBeNull();
  });
  it("preserves an unrelated text edit but refuses changed geometry and clears the preview", async () => {
    const id = await wrap(); posted = [];
    const first = beginGroupGesture([id])!; first.move(20, 10);
    apply({ type: "item.update", itemId: "itm_a", patch: { title: "Acme revised wording" } }); land();
    expect(await first.commit(state.project.id, actor)).toBe(true); land();
    expect(state.canvas.items.itm_a!.title).toBe("Acme revised wording");
    const second = beginGroupGesture([id])!; second.move(20, 10);
    const before = state.canvas.items.itm_a!;
    const op = { type: "item.move", itemId: "itm_a", x: before.x + 1, y: before.y } as const;
    apply(resolveCanvasGroupRequest(state, op, { actor, ts: "2026-09-12T01:00:00Z", opId: "op_remote" })); land();
    const afterRemote = structuredClone(state.canvas);
    expect(await second.commit(state.project.id, actor)).toBe(false);
    expect(state.canvas).toEqual(afterRemote);
    expect(useUiStore.getState().groupPreview).toBeNull();
  });
  it("keeps an outside member in its parent and combines deliberate transfer with movement", async () => {
    const id = await wrap();
    const gesture = beginGroupGesture(["itm_a"])!; gesture.move(-300, 0);
    await gesture.commit(state.project.id, actor); land();
    expect(state.canvas.items.itm_a!.containerId).toBe(id);
    expect(groupContentBox(state.canvas.items[id]!).x).toBeLessThanOrEqual(state.canvas.items.itm_a!.x);
    const destination = await createCanvasGroup(state.project.id, actor, "Acme destination", "", [], { x: 900, y: 500 }); land(); posted = [];
    const other = state.canvas.items[destination]!;
    expect(groupDropTarget(state.canvas, { x: other.x + 50, y: other.y + 100 }, ["itm_a"])?.id).toBe(destination);
    expect(groupDropTarget(state.canvas, { x: other.x + 50, y: other.y + 100 }, [destination])).toBeNull();
    const transfer = beginGroupGesture(["itm_a"])!; transfer.move(1200, 450, destination);
    const preview = new Map(useUiStore.getState().groupPreview!.boxes);
    expect(await transfer.commit(state.project.id, actor)).toBe(true);
    expect(posted).toHaveLength(1);
    expect(state.canvas.items.itm_a!.containerId).toBe(destination);
    for (const [itemId, box] of preview) expect(state.canvas.items[itemId]).toMatchObject(box);
  });
  it("an older delayed receipt cannot clear a newer gesture's feedback", async () => {
    const id = await wrap();
    const normalFetch = fetch;
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => { const response = await normalFetch(url, init); await held; return response; });
    const first = beginGroupGesture([id])!; first.move(10, 0);
    const commit = first.commit(state.project.id, actor);
    await vi.waitFor(() => expect(state.canvas.items[id]!.x).toBe(first.start.canvas.items[id]!.x + 10));
    const second = beginGroupGesture([id])!; second.move(40, 0);
    useUiStore.getState().setGroupDropTarget(id);
    const preview = useUiStore.getState().groupPreview;
    release(); expect(await commit).toBe(true);
    expect(useUiStore.getState().groupPreview).toBe(preview);
    expect(useUiStore.getState().groupDropTargetId).toBe(id);
    second.cancel();
  });
  it("a drop destination first visited after a remote move still uses the gesture's captured revision", async () => {
    await wrap();
    const destination = await createCanvasGroup(state.project.id, actor, "Acme destination", "", [], { x: 1000, y: 800 }); land();
    const gesture = beginGroupGesture(["itm_a"])!;
    const box = state.canvas.items[destination]!;
    apply(resolveCanvasGroupRequest(state, { type: "item.move", itemId: destination, x: box.x + 10, y: box.y }, { actor, ts: "2026-09-12T01:00:00Z", opId: "op_remote_destination" })); land();
    const afterRemote = structuredClone(state.canvas);
    gesture.move(1000, 800, destination);
    gesture.move(1100, 850, destination);
    expect(await gesture.commit(state.project.id, actor)).toBe(false);
    expect(state.canvas).toEqual(afterRemote);
    expect(useUiStore.getState().groupPreview).toBeNull();
  });
  it("a click completes the keyboard burst once and its actual timer cannot append a later empty transform", async () => {
    const id = await wrap(); posted = [];
    const before = state.canvas.items[id]!.x;
    vi.useFakeTimers();
    const nudger = createGroupNudger(state.project.id, actor, 350);
    nudger.nudge([id], 1, 0);
    const pointer = beginGroupGesture(["itm_outside"])!;
    pointer.cancel();
    await vi.advanceTimersByTimeAsync(1000);
    expect(posted).toHaveLength(1);
    expect(state.canvas.items[id]!.x).toBe(before + 1);
    expect(await nudger.flush()).toBe(false);
    expect(posted).toHaveLength(1);
  });
  it.each(["refused", "queued"] as const)("a late %s gesture cannot overwrite another canvas's notice or preview", async (outcome) => {
    const id = await wrap();
    const gesture = beginGroupGesture([id])!; gesture.move(20, 10);
    const normalFetch = fetch;
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => { await held; return normalFetch(url, init); });
    const completion = gesture.commit(state.project.id, actor);
    const other = applyOperation(null, envelope({ type: "project.create", canvasId: "prj_other", title: "Acme other" }))!;
    useCanvasStore.setState({ canvasId: other.project.id, project: other.project, canvas: other.canvas, confirmed: other, queue: [], notice: "Acme current notice" });
    const preview = { id: "op_current_preview", boxes: new Map() };
    useUiStore.getState().setGroupPreview(preview);
    reject = outcome === "refused"; offline = outcome === "queued"; release();
    expect(await completion).toBe(false);
    expect(useCanvasStore.getState().notice).toBe("Acme current notice");
    expect(useUiStore.getState().groupPreview).toBe(preview);
  });
});

describe("explicit group insertion and brief production writes", () => {
  it("the implicit Context sheet creates a group with only supported creation fields", async () => {
    const id = await wrap(); enterCanvasGroup(id); posted = [];
    const sheet = await addAreaItem(state.project.id, actor, "Acme Context", { x: 1200, y: 800 }, { width: 800, height: 600 });
    expect(posted).toHaveLength(1);
    expect(posted[0]).toMatchObject({ type: "group.change", action: { kind: "create", containerId: id } });
    expect((posted[0] as Extract<Operation, { type: "group.change" }>).action).not.toHaveProperty("groupPlacement");
    expect(state.canvas.items[sheet]).toMatchObject({ containerId: id, properties: { kind: "group" } });
  });

  it("text, files, site, Google Doc, paste and module creations inherit the captured scope", async () => {
    const id = await wrap(); enterCanvasGroup(id); posted = [];
    const parent = state.canvas.items[id]!; const at = { x: parent.x, y: parent.y, chosen: true };
    const text = await addTextNode(state.project.id, actor, "Acme caption", at); land();
    const files = await addFiles(state.project.id, actor, [new File(["acme"], "acme.txt", { type: "text/plain" })], at); land();
    const site = await addBrowserItem(state.project.id, actor, "https://example.com", at); land();
    const doc = await addDocumentItem(state.project.id, actor, { title: "Acme doc", markdown: "# Acme", filename: "acme.md", source: "https://docs.google.com/document/d/acme/edit", syncedAt: "2026-09-12T00:00:00Z" }, at); land();
    const copies = await pasteInto({ canvasId: state.project.id, items: [state.canvas.items.itm_outside!] }, state.project.id, actor, at); land();
    const host = webHostFor(state.project.id, actor);
    useUiStore.getState().setActiveGroup(null);
    await host.send([{ type: "item.add", itemId: "itm_module", version: { id: "ver_module", blobHash: "hash_module", filename: "acme.svg", mimeType: "image/svg+xml", size: 1 }, width: 100, height: 100, placement: at }]); land();
    const added = [text, ...files, site, doc, ...copies, "itm_module"];
    expect(posted).toHaveLength(added.length);
    const content = groupContentBox(state.canvas.items[id]!);
    for (const itemId of added) {
      expect(state.canvas.items[itemId]!.containerId).toBe(id);
      expect(state.canvas.items[itemId]!.y).toBeGreaterThanOrEqual(content.y);
    }
    expect(state.canvas.items.itm_a).toMatchObject({ x: 80, y: 160 });
  });
  it("an upload retains its parent when the person leaves scope before it finishes", async () => {
    const id = await wrap(); enterCanvasGroup(id);
    const normalFetch = fetch;
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => { if (url.endsWith("/blobs")) await held; return normalFetch(url, init); });
    const promise = addTextNode(state.project.id, actor, "Acme slow upload", { x: 0, y: 0 });
    useUiStore.getState().setActiveGroup(null); release();
    const itemId = await promise;
    expect(state.canvas.items[itemId]!.containerId).toBe(id);
    expect(creationDestination(null)).toMatchObject({ containerId: null });
  });
  it.each([false, true])("a delayed upload belongs to its original canvas after navigation (offline=%s)", async (cannotReachHome) => {
    const id = await wrap(); enterCanvasGroup(id); posted = [];
    const saved = new Map<string, StoredReplica>();
    setReplicaStore({ get: async (key) => saved.get(key) ?? null, put: async (key, value) => { saved.set(key, structuredClone(value)); }, delete: async (key) => { saved.delete(key); } });
    const originalCanvasId = state.project.id;
    const normalFetch = fetch;
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    const requestedCanvases: string[] = [];
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      if (url.endsWith("/blobs")) { const response = await normalFetch(url, init); await held; return response; }
      requestedCanvases.push(JSON.parse(String(init?.body)).canvasId);
      if (cannotReachHome) throw new TypeError("Failed to fetch");
      return normalFetch(url, init);
    });
    const completion = createCanvasGroup(originalCanvasId, actor, "Acme delayed group", "Brief", [], { x: 700, y: 500 });
    const other = applyOperation(null, envelope({ type: "project.create", canvasId: "prj_other", title: "Acme other", groupMode: "groups" }))!;
    const storedOther: StoredReplica = { canvasId: other.project.id, project: other.project, canvas: other.canvas, lastSeq: 0, queue: [], savedAt: "2026-09-12T00:00:00Z" };
    saved.set(other.project.id, structuredClone(storedOther));
    useCanvasStore.setState({ canvasId: other.project.id, project: other.project, canvas: other.canvas, confirmed: other, queue: [], refused: [], lastSeq: 0, connection: "live", past: { seq: 0, canvas: other.canvas } });
    useUiStore.setState({ activeGroupId: null, selectedItemIds: ["itm_other_selection"] });
    release();
    if (cannotReachHome) await expect(completion).rejects.toThrow("does not have open");
    else {
      const made = await completion;
      expect(state.canvas.items[made]!.containerId).toBe(id);
      expect(selectCreatedItems(originalCanvasId, [made])).toBe(false);
      expect(posted).toHaveLength(1);
    }
    expect(requestedCanvases).toEqual([originalCanvasId]);
    expect(useCanvasStore.getState()).toMatchObject({ canvasId: other.project.id, confirmed: other, canvas: other.canvas, queue: [], refused: [], connection: "live" });
    expect(useUiStore.getState().selectedItemIds).toEqual(["itm_other_selection"]);
    expect(useCanvasStore.getState().past).toEqual({ seq: 0, canvas: other.canvas });
    flushReplicaWrites();
    expect(saved.get(other.project.id)).toEqual(storedOther);
  });
  it.each(["accepted", "refused", "queued"] as const)("a %s receipt after navigation cannot modify the new canvas queue or connection", async (outcome) => {
    await wrap(); posted = [];
    const normalFetch = fetch;
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => { await held; if (outcome === "queued") throw new TypeError("Failed to fetch"); return normalFetch(url, init); });
    const completion = sendEchoedResult(state.project.id, actor, { type: "item.update", itemId: "itm_a", patch: { title: "Acme updated" } });
    expect(useCanvasStore.getState().queue).toHaveLength(1);
    const other = applyOperation(null, envelope({ type: "project.create", canvasId: "prj_other", title: "Acme other" }))!;
    useCanvasStore.setState({ canvasId: other.project.id, project: other.project, canvas: other.canvas, confirmed: other, queue: [], refused: [], lastSeq: 0, connection: "live" });
    reject = outcome === "refused"; release();
    expect((await completion).status).toBe(outcome);
    expect(useCanvasStore.getState()).toMatchObject({ canvasId: other.project.id, confirmed: other, canvas: other.canvas, queue: [], refused: [], connection: "live" });
  });
  it("attached drawing inherits its target's parent and keeps deliberate header overhang", async () => {
    const id = await wrap(); posted = [];
    const target = state.canvas.items.itm_a!;
    const drawing = await addDrawing(state.project.id, actor, [{ points: [{ x: target.x - 10, y: target.y - 20 }, { x: target.x + 60, y: target.y + 70 }], color: "#000000", width: 3 }], target);
    expect(posted).toHaveLength(1);
    expect(state.canvas.items[drawing]).toMatchObject({ containerId: id, properties: { annotates: target.id } });
    expect(state.canvas.items[drawing]!.x).toBeLessThan(target.x);
    expect(state.canvas.items[drawing]!.y).toBeLessThan(target.y);
    expect(posted[0]).toMatchObject({ placement: { x: state.canvas.items[drawing]!.x, y: state.canvas.items[drawing]!.y } });
  });
  it("brief bytes and header growth land together without moving existing members", async () => {
    const id = await wrap(); posted = [];
    const before = structuredClone(state.canvas.items.itm_a);
    const oldY = state.canvas.items[id]!.y;
    await saveGroupBrief(state.project.id, actor, id, "Acme expanded brief", 240);
    expect(posted).toHaveLength(1);
    expect(posted[0]).toMatchObject({ type: "item.addVersion", itemId: id, briefHeight: 240 });
    expect(state.canvas.items[id]!.groupLayout!.briefHeight).toBe(240);
    expect(state.canvas.items[id]!.y).toBeLessThan(oldY);
    expect(state.canvas.items.itm_a).toEqual(before);
    const accepted = useCanvasStore.getState().queue.at(-1)!.accepted;
    expect(accepted?.op).toMatchObject({ type: "group.change", action: { kind: "apply" } });
  });
  it("a raw insertion receipt stays accepted while its destination predecessor is still missing locally", async () => {
    const id = await wrap(); enterCanvasGroup(id);
    const confirmed = state;
    const remote = resolveCanvasGroupRequest(state, { type: "item.move", itemId: id, x: state.canvas.items[id]!.x + 100, y: state.canvas.items[id]!.y }, { actor, ts: "2026-09-12T01:00:00Z", opId: "op_predecessor" });
    apply(remote); // The home moved; its tail is deliberately withheld from the web replica.
    const beforeInsert = state;
    const itemId = await addTextNode(state.project.id, actor, "Acme ordered insertion", { x: 0, y: 0 });
    const queue = useCanvasStore.getState().queue;
    expect(queue).toHaveLength(1);
    expect(queue[0]!.seq).toBeDefined();
    expect(queue[0]!.accepted?.op).toMatchObject({ type: "group.change", action: { kind: "apply" } });
    expect(useCanvasStore.getState().refused).toEqual([]);
    expect(foldQueue(confirmed, queue)!.canvas.items[itemId]).toBeUndefined();
    expect(foldQueue(beforeInsert, queue)!.canvas).toEqual(state.canvas);
    expect(retire(queue, queue[0]!.seq!)).toEqual([]);
    expect(foldQueue(state, retire(queue, queue[0]!.seq!))!.canvas.items[itemId]).toEqual(state.canvas.items[itemId]);
  });
  it("a new speaker note follows its slide's parent even with another active scope", async () => {
    const id = await wrap();
    useUiStore.getState().setActiveGroup(null);
    const note = await addSpeakerNote(state.project.id, actor, state.canvas.items.itm_a!, "Acme speaker notes");
    expect(state.canvas.items[note]!.containerId).toBe(id);
  });
});
afterEach(() => { flushReplicaWrites(); setReplicaStore(null); vi.useRealTimers(); vi.unstubAllGlobals(); });
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
