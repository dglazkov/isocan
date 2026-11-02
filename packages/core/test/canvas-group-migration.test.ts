import { describe, expect, it } from "vitest";
import { applyGroupChange, applyOperation, areaInner, canvasGroupMigrationPreview, groupCellBox, groupContentBox, invertOperation, resolveCanvasGroupMigration, resolveCanvasGroupRequest, validateGroupForest, type CanvasState, type GroupChange, type Operation } from "../src/index.ts";

const actor = { id: "usr_test", name: "Test" };
const ts = "2026-09-13T00:00:00.000Z";
const canvasId = "prj_migration";
const version = (id: string) => ({ id: `ver_${id}`, blobHash: `hash_${id}`, mimeType: "text/markdown", filename: "Acme.md", size: 12 });
function apply(state: CanvasState | null, op: Operation): CanvasState { return applyOperation(state, { id: "op_test", canvasId, actor, ts, op })!; }
function legacy(): CanvasState { return apply(null, { type: "project.create", canvasId, title: "Acme" }); }
function add(state: CanvasState, id: string, x: number, y: number, width: number, height: number, properties: Record<string, string> = {}): CanvasState {
  return apply(state, { type: "item.add", itemId: id, title: `Acme ${id}`, width, height, placement: { x, y, chosen: true }, properties, version: { ...version(id), ...(properties.kind === "drawing" ? { mimeType: "image/svg+xml" } : {}) } });
}
function migrate(state: CanvasState, revision = 20) {
  const op = resolveCanvasGroupMigration(state, revision, { kind: "migrate", expectedRevision: revision }, { actor, ts, opId: "op_migrate" });
  return { op, inverse: invertOperation(state, op)!, state: apply(state, op) };
}
function structural(state: CanvasState, op: Operation): CanvasState { return apply(state, resolveCanvasGroupRequest(state, op, { actor, ts, opId: "op_structural" })); }

describe("authoritative bounded legacy conversion", () => {
  it("chooses stable smallest owners using original half-open centres and never nests areas", () => {
    let state = add(legacy(), "outer", 0, 0, 1000, 1000, { kind: "area", board: "test", tint: "blue" });
    state = add(state, "b", 0, 0, 400, 400, { kind: "area" });
    state = add(state, "a", 0, 0, 400, 400, { kind: "area" });
    state = add(state, "inside", 20, 30, 100, 100);
    state = add(state, "boundary", 350, 100, 100, 100);
    state = add(state, "ink", -800, -900, 100, 100, { kind: "drawing", annotates: "inside", region: "0,0,1,1" });
    state = add(state, "dangling", 20, 30, 100, 100, { kind: "drawing", annotates: "missing" });
    state = apply(state, { type: "thread.create", threadId: "thr_test", anchorItemId: "inside", x: 20, y: 30, comment: { id: "cmt_test", body: "Acme discussion" } });
    const before = structuredClone(state);
    const preview = canvasGroupMigrationPreview(state, 20);
    expect(state).toEqual(before);
    expect(preview.ambiguities.find((row) => row.itemId === "inside")).toEqual({ itemId: "inside", candidateIds: ["a", "b", "outer"], chosenId: "a" });
    const migrated = migrate(state).state;
    for (const id of ["outer", "a", "b"]) expect(migrated.canvas.items[id]!.containerId).toBeUndefined();
    expect(migrated.canvas.items.inside!.containerId).toBe("a");
    expect(migrated.canvas.items.boundary!.containerId).toBe("outer");
    expect(migrated.canvas.items.ink!.containerId).toBe("a");
    expect(migrated.canvas.items.dangling!.containerId).toBeUndefined();
    expect(preview.danglingAnnotations).toEqual(["dangling"]);
    for (const id of ["inside", "boundary", "ink", "dangling"]) for (const field of ["x", "y", "width", "height", "versions", "properties"] as const) expect(migrated.canvas.items[id]![field]).toEqual(before.canvas.items[id]![field]);
    expect(migrated.canvas.threads).toEqual(before.canvas.threads);
    expect(migrated.canvas.items.outer!.properties).toEqual({ kind: "group", board: "test", tint: "blue" });
    expect(groupContentBox(migrated.canvas.items.a!).x).toBe(-800);
    expect(groupContentBox(migrated.canvas.items.a!).y).toBe(-900);
    const reversed = { ...state, canvas: { ...state.canvas, items: Object.fromEntries(Object.entries(state.canvas.items).reverse()) } };
    expect(canvasGroupMigrationPreview(reversed, 20)).toEqual(preview);
  });

  it("repairs named grid bands without moving ordinary content or changing old grid properties", () => {
    let state = add(legacy(), "grid", 2200, -24, 1000, 600, { kind: "area", rows: "2", cols: "2", rowNames: JSON.stringify(["One", "Two"]), colNames: JSON.stringify(["Left", "Right"]) });
    state = add(state, "card", 2224, 176, 160, 120);
    const oldInner = areaInner(state.canvas.items.grid!);
    const { state: converted, inverse } = migrate(state);
    const grid = converted.canvas.items.grid!;
    expect(grid).toMatchObject({ x: 2080, y: -80, width: 1120, height: 656 });
    expect(groupContentBox(grid)).toMatchObject({ x: oldInner.x, y: oldInner.y });
    expect(groupCellBox(grid, 2, 2).width).toBeGreaterThan(0);
    expect(grid.properties.rows).toBe("2");
    expect(converted.canvas.items.card).toMatchObject({ x: 2224, y: 176 });
    const cleared = structural(converted, { type: "group.change", action: { kind: "layout", itemId: "grid", layout: {}, clearGrid: true } });
    expect(cleared.canvas.items.grid!.groupLayout).toEqual({ titleHeight: 56, briefHeight: 120, inset: 24 });
    expect(cleared.canvas.items.grid!.properties.rows).toBe("2");
    const edited = apply(converted, { type: "item.update", itemId: "grid", patch: { title: "Acme newer title", properties: { board: "later" } } });
    const undone = apply(edited, inverse);
    expect(undone.project.groupMode).toBe("legacy");
    expect(undone.project.groupMigration).toBeUndefined();
    expect(undone.canvas.items.grid).toMatchObject({ x: 2200, y: -24, width: 1000, height: 600, title: "Acme newer title", properties: { kind: "area", board: "later" } });
    expect(undone.canvas.items.grid!.versions).toEqual(state.canvas.items.grid!.versions);
  });

  it("converts legacy trash without inventing cohorts and reconciles a dangling mark on target restore", () => {
    let state = add(legacy(), "sheet", 0, 0, 800, 800, { kind: "area" });
    state = add(state, "card", 100, 300, 200, 200);
    state = add(state, "ink", 80, 280, 240, 240, { kind: "drawing", annotates: "card" });
    state = apply(state, { type: "item.delete", itemId: "card" });
    state = apply(state, { type: "item.delete", itemId: "sheet" });
    const converted = migrate(state);
    expect(converted.state.canvas.trash.map(({ item, legacyGroupRestore, cohort }) => [item.id, item.properties.kind, legacyGroupRestore, cohort])).toEqual([["card", undefined, "root", undefined], ["sheet", "group", "frame-only", undefined]]);
    const restoredFrame = structural(converted.state, { type: "item.restore", itemId: "sheet" });
    expect(Object.keys(restoredFrame.canvas.items).sort()).toEqual(["ink", "sheet"]);
    expect(restoredFrame.canvas.items.ink!.containerId).toBeUndefined();
    const restoredCard = structural(restoredFrame, { type: "item.restore", itemId: "card" });
    expect(restoredCard.canvas.items.card!.containerId).toBeUndefined();
    expect(restoredCard.canvas.items.ink!.containerId).toBeUndefined();
    expect(restoredCard.canvas.items.ink!.properties.annotates).toBe("card");
    expect(apply(converted.state, converted.inverse).canvas).toEqual(state.canvas);
  });

  it("refuses stale, forged and malformed migration input without changing the source", () => {
    const state = add(legacy(), "area", 0, 0, 800, 800, { kind: "area" });
    const before = structuredClone(state);
    expect(() => resolveCanvasGroupMigration(state, 21, { kind: "migrate", expectedRevision: 20 }, { actor, ts, opId: "op_bad" })).toThrow(/preview/);
    expect(() => resolveCanvasGroupMigration(state, 20, { kind: "migrate", expectedRevision: 20, writes: [] } as never, { actor, ts, opId: "op_bad" })).toThrow(/only/);
    const converted = migrate(state);
    const change = converted.op.action.kind === "apply" ? converted.op.action.change : null;
    if (!change) throw new Error("expected canonical migration");
    for (const writes of [null, {}, [null]]) expect(() => applyGroupChange(state, { ...change, writes } as unknown as GroupChange, actor, ts)).toThrow(/write/);
    expect(() => applyGroupChange(state, { ...change, schemaVersion: 2 }, actor, ts)).toThrow(/v4/);
    expect(() => validateGroupForest({ ...converted.state, project: { ...converted.state.project, groupMigration: { version: 1, opId: "op_bad", seq: 0 } } })).toThrow(/boundary/);
    expect(state).toEqual(before);
    expect(canvasGroupMigrationPreview(converted.state, 21)).toMatchObject({ status: "already-groups", boundary: { opId: "op_migrate", seq: 21 } });
    expect(() => resolveCanvasGroupMigration(converted.state, 21, { kind: "migrate", expectedRevision: 21 }, { actor, ts, opId: "op_again" })).toThrow(/already/);
  });

  it("keeps literal legacy birth and area moves unchanged and replays old v1/v2 records", () => {
    let state = add(legacy(), "area", 0, 0, 800, 800, { kind: "area" });
    state = add(state, "card", 100, 200, 200, 200);
    const moved = apply(state, { type: "item.move", itemId: "area", x: 300, y: 400 });
    expect(moved.project.groupMode).toBeUndefined();
    expect(moved.canvas.items.card).toMatchObject({ x: 100, y: 200 });
    const groups = apply(null, { type: "project.create", canvasId, title: "Acme", groupMode: "groups" });
    const v1: GroupChange = { canvasId, intent: "create", expected: [{ itemId: "g", location: "absent" }], writes: [{ kind: "create", item: { id: "g", title: "Acme", description: "", properties: { kind: "group" }, x: 0, y: 0, width: 800, height: 800, versions: [{ ...version("g"), createdBy: actor, createdAt: ts }], currentVersionId: "ver_g", createdBy: actor, createdAt: ts, updatedBy: actor, updatedAt: ts } }] };
    const v1state = applyGroupChange(groups, v1, actor, ts);
    const v2: GroupChange = { canvasId, intent: "layout", schemaVersion: 2, expected: [{ itemId: "g", location: "live", facts: { x: 0, y: 0, width: 800, height: 800, containerId: null, groupLayout: null, kind: "group", annotates: null, mimeType: "text/markdown" }, children: [], annotations: [] }], writes: [{ kind: "patch", itemId: "g", fields: { groupLayout: { rowCount: 2, columnCount: 2 } } }] };
    expect(applyGroupChange(v1state, v2, actor, ts).canvas.items.g!.groupLayout).toEqual({ rowCount: 2, columnCount: 2 });
  });
});
