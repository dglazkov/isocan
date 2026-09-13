import { describe, expect, it } from "vitest";
import { applyOperation, applyGroupChange, blobsNamedBy, buildRecap, harvestPreferences, captureGroupExpectations, GroupConflictError, groupArrangeAction, groupCellBox, groupDropPolicy, groupDropTarget, groupFitAction, groupGridNeedsRoom, groupPreviewBoxes, groupAncestors, groupChildren, groupContentBox, groupDescendants, groupFitBox, groupRemoveAction, groupResizeBox, groupScopedRoot, groupScopeRoots, groupSelectionRoots, groupTransform, groupTransformClosure, groupWrapAction, invertOperation, itemsTouchedBy, majors, resolveCanvasGroupRequest, resolveGroupOperation, validateGroupForest, weightOf } from "../src/index.ts";
import type { CanvasState, GroupAction, GroupBox, GroupChange, GroupOperation, LogEntry, Operation } from "../src/index.ts";

const actor = { id: "usr_test", name: "Test" };
const other = { id: "usr_other", name: "Other" };
const ts = "2026-09-12T12:00:00.000Z";
let seq = 0;
const version = (id: string, mimeType = "text/markdown") => ({ id: `ver_${id}`, blobHash: `hash_${id}`, mimeType, filename: `${id}.md`, size: 12 });
function ordinary(state: CanvasState, id: string, box: GroupBox, properties: Record<string, string> = {}): CanvasState {
  return applyOperation(state, { id: `op_${++seq}`, canvasId: state.project.id, actor, ts, op: { type: "item.add", itemId: id, ...box, placement: { x: box.x, y: box.y, chosen: true }, version: version(id, properties.kind === "drawing" ? "image/svg+xml" : "text/markdown"), properties } })!;
}
function empty(groups = true): CanvasState {
  return applyOperation(null, { id: `op_${++seq}`, canvasId: "can_test", actor, ts, op: { type: "project.create", canvasId: "can_test", title: "Acme", ...(groups ? { groupMode: "groups" } : {}) } })!;
}
function change(state: CanvasState, action: GroupAction, opId = `op_${++seq}`): { state: CanvasState; op: GroupOperation; inverse: Operation } {
  const op = resolveGroupOperation(state, { type: "group.change", action }, { actor, ts, opId });
  const inverse = invertOperation(state, op)!;
  return { op, inverse, state: applyOperation(state, { id: opId, canvasId: state.project.id, actor, ts, op })! };
}
function undo(state: CanvasState, op: Operation): CanvasState { return applyOperation(state, { id: `op_${++seq}`, canvasId: state.project.id, actor, ts, op })!; }
function wrap(state: CanvasState, id: string, itemIds: string[]): ReturnType<typeof change> { return change(state, { kind: "create", group: { id, title: `Acme ${id}`, version: version(id) }, itemIds }); }
function card(): CanvasState { return ordinary(empty(), "a", { x: 100, y: 200, width: 400, height: 400 }); }
function request(state: CanvasState, itemId: string, box: GroupBox): Extract<GroupAction, { kind: "transform" }> { return { kind: "transform", itemId, box, expected: captureGroupExpectations(state, [itemId]) }; }
function boxes(state: CanvasState): Record<string, GroupBox> { return Object.fromEntries(Object.values(state.canvas.items).map(({ id, x, y, width, height }) => [id, { x, y, width, height }])); }

describe("explicit canvas-group forest", () => {
  it("scopes clicks and traversal without geometric fallback, and wraps mixed roots at their common parent", () => {
    let state = wrap(wrap(card(), "inner", ["a"]).state, "outer", ["inner"]).state;
    state = ordinary(state, "overlap", { x: 100, y: 200, width: 100, height: 100 });
    expect(groupScopedRoot(state.canvas, "a", null)).toBe("outer");
    expect(groupScopedRoot(state.canvas, "a", "outer")).toBe("inner");
    expect(groupScopedRoot(state.canvas, "a", "inner")).toBe("a");
    expect(groupScopedRoot(state.canvas, "outer", "outer")).toBeNull();
    expect(groupScopedRoot(state.canvas, "overlap", "outer")).toBeNull();
    expect(groupAncestors(state.canvas, "a").map((item) => item.id)).toEqual(["inner", "outer"]);
    expect(groupScopeRoots(state.canvas, "outer").map((item) => item.id)).toEqual(["inner"]);
    const action = groupWrapAction(state.canvas, { id: "mixed", title: "Acme Mixed", version: version("mixed") }, ["a", "overlap"]);
    const made = change(state, action).state;
    expect(made.canvas.items.mixed?.containerId).toBeUndefined();
    expect(made.canvas.items.a?.containerId).toBe("mixed");
    expect(made.canvas.items.inner?.containerId).toBe("outer");
    expect(made.canvas.items.a).toMatchObject({ x: 100, y: 200 });
  });

  it("removes mixed-parent roots atomically using the backwards-compatible canonical reparent intent", () => {
    let state = wrap(wrap(card(), "left", ["a"]).state, "outer", ["left"]).state;
    state = wrap(ordinary(state, "b", { x: 900, y: 200, width: 400, height: 400 }), "right", ["b"]).state;
    const before = state;
    const removed = change(state, groupRemoveAction(state.canvas, ["a", "b"]));
    expect(removed.op.action).toMatchObject({ kind: "apply", change: { intent: "reparent" } });
    expect(removed.state.canvas.items.a?.containerId).toBe("outer");
    expect(removed.state.canvas.items.b?.containerId).toBeUndefined();
    expect(boxes(removed.state)).toEqual(boxes(before));
    expect(undo(removed.state, removed.inverse).canvas.items).toEqual(before.canvas.items);
    expect(change(before, groupRemoveAction(before.canvas, ["a"], true)).state.canvas.items.a?.containerId).toBeUndefined();
    expect(() => change(before, { kind: "remove", itemIds: ["a", "outer"] })).toThrow(/already at the canvas root/);
    expect(() => change(before, { kind: "remove", itemIds: ["a"], toRoot: "yes" } as unknown as GroupAction)).toThrow(/boolean/);
  });
  it("wraps without moving cards, ignores geometric non-members, detaches in place", () => {
    const original = ordinary(card(), "outside", { x: 110, y: 210, width: 200, height: 200 });
    const made = wrap(original, "g", ["a"]);
    expect(made.state.canvas.items.a).toMatchObject({ x: 100, y: 200, containerId: "g" });
    expect(groupChildren(made.state.canvas, "g").map((item) => item.id)).toEqual(["a"]);
    expect(made.state.canvas.items.outside?.containerId).toBeUndefined();
    expect(made.state.canvas.items.g).toMatchObject({ x: 76, y: 120, width: 448, height: 528 });
    const detached = change(made.state, { kind: "reparent", itemIds: ["a"], containerId: null });
    expect(detached.state.canvas.items.a).toMatchObject({ x: 100, y: 200 });
    expect(detached.state.canvas.items.a?.containerId).toBeUndefined();
    expect(undo(detached.state, detached.inverse).canvas.items.a?.containerId).toBe("g");
  });

  it("normalizes nested selection and rejects cycles, non-groups, self and cross-canvas changes atomically", () => {
    const nested = wrap(wrap(card(), "inner", ["a"]).state, "outer", ["inner"]).state;
    expect(groupSelectionRoots(nested.canvas, ["a", "inner", "outer"])).toEqual(["outer"]);
    expect(groupDescendants(nested.canvas, "outer").map((item) => item.id)).toEqual(["inner", "a"]);
    const before = JSON.stringify(nested);
    for (const containerId of ["inner", "a", "missing", "outer"]) expect(() => change(nested, { kind: "reparent", itemIds: ["outer"], containerId })).toThrow();
    const resolved = change(nested, { kind: "frame", itemId: "outer", fit: true }).op;
    if (resolved.action.kind !== "apply") throw new Error("not resolved");
    const concrete = resolved.action.change;
    expect(() => applyGroupChange(nested, { ...concrete, canvasId: "elsewhere" }, actor, ts)).toThrow(/another canvas/);
    expect(JSON.stringify(nested)).toBe(before);
  });

  it("requires explicit group mode and preserves ordinary historical replay", () => {
    const legacy = ordinary(empty(false), "a", { x: 0, y: 0, width: 400, height: 400 });
    expect(() => wrap(legacy, "g", ["a"])).toThrow(/group mode/);
    const area = ordinary(legacy, "area", { x: 0, y: 0, width: 800, height: 800 }, { kind: "area" });
    const moved = undo(area, { type: "item.move", itemId: "area", x: 80, y: 80 });
    expect(moved.canvas.items.a?.x).toBe(0);
    expect(moved.canvas.items.area?.x).toBe(80);
  });

  it("validates the forest after generic kind edits and low-level restoration", () => {
    const state = wrap(card(), "g", ["a"]).state;
    expect(() => undo(state, { type: "item.update", itemId: "g", patch: { properties: { kind: "text" } } })).toThrow();
    expect(() => undo(state, { type: "item.delete", itemId: "g" })).toThrow();
    expect(() => validateGroupForest({ ...state, canvas: { ...state.canvas, items: { ...state.canvas.items, a: { ...state.canvas.items.a!, containerId: "absent" } } } })).toThrow();
  });
});

describe("group geometry", () => {
  it.each(["nw", "ne", "sw", "se"] as const)("resizes about fixed %s with exact inverse", (anchor) => {
    const state = wrap(card(), "g", ["a"]).state;
    const old = state.canvas.items.g!;
    const box = groupResizeBox(old, { width: 800, height: 900 }, anchor);
    const resized = change(state, { ...request(state, "g", box), anchor });
    const next = resized.state.canvas.items.g!;
    expect(next).toMatchObject(box);
    expect(anchor.endsWith("e") ? next.x + next.width : next.x).toBe(anchor.endsWith("e") ? old.x + old.width : old.x);
    expect(anchor.startsWith("s") ? next.y + next.height : next.y).toBe(anchor.startsWith("s") ? old.y + old.height : old.y);
    expect(boxes(undo(resized.state, resized.inverse))).toEqual(boxes(state));
  });

  it("shrinks a fitted card in both axes without spending its label reservation", () => {
    const state = wrap(card(), "g", ["a"]).state;
    const shrunk = change(state, request(state, "g", { x: 76, y: 120, width: 336, height: 396 })).state;
    expect(shrunk.canvas.items.g).toMatchObject({ width: 336, height: 396 });
    expect(shrunk.canvas.items.a).toMatchObject({ x: 100, y: 200, width: 288, height: 268 });
  });

  it("clamps at descendant minimums and refuses invalid/empty frames", () => {
    const state = wrap(card(), "g", ["a"]).state;
    const small = change(state, request(state, "g", { x: 0, y: 0, width: 1, height: 1 })).state;
    expect(small.canvas.items.a!.width).toBeGreaterThanOrEqual(80);
    expect(small.canvas.items.a!.height).toBeGreaterThanOrEqual(60);
    expect(() => change(state, request(state, "g", { x: NaN, y: 0, width: 0, height: -1 }))).toThrow();
    expect(() => change(empty(), { kind: "create", group: { id: "tiny", title: "Tiny", version: version("tiny"), box: { x: 0, y: 0, width: 10, height: 10 } } })).toThrow();
    const blank = wrap(empty(), "g", []).state;
    expect(() => change(blank, { kind: "frame", itemId: "g", box: { x: 0, y: 0, width: 10, height: 10 } })).toThrow();
    expect(() => change(state, { kind: "frame", itemId: "g", box: { x: 0, y: 0, width: 160, height: 160 } })).toThrow(/exclude/);
  });

  it("preserves child geometry on fit/header/gutter edits and grows ancestors on member moves", () => {
    let state = wrap(wrap(card(), "inner", ["a"]).state, "outer", ["inner"]).state;
    const start = boxes(state).a;
    state = change(state, { kind: "layout", itemId: "inner", layout: { briefHeight: 120, rows: ["One"], columns: ["A"], rowGutter: 120, columnGutter: 32 } }).state;
    expect(boxes(state).a).toEqual(start);
    const inner = groupContentBox(state.canvas.items.inner!);
    expect(inner.x).toBeLessThanOrEqual(state.canvas.items.a!.x);
    expect(inner.y).toBeLessThanOrEqual(state.canvas.items.a!.y);
    const op = resolveCanvasGroupRequest(state, { type: "item.move", itemId: "a", x: -500, y: -600 }, { actor, ts, opId: "op_raw" });
    const moved = undo(state, op);
    expect(moved.canvas.items.outer!.x).toBeLessThan(-500);
    expect(moved.canvas.items.outer!.y).toBeLessThan(-600);
    expect(itemsTouchedBy(op)).toEqual(expect.arrayContaining(["a", "inner", "outer"]));
  });

  it("moves distinct group roots once for raw align/distribute batches", () => {
    let state = wrap(card(), "g", ["a"]).state;
    state = ordinary(state, "b", { x: 900, y: 300, width: 200, height: 200 });
    state = wrap(state, "h", ["b"]).state;
    const op = resolveCanvasGroupRequest(state, { type: "items.move", moves: [{ itemId: "g", x: 0, y: 0 }, { itemId: "h", x: 700, y: 0 }, { itemId: "a", x: 999, y: 999 }] }, { actor, ts, opId: "op_align" });
    const moved = undo(state, op);
    expect(moved.canvas.items.a).toMatchObject({ x: 24, y: 80 });
    expect(moved.canvas.items.b).toMatchObject({ x: 724, y: 80 });
  });
});

describe("annotation ownership and structural concurrency", () => {
  function marked(): CanvasState {
    let state = ordinary(card(), "ink", { x: 90, y: 180, width: 430, height: 450 }, { kind: "drawing", annotates: "a", region: "0,0,1,1" });
    state = wrap(state, "inner", ["a"]).state;
    state = ordinary(state, "frameInk", { x: state.canvas.items.inner!.x - 10, y: state.canvas.items.inner!.y - 10, width: 60, height: 60 }, { kind: "drawing", annotates: "inner" });
    return wrap(state, "outer", ["inner"]).state;
  }
  it("uses target transforms for child/frame ink in either insertion order", () => {
    const state = marked();
    const reverse = { ...state, canvas: { ...state.canvas, items: Object.fromEntries(Object.entries(state.canvas.items).reverse()) } };
    const box = groupResizeBox(state.canvas.items.outer!, { width: 900, height: 950 }, "se");
    const first = groupTransform(state.canvas, request(state, "outer", box));
    const second = groupTransform(reverse.canvas, request(reverse, "outer", box));
    expect(Object.fromEntries(first)).toEqual(Object.fromEntries(second));
    for (const [markId, targetId] of [["ink", "a"], ["frameInk", "inner"]]) {
      const oldMark = state.canvas.items[markId!]!; const oldTarget = state.canvas.items[targetId!]!;
      const newMark = first.get(markId!)!; const newTarget = first.get(targetId!)!;
      expect((newMark.x - newTarget.x) / newTarget.width).toBeCloseTo((oldMark.x - oldTarget.x) / oldTarget.width, 6);
      expect(newMark.height / newTarget.height).toBeCloseTo(oldMark.height / oldTarget.height, 6);
    }
    expect(state.canvas.items.ink!.containerId).toBe("inner");
    expect(state.canvas.items.frameInk!.containerId).toBe("outer");
    expect(groupTransformClosure(state.canvas, ["outer", "ink", "a"])).toHaveLength(5);
  });

  it("refuses mark-only reparent, promotes child marks and trashes frame marks on ungroup", () => {
    const state = marked();
    expect(() => change(state, { kind: "reparent", itemIds: ["ink"], containerId: null })).toThrow(/detach/);
    const gone = change(state, { kind: "ungroup", itemIds: ["inner"] });
    expect(gone.state.canvas.items.ink!.containerId).toBe("outer");
    expect(gone.state.canvas.items.a!.containerId).toBe("outer");
    expect(gone.state.canvas.items.frameInk).toBeUndefined();
    expect(gone.state.canvas.trash.map((entry) => entry.item.id)).toEqual(expect.arrayContaining(["inner", "frameInk"]));
    expect(boxes(undo(gone.state, gone.inverse))).toEqual(boxes(state));
  });

  it("moves dangling ink independently, including when resized inside a group", () => {
    let state = ordinary(empty(), "ink", { x: 100, y: 200, width: 400, height: 400 }, { kind: "drawing", annotates: "missing" });
    state = wrap(state, "g", ["ink"]).state;
    const scaled = groupTransform(state.canvas, request(state, "g", { ...groupFitBox(state.canvas, "g"), width: 800, height: 800 }));
    expect(scaled.get("ink")!.width).toBeGreaterThan(400);
    expect(groupSelectionRoots(state.canvas, ["ink"])).toEqual(["ink"]);
  });

  it("rejects attaching ink to a free drawing, not only to an existing annotation", () => {
    const state = ordinary(empty(), "drawing", { x: 0, y: 0, width: 100, height: 100 }, { kind: "drawing" });
    expect(() => ordinary(state, "mark", { x: 10, y: 10, width: 40, height: 40 }, { kind: "drawing", annotates: "drawing" })).toThrow(/ink-to-ink/);
  });

  it("conflicts on membership, gutter, attachments and sibling geometry but allows unrelated text", () => {
    const state = marked();
    const planned = { kind: "transform" as const, itemIds: ["inner"], by: { x: 30, y: 40 }, expected: captureGroupExpectations(state, ["inner"]) };
    const renamed = undo(state, { type: "item.update", itemId: "a", patch: { title: "New wording" } });
    expect(() => change(renamed, planned)).not.toThrow();
    const layout = change(state, { kind: "layout", itemId: "inner", layout: { briefHeight: 120 } }).state;
    expect(() => change(layout, planned)).toThrow(GroupConflictError);
    const added = ordinary(state, "extra", { x: 1000, y: 1000, width: 100, height: 100 });
    const joined = change(added, { kind: "reparent", itemIds: ["extra"], containerId: "inner" }).state;
    expect(() => change(joined, planned)).toThrow(GroupConflictError);
    const applied = change(state, planned);
    expect(() => change(applied.state, planned)).toThrow(GroupConflictError);
  });
});

describe("atomic records, inverses and deletion cohorts", () => {
  it("reports affected items, structural/churn weights and embedded source/visual metadata", () => {
    const made = change(card(), { kind: "create", group: { id: "g", title: "Acme group", version: { ...version("g"), visual: { blobHash: "hash_visual", mimeType: "image/png" } } }, itemIds: ["a"] });
    const entry: LogEntry = { seq: 1, envelope: { id: "op_record", canvasId: "can_test", actor, ts, op: made.op }, inverse: made.inverse };
    expect(itemsTouchedBy(made.op)).toEqual(expect.arrayContaining(["g", "a"]));
    expect(buildRecap([entry], { verbatim: 0, canvas: made.state.canvas }).windows[0]!.items.map((row) => row.id)).toEqual(expect.arrayContaining(["g", "a"]));
    expect(majors([entry])[0]).toMatchObject({ itemId: "g", about: "Acme group" });
    expect(blobsNamedBy([entry]).get("hash_visual")).toEqual({ mimeType: "image/png", filename: "g.md", size: 12 });
    expect(blobsNamedBy([entry]).get("hash_g")?.mimeType).toBe("text/markdown");
    const moved = change(made.state, { kind: "transform", itemIds: ["g"], by: { x: 5, y: 6 }, expected: captureGroupExpectations(made.state, ["g"]) });
    expect(weightOf({ ...entry, envelope: { ...entry.envelope, op: moved.op } })).toBeLessThan(weightOf(entry));
  });

  it("empties deletion captures with their trash", () => {
    const made = wrap(card(), "g", ["a"]).state;
    const deleted = change(made, { kind: "delete", itemIds: ["g"] }).state;
    expect(Object.keys(deleted.canvas.groupCohorts ?? {})).toHaveLength(1);
    const emptied = undo(deleted, { type: "trash.empty" });
    expect(emptied.canvas.groupCohorts).toBeUndefined();
    expect(emptied.canvas.trash).toEqual([]);
  });

  it("restores original IDs, authorship and new content through creation undo/redo", () => {
    const made = wrap(card(), "g", ["a"]);
    const edited = undo(made.state, { type: "item.update", itemId: "g", patch: { title: "Edited brief title" } });
    const redo = invertOperation(edited, made.inverse)!;
    const undone = undo(edited, made.inverse);
    expect(undone.canvas.items.g).toBeUndefined();
    const restored = undo(undone, redo);
    expect(restored.canvas.items.g).toMatchObject({ id: "g", title: "Edited brief title", createdBy: actor, createdAt: ts });
    expect(restored.canvas.items.g!.versions).toEqual(made.state.canvas.items.g!.versions);
    expect(restored.canvas.items.a!.containerId).toBe("g");
  });

  it("direct restore skips independently restored members and reports them; exact inverse conflicts", () => {
    let state = ordinary(card(), "b", { x: 700, y: 200, width: 100, height: 100 });
    state = wrap(state, "g", ["a", "b"]).state;
    const deleted = change(state, { kind: "delete", itemIds: ["g"] }, "op_delete_cohort");
    let partial = change(deleted.state, { kind: "restore", itemIds: ["a"] }).state;
    partial = undo(partial, { type: "item.move", itemId: "a", x: 4000, y: 5000 });
    expect(() => undo(partial, deleted.inverse)).toThrow(GroupConflictError);
    const restored = change(partial, { kind: "restore", itemIds: ["g"] });
    expect(restored.state.canvas.items.a).toMatchObject({ x: 4000, y: 5000 });
    expect(restored.state.canvas.items.a!.containerId).toBeUndefined();
    expect(restored.state.canvas.items.b!.containerId).toBe("g");
    expect(restored.op.action.kind === "apply" && restored.op.action.change.skippedIds).toEqual(["a"]);
    expect(deleted.state.canvas.groupCohorts!.op_delete_cohort!.members).toHaveLength(3);
  });

  it("serializes resolved effects and rejects invalid late writes without mutating the input", () => {
    const state = card(); const made = wrap(state, "g", ["a"]);
    expect(undo(state, JSON.parse(JSON.stringify(made.op)) as Operation)).toEqual(made.state);
    if (made.op.action.kind !== "apply") throw new Error("not resolved");
    const broken: GroupChange = structuredClone(made.op.action.change);
    broken.writes.push({ kind: "patch", itemId: "nope", fields: { containerId: "g" } });
    const before = JSON.stringify(state);
    expect(() => applyGroupChange(state, broken, other, ts)).toThrow();
    expect(JSON.stringify(state)).toBe(before);
  });

  it.each([
    { kind: "restore" }, { kind: "reparent" }, { kind: "frame" }, { kind: "layout" }, { kind: "toString" }, { kind: "__proto__" },
    { kind: "create", group: { id: "g", title: "Acme", version: version("g"), box: { x: 0, y: 0, width: 400, height: 400, id: "injected" } } },
    { kind: "create", group: { id: "g", title: "Acme", version: { ...version("g"), containerId: "injected" } } },
    { kind: "create", group: { id: "g", title: "Acme", version: version("g"), properties: "not-an-object" } },
    { kind: "create", group: { id: "g", title: "Acme", version: version("g"), properties: { invalid: 3 } } },
    { kind: "create", group: { id: "g", title: "Acme", version: version("g"), box: null } },
    { kind: "create", group: { id: "g", title: "Acme", version: version("g"), layout: null } },
    { kind: "create", group: { id: "g", title: "Acme", version: version("g"), description: 1 } },
    { kind: "create", group: { id: "g", title: "Acme", version: { ...version("g"), visual: { blobHash: 123, mimeType: [] } } } },
    { kind: "create", group: { id: "g", title: "Acme", version: { ...version("g"), visual: { blobHash: "hash_visual", mimeType: "image/png", filename: null } } } },
    { kind: "create", group: { id: "g", title: "Acme", version: { ...version("g"), visual: { blobHash: "hash_visual", mimeType: "image/png", size: -1 } } } },
    { kind: "frame", itemId: "g", fit: "false" },
    { kind: "layout", itemId: "g", layout: {}, tidy: "false" },
    { kind: "reparent", itemIds: ["a"], containerId: null, place: "false" },
    { kind: "transform", itemIds: ["a"], by: { x: 1, y: 2 } },
    { kind: "transform", itemIds: ["a"], by: { x: 1, y: 2 }, expected: [null] },
    { kind: "apply", change: {} }, { kind: "delete", itemIds: ["a"], resolved: {} },
  ])("refuses malformed/smuggled JSON as validation, never a TypeError: %j", (action) => {
    expect(() => change(card(), action as GroupAction)).toThrowError(/canvas group|canvas group changed/);
    try { change(card(), action as GroupAction); } catch (error) { expect(error).not.toBeInstanceOf(TypeError); }
  });
});

describe("atomic group insertion and content repair", () => {
  it("places a card in its named cell without borrowing its old coordinates, then undoes creation and frame effects", () => {
    const state = change(empty(), { kind: "create", group: { id: "g", title: "Acme grid", version: version("g"), box: { x: 0, y: 0, width: 1200, height: 1200 }, layout: { rows: ["A", "B"], columns: ["One", "Two"], rowCount: 2, columnCount: 2 } } }).state;
    const inserted = change(state, { kind: "insert", item: { type: "item.add", itemId: "card", version: version("card"), width: 400, height: 400, placement: { x: -800, y: -700 }, containerId: "g", cell: { row: 2, column: 2 } } });
    expect(inserted.state.canvas.items.card).toMatchObject({ x: 680, y: 664, width: 400, height: 400, containerId: "g" });
    expect(inserted.op.action).toMatchObject({ kind: "apply", change: { intent: "insert", schemaVersion: 2 } });
    const undone = undo(inserted.state, inserted.inverse);
    expect(boxes(undone)).toEqual(boxes(state));
    expect(undone.canvas.trash.find((entry) => entry.item.id === "card")?.item.createdBy).toEqual(actor);
    expect(() => change(inserted.state, { kind: "insert", item: { type: "item.add", itemId: "too_large", version: version("large"), width: 900, height: 900, placement: { x: 0, y: 0 }, containerId: "g", cell: { row: 1, column: 1 } } })).toThrow(/cell/);
  });

  it("creates annotations directly in their target's group and retains the native overhang", () => {
    const state = wrap(card(), "g", ["a"]).state;
    const inserted = change(state, { kind: "insert", item: { type: "item.add", itemId: "ink", version: version("ink", "image/svg+xml"), width: 500, height: 300, placement: { x: 70, y: 180 }, properties: { kind: "drawing", annotates: "a" } } });
    expect(inserted.state.canvas.items.ink).toMatchObject({ x: 70, y: 180, width: 500, height: 300, containerId: "g" });
    expect(inserted.state.canvas.items.g!.x).toBe(46);
    expect(() => change(state, { kind: "insert", item: { type: "item.add", itemId: "ink", version: version("ink", "image/svg+xml"), width: 500, height: 300, placement: { x: 70, y: 180 }, properties: { kind: "drawing", annotates: "a" }, containerId: null } })).toThrow(/differs/);
  });

  it("wraps a future frame's dangling annotation identically before or after target creation", () => {
    const mark = { x: 50, y: -40, width: 90, height: 90 };
    const first = wrap(ordinary(card(), "frameInk", mark, { kind: "drawing", annotates: "inner" }), "inner", ["a"]).state;
    const second = ordinary(wrap(card(), "inner", ["a"]).state, "frameInk", mark, { kind: "drawing", annotates: "inner" });
    expect(boxes(first)).toEqual(boxes(second));
    expect(first.canvas.items.frameInk).toMatchObject(mark);
    const nested = wrap(first, "outer", ["inner"]).state;
    expect(nested.canvas.items.frameInk?.containerId).toBe("outer");
  });

  it("replaces brief content and header geometry in one record, preserving members and unrelated edits on inverse", () => {
    const before = wrap(card(), "g", ["a"]).state;
    const nextVersion = { ...version("brief"), visual: { blobHash: "visual_brief", mimeType: "image/png" } };
    const updated = change(before, { kind: "content", operation: { type: "item.addVersion", itemId: "g", version: nextVersion, briefHeight: 120 } });
    expect(updated.state.canvas.items.g).toMatchObject({ y: 0, height: 648, groupLayout: { briefHeight: 120 }, currentVersionId: nextVersion.id });
    expect(updated.state.canvas.items.a).toEqual(before.canvas.items.a);
    const renamed = undo(updated.state, { type: "item.update", itemId: "g", patch: { title: "Acme renamed", properties: { tint: "rose" } } });
    const restored = undo(renamed, updated.inverse);
    expect(restored.canvas.items.g).toMatchObject({ y: 120, height: 528, title: "Acme renamed", properties: { tint: "rose" }, currentVersionId: "ver_g" });
    const later = undo(updated.state, { type: "item.addVersion", itemId: "g", version: version("newer") });
    expect(() => undo(later, updated.inverse)).toThrow(GroupConflictError);
    const entry: LogEntry = { seq: 1, envelope: { id: "op_brief", canvasId: before.project.id, actor, ts, op: updated.op }, inverse: updated.inverse };
    expect(blobsNamedBy([entry]).get("visual_brief")).toEqual({ mimeType: "image/png", filename: "brief.md", size: 12 });
    expect(weightOf(entry)).toBe(6);
  });

  it("keeps ordinary wording on its existing inverse path after geometry changes", () => {
    const state = wrap(card(), "g", ["a"]).state;
    const plain: Operation = { type: "item.update", itemId: "a", patch: { title: "Acme text" } };
    const normalized = resolveCanvasGroupRequest(state, plain, { actor, ts, opId: "op_words" });
    expect(normalized).toEqual(plain);
    const inverse = invertOperation(state, normalized)!;
    const renamed = undo(state, normalized);
    const moved = change(renamed, { kind: "transform", itemIds: ["g"], by: { x: 20, y: 30 }, expected: captureGroupExpectations(renamed, ["g"]) }).state;
    const restored = undo(moved, inverse);
    expect(restored.canvas.items.a!.title).toBe(state.canvas.items.a!.title);
    expect(restored.canvas.items.a).toMatchObject({ x: 120, y: 230 });
  });

  it("refuses malformed bounded insertion/content requests and under-guarded content replay", () => {
    const state = wrap(card(), "g", ["a"]).state;
    for (const operation of [
      { type: "item.update", itemId: "g", patch: { title: 1 }, briefHeight: 120 },
      { type: "item.update", itemId: "g", patch: { removeProperties: "kind" }, briefHeight: 120 },
      { type: "item.update", itemId: "g", patch: {}, size: null },
      { type: "item.addVersion", itemId: "g", version: { ...version("bad"), visual: { blobHash: 12 } } },
      { type: "item.setCurrentVersion", itemId: "g", versionId: null },
    ]) expect(() => change(state, { kind: "content", operation } as GroupAction)).toThrow(/canvas group/);
    const resolved = change(state, { kind: "content", operation: { type: "item.update", itemId: "g", patch: { title: "Changed" }, briefHeight: 120 } }).op;
    if (resolved.action.kind !== "apply") throw new Error("unresolved");
    const tampered = structuredClone(resolved.action.change);
    const patch = tampered.writes.find((write) => write.kind === "patch" && write.itemId === "g");
    if (!patch || patch.kind !== "patch") throw new Error("no patch");
    patch.content!.description = "unguarded";
    expect(() => applyGroupChange(state, tampered, actor, ts)).toThrow(/precondition/);
  });
});

describe("shared group layout intents", () => {
  it("tidies actual placement units into saved grid cells and grows cells for footprints", () => {
    let state = ordinary(card(), "b", { x: 1400, y: 1200, width: 300, height: 300 });
    state = ordinary(state, "ink", { x: 70, y: 170, width: 480, height: 480 }, { kind: "drawing", annotates: "a" });
    state = wrap(state, "g", ["a", "b"]).state;
    const tidied = change(state, { kind: "layout", itemId: "g", layout: { rowCount: 1, columnCount: 2, columns: ["One", "Two"], rows: ["Row"] }, tidy: true });
    const group = tidied.state.canvas.items.g!;
    const first = groupCellBox(group, 1, 1); const second = groupCellBox(group, 1, 2);
    expect(tidied.state.canvas.items.ink).toMatchObject({ x: first.x, y: first.y });
    expect(tidied.state.canvas.items.a).toMatchObject({ x: first.x + 30, y: first.y + 30 });
    expect(tidied.state.canvas.items.b).toMatchObject({ x: second.x, y: second.y });
    expect(tidied.state.canvas.items.b!.y).not.toBe(1200);
    expect(boxes(undo(tidied.state, tidied.inverse))).toEqual(boxes(state));
  });

  it("uses complete annotation footprints for align and raw fit normalizes ancestor plus child", () => {
    let state = ordinary(card(), "ink", { x: 70, y: 170, width: 480, height: 480 }, { kind: "drawing", annotates: "a" });
    state = ordinary(state, "b", { x: 900, y: 900, width: 100, height: 100 });
    const aligned = change(state, groupArrangeAction(state, ["a", "ink", "b"], { kind: "align", edge: "top" })).state;
    expect(aligned.canvas.items.b!.y).toBe(170);
    expect(aligned.canvas.items.a!.y).toBe(200);
    const wrapped = wrap(state, "g", ["a"]).state;
    const fitted = change(wrapped, { kind: "frame", targets: [{ itemId: "g" }, { itemId: "a", box: { x: 0, y: 0, width: 80, height: 60 } }] }).state;
    expect(fitted.canvas.items.a).toEqual(wrapped.canvas.items.a);
    const planned = groupFitAction(wrapped, [{ itemId: "b", width: 200, height: 180 }]);
    const moved = undo(wrapped, { type: "item.move", itemId: "b", x: 1300, y: 1300 });
    expect(() => change(moved, planned)).toThrow(GroupConflictError);
  });

  it("offers deepest named header targets and previews one atomic move plus drop", () => {
    let state = wrap(card(), "inner", ["a"]).state;
    state = wrap(state, "outer", ["inner"]).state;
    state = ordinary(state, "b", { x: 900, y: 900, width: 100, height: 100 });
    const inner = state.canvas.items.inner!;
    const header = { x: inner.x + 20, y: inner.y + 10 };
    expect(groupDropTarget(state.canvas, header, ["b"])?.id).toBe("inner");
    expect(groupDropPolicy(inner, header)).toBe("auto");
    expect(groupDropTarget(state.canvas, header, ["outer"])).toBeNull();
    const action: GroupAction = { kind: "transform", itemIds: ["b"], by: { x: -800, y: -800 }, containerId: "inner", groupPlacement: "auto", expected: captureGroupExpectations(state, ["b", "inner"]) };
    const preview = groupPreviewBoxes(state, action);
    const accepted = change(state, action);
    for (const [id, box] of preview) expect(accepted.state.canvas.items[id]).toMatchObject(box);
    expect(accepted.state.canvas.items.b?.containerId).toBe("inner");
    expect(accepted.state.canvas.items.b!.y).toBeGreaterThanOrEqual(groupContentBox(accepted.state.canvas.items.inner!).y);
    expect(boxes(undo(accepted.state, accepted.inverse))).toEqual(boxes(state));
  });
});

it("rounds newly persisted roots and descendants consistently while inverse restores historical fractions", () => {
  const before = wrap(card(), "g", ["a"]).state;
  const historical = { ...before, canvas: { ...before.canvas, items: Object.fromEntries(Object.values(before.canvas.items).map((item) => [item.id, { ...item, x: item.x + 0.123456789 }])) } };
  const action = request(historical, "g", { x: 80.123456789, y: 90.26894865525674, width: 632.5965770171149, height: 700.987654321 });
  const preview = groupPreviewBoxes(historical, action);
  const resized = change(historical, action);
  expect(resized.state.canvas.items.g).toMatchObject({ x: 80.123457, y: 90.268949, width: 632.596577, height: 700.987654 });
  for (const [id, box] of preview) expect(resized.state.canvas.items[id]).toMatchObject(box);
  expect(boxes(undo(resized.state, resized.inverse))).toEqual(boxes(historical));
});

it("keeps historical v1 dense grid records readable and gives new grids usable full-clearance cells", () => {
  const state = wrap(card(), "g", ["a"]).state;
  const original = state.canvas.items.g!;
  const labels = Array.from({ length: 20 }, (_, index) => `Row ${index + 1}`);
  // This is the original v1 canonical patch shape: no schemaVersion or
  // counts, and only its then-supported layout labels and geometry fields.
  const historical: GroupChange = { canvasId: state.project.id, intent: "layout", expected: captureGroupExpectations(state, ["g"]), writes: [{ kind: "patch", itemId: "g", fields: { groupLayout: { rows: labels, columns: labels }, x: original.x - 120, y: original.y - 32, width: original.width + 120, height: original.height + 32 } }] };
  const read = applyGroupChange(state, historical, actor, ts);
  expect(read.canvas.items.g!.width).toBe(568);
  expect(groupGridNeedsRoom(read.canvas.items.g!)).toBe(true);
  expect(groupCellBox(read.canvas.items.g!, 20, 20).width).toBeGreaterThan(0);
  expect(groupCellBox(read.canvas.items.g!, 20, 20).height).toBeGreaterThan(0);
  const configured = change(state, { kind: "layout", itemId: "g", layout: { rowCount: 20, columnCount: 20 } });
  expect(configured.op.action).toMatchObject({ kind: "apply", change: { schemaVersion: 2 } });
  const group = configured.state.canvas.items.g!;
  expect(groupGridNeedsRoom(group)).toBe(false);
  expect(group.width).toBeGreaterThanOrEqual(828);
  expect(group.height).toBeGreaterThanOrEqual(884);
  const resized = change(configured.state, request(configured.state, "g", { x: group.x, y: group.y, width: 160, height: 160 })).state;
  expect(groupCellBox(resized.canvas.items.g!, 20, 20).width).toBeGreaterThan(0);
  expect(groupCellBox(resized.canvas.items.g!, 20, 20).height).toBeGreaterThan(0);
});

it("harvests a version choice recorded inside atomic brief/header repair", () => {
  const made = wrap(card(), "g", ["a"]);
  const added = change(made.state, { kind: "content", operation: { type: "item.addVersion", itemId: "g", version: version("next"), briefHeight: 120 } });
  const chosen = change(added.state, { kind: "content", operation: { type: "item.setCurrentVersion", itemId: "g", versionId: "ver_g", briefHeight: 0 } });
  const log: LogEntry[] = [made, added, chosen].map((one, index) => ({ seq: index + 1, envelope: { id: `op_choice_${index}`, canvasId: made.state.project.id, actor, ts, op: one.op }, inverse: one.inverse }));
  expect(harvestPreferences(chosen.state.canvas, log)).toEqual([{ itemId: "g", title: "Acme g", chosen: "ver_g", chosenAt: ts, chosenBy: actor.name, chosenById: actor.id, against: ["ver_next"] }]);
});

it.each(["transform", "delete", "restore"] as const)("marks counted-grid %s preconditions and inverses as v2, and rejects a missing marker", (kind) => {
  const configured = change(wrap(card(), "g", ["a"]).state, { kind: "layout", itemId: "g", layout: { rowCount: 2, columnCount: 2 } }).state;
  const before = kind === "restore" ? change(configured, { kind: "delete", itemIds: ["g"] }).state : configured;
  const action: GroupAction = kind === "transform" ? { kind, itemIds: ["g"], by: { x: 5, y: 7 }, expected: captureGroupExpectations(before, ["g"]) } : { kind, itemIds: ["g"] };
  const result = change(before, action);
  expect(result.op.action).toMatchObject({ kind: "apply", change: { schemaVersion: 2 } });
  expect(result.inverse).toMatchObject({ type: "group.change", action: { kind: "apply", change: { schemaVersion: 2 } } });
  expect(boxes(undo(result.state, result.inverse))).toEqual(boxes(before));
  if (result.op.action.kind !== "apply") throw new Error("not resolved");
  const { schemaVersion: _version, ...untagged } = result.op.action.change;
  expect(() => applyGroupChange(before, untagged, actor, ts)).toThrow(/preconditions require group schema v2/);
});
