import { describe, expect, it } from "vitest";
import { applyOperation, groupGridAction, groupGridLayout, groupGridTrimmedLabels, invertOperation, resolveGroupOperation } from "../src/index.ts";
import type { CanvasState, GroupAction, GroupBox, Operation } from "../src/index.ts";

/**
 * **A grid's counts and labels are one save** (Loop finding, 30 Sep 2026).
 * The web form edited the counts and the label lists apart, so 3 named rows
 * cut to 2 saved `{ rowCount: 2, rows: [a, b, c] }` and the writer refused
 * it — and the CLI's `group grid 2x2` merged over the saved labels the same
 * way. `groupGridLayout` drops the labels past a lowered count in the same
 * layout; `groupGridAction` is the one act both surfaces send.
 */
const actor = { id: "usr_test", name: "Test" };
const ts = "2026-09-30T12:00:00.000Z";
let seq = 0;
const version = (id: string) => ({ id: `ver_${id}`, blobHash: `hash_${id}`, mimeType: "text/markdown", filename: `${id}.md`, size: 12 });
function write(state: CanvasState | null, op: Operation): CanvasState { return applyOperation(state, { id: `op_${++seq}`, canvasId: "can_grid", actor, ts, op })!; }
function change(state: CanvasState, action: GroupAction): { state: CanvasState; inverse: Operation } {
  const op = resolveGroupOperation(state, { type: "group.change", action }, { actor, ts, opId: `op_${++seq}` });
  return { inverse: invertOperation(state, op)!, state: write(state, op) };
}
function card(state: CanvasState, id: string, box: GroupBox): CanvasState {
  return write(state, { type: "item.add", itemId: id, ...box, placement: { x: box.x, y: box.y, chosen: true }, version: version(id), properties: {} });
}
/** A 3×3 Acme board with every row and column named and a card in the bottom-right cell. */
function board(): { state: CanvasState; id: string } {
  let state = write(null, { type: "project.create", canvasId: "can_grid", title: "Acme", groupMode: "groups" });
  state = card(state, "late", { x: 900, y: 900, width: 120, height: 80 });
  state = change(state, { kind: "create", group: { id: "grp_board", title: "Acme board", version: version("board"), box: { x: 0, y: 0, width: 1400, height: 1400 } }, itemIds: ["late"] }).state;
  state = change(state, { kind: "layout", itemId: "grp_board", layout: { rowCount: 3, columnCount: 3, rows: ["Q1", "Q2", "Q3"], columns: ["Now", "Next", "Later"] } }).state;
  return { state, id: "grp_board" };
}

describe("groupGridLayout trims labels to the counts", () => {
  it("drops row labels past a lowered row count and column labels past a lowered column count", () => {
    expect(groupGridLayout({ rowCount: 2, rows: ["Q1", "Q2", "Q3"], columnCount: 3, columns: ["A", "B", "C"] })).toEqual({ rowCount: 2, rows: ["Q1", "Q2"], columnCount: 3, columns: ["A", "B", "C"] });
    expect(groupGridLayout({ rowCount: 3, rows: ["Q1", "Q2", "Q3"], columnCount: 1, columns: ["A", "B", "C"], inset: 12 })).toEqual({ rowCount: 3, rows: ["Q1", "Q2", "Q3"], columnCount: 1, columns: ["A"], inset: 12 });
    expect(groupGridTrimmedLabels({ rowCount: 2, rows: ["Q1", "Q2", "Q3", "Q4"], columnCount: 1, columns: ["A", "B"] })).toEqual({ rows: ["Q3", "Q4"], columns: ["B"] });
  });

  it("leaves labels alone when counts grow or match, and when no count is saved", () => {
    const grown = { rowCount: 5, rows: ["Q1", "Q2"], columnCount: 4, columns: ["A", "B", "C", "D"] };
    expect(groupGridLayout(grown)).toEqual(grown);
    expect(groupGridLayout({ rows: ["Q1", "Q2", "Q3"] })).toEqual({ rows: ["Q1", "Q2", "Q3"] });
    expect(groupGridTrimmedLabels(grown)).toEqual({ rows: [], columns: [] });
    expect(groupGridLayout(undefined)).toEqual({});
  });
});

describe("groupGridAction is one act, one undo", () => {
  it("shrinks 3×3 to 2×2 in one accepted write; the member in a vanished cell stays where it was, still a member", () => {
    const { state, id } = board();
    const action = groupGridAction(state.canvas.items[id]!, { rows: 2, columns: 2 });
    expect(action).toEqual({ kind: "layout", itemId: id, layout: { rowCount: 2, columnCount: 2, rows: ["Q1", "Q2"], columns: ["Now", "Next"] } });
    const before = state.canvas.items.late!;
    const next = change(state, action);
    expect(next.state.canvas.items[id]!.groupLayout).toMatchObject({ rowCount: 2, columnCount: 2, rows: ["Q1", "Q2"], columns: ["Now", "Next"] });
    expect(next.state.canvas.items.late).toMatchObject({ x: before.x, y: before.y, containerId: id });
    const frame = next.state.canvas.items[id]!;
    expect(frame.x + frame.width).toBeGreaterThanOrEqual(before.x + before.width);
    const undone = write(next.state, next.inverse);
    expect(undone.canvas.items[id]!.groupLayout).toEqual(state.canvas.items[id]!.groupLayout);
  });

  it("refuses explicit names that outnumber their counts, rather than dropping what was just typed", () => {
    const { state, id } = board();
    expect(() => groupGridAction(state.canvas.items[id]!, { rows: 2, columns: 2 }, { rows: ["A", "B", "C"] })).toThrow("3 row names for 2 rows");
  });

  it("clears counts, names and gutters in one write that undo restores", () => {
    const { state, id } = board();
    const action = groupGridAction(state.canvas.items[id]!, null);
    expect(action.clearGrid).toBe(true);
    const next = change(state, action);
    const layout = next.state.canvas.items[id]!.groupLayout ?? {};
    for (const key of ["rows", "columns", "rowCount", "columnCount", "rowGutter", "columnGutter"]) expect(layout).not.toHaveProperty(key);
    expect(write(next.state, next.inverse).canvas.items[id]!.groupLayout).toEqual(state.canvas.items[id]!.groupLayout);
  });
});
