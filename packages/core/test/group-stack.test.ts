import { describe, expect, it } from "vitest";
import { applyOperation, GROUP_STACK, groupAim, groupDropTarget, groupStackAction, groupStackBox, groupStackMembers, groupUnderStack, invertOperation, resolveGroupOperation, STACK_BEHIND, stackFan, stackPile, stackToggle } from "../src/index.ts";
import type { CanvasState, GroupAction, GroupBox, Operation } from "../src/index.ts";

/**
 * **Stacks** (groups-by-hand phase 4): a group shown as a pile of cards is a
 * `GroupLayout` field set by the `layout` action — one undo, no new op — and
 * stacking only changes the drawing. The invariant is that every member keeps
 * its x/y, so Spread puts each back exactly where it was and an agent reading
 * positions reads the truth.
 */
const actor = { id: "usr_test", name: "Test" };
const ts = "2026-10-01T12:00:00.000Z";
let seq = 0;
const version = (id: string) => ({ id: `ver_${id}`, blobHash: `hash_${id}`, mimeType: "text/markdown", filename: `${id}.md`, size: 12 });
function write(state: CanvasState | null, op: Operation): CanvasState { return applyOperation(state, { id: `op_${++seq}`, canvasId: "can_stack", actor, ts, op })!; }
function change(state: CanvasState, action: GroupAction): { state: CanvasState; op: Operation; inverse: Operation } {
  const op = resolveGroupOperation(state, { type: "group.change", action }, { actor, ts, opId: `op_${++seq}` });
  return { op, inverse: invertOperation(state, op)!, state: write(state, op) };
}
function card(state: CanvasState, id: string, box: GroupBox): CanvasState {
  return write(state, { type: "item.add", itemId: id, ...box, placement: { x: box.x, y: box.y, chosen: true }, version: version(id), properties: {} });
}
/** An Acme archive of seven cards, with a nested group, spread over a big frame. */
function archive(): CanvasState {
  let state = write(null, { type: "project.create", canvasId: "can_stack", title: "Acme", groupMode: "groups" });
  const ids = ["one", "two", "three", "four", "five", "six", "seven"];
  ids.forEach((id, n) => { state = card(state, id, { x: 100 + (n % 3) * 500, y: 200 + Math.floor(n / 3) * 400, width: 420, height: 320 }); });
  state = card(state, "inner", { x: 100, y: 1400, width: 200, height: 100 });
  state = change(state, { kind: "create", group: { id: "grp_archive", title: "Archive", version: version("archive"), box: { x: 0, y: 0, width: 1700, height: 1700 } }, itemIds: ids }).state;
  state = change(state, { kind: "create", group: { id: "grp_inner", title: "Inner", version: version("inner"), box: { x: 80, y: 1300, width: 400, height: 300 } }, itemIds: ["inner"], containerId: "grp_archive" }).state;
  return state;
}
const boxes = (state: CanvasState) => Object.fromEntries(Object.values(state.canvas.items).map((item) => [item.id, { x: item.x, y: item.y, width: item.width, height: item.height, containerId: item.containerId ?? null }]));

describe("stacking is a layout field, and it moves nothing", () => {
  it("stacks and spreads with every member's box unchanged, and spread is saved as absence", () => {
    const state = archive();
    const before = boxes(state);
    const stacked = change(state, groupStackAction(state.canvas.items.grp_archive!, true));
    expect(stacked.state.canvas.items.grp_archive!.groupLayout?.display).toBe("stack");
    expect(boxes(stacked.state)).toEqual(before);
    const spread = change(stacked.state, groupStackAction(stacked.state.canvas.items.grp_archive!, false));
    expect(spread.state.canvas.items.grp_archive!.groupLayout).not.toHaveProperty("display");
    expect(boxes(spread.state)).toEqual(before);
  });

  it("is one op, and its inverse is the undo back to spread", () => {
    const state = archive();
    const stacked = change(state, groupStackAction(state.canvas.items.grp_archive!, true));
    expect(stacked.op.type).toBe("group.change");
    const undone = write(stacked.state, stacked.inverse);
    expect(undone.canvas.items.grp_archive!.groupLayout?.display).toBeUndefined();
    expect(boxes(undone)).toEqual(boxes(state));
  });

  it("refuses a display that is neither stack nor spread", () => {
    const state = archive();
    expect(() => change(state, { kind: "layout", itemId: "grp_archive", layout: { display: "fan" as never } })).toThrow(/invalid display/);
  });
});

describe("the pile is a pure function of the member ids", () => {
  const ids = ["itm_a1", "itm_b2", "itm_c3", "itm_d4", "itm_e5", "itm_f6", "itm_g7", "itm_h8", "itm_i9"];

  it("is the same pile for the same ids, every time", () => {
    expect(stackPile(ids)).toEqual(stackPile([...ids]));
    expect(JSON.stringify(stackPile(ids))).toBe(JSON.stringify(stackPile(ids.slice())));
  });

  it("differs across ids, and a card keeps its own turn wherever it sits in the pile", () => {
    const pile = stackPile(ids);
    const turns = new Set(pile.slice(1).map((one) => one.rotate.toFixed(3)));
    expect(turns.size).toBe(pile.length - 1);
    const reordered = stackPile(["itm_z0", ...ids.slice(1)]);
    expect(reordered.slice(1)).toEqual(pile.slice(1));
  });

  it("draws the top upright and at most six behind, each turned 3°–9° and nudged within the card's bounds", () => {
    const pile = stackPile(ids);
    expect(pile).toHaveLength(STACK_BEHIND + 1);
    expect(pile[0]).toEqual({ id: "itm_a1", depth: 0, x: 0, y: 0, rotate: 0 });
    for (const one of pile.slice(1)) {
      expect(Math.abs(one.rotate)).toBeGreaterThanOrEqual(3);
      expect(Math.abs(one.rotate)).toBeLessThanOrEqual(9);
      expect(Math.abs(one.x)).toBeLessThanOrEqual(GROUP_STACK.width * 0.114);
      expect(Math.abs(one.y)).toBeLessThanOrEqual(GROUP_STACK.height * 0.116);
    }
  });

  it("fans with the top in the middle and the rest alternating left and right at 9° a step", () => {
    expect(stackFan(0)).toMatchObject({ x: 0, rotate: 0 });
    expect(stackFan(1).rotate).toBe(-9);
    expect(stackFan(2).rotate).toBe(9);
    expect(stackFan(3).rotate).toBe(-18);
    expect(stackFan(1).x).toBeCloseTo(-stackFan(2).x);
  });
});

describe("a stack on the canvas", () => {
  it("shows its direct members top first, in reading order", () => {
    const state = archive();
    expect(groupStackMembers(state.canvas, "grp_archive").map((item) => item.id)).toEqual(["one", "two", "three", "four", "five", "six", "seven", "grp_inner"]);
  });

  it("occupies one card's footprint at its own origin, while its saved frame is untouched", () => {
    const state = change(archive(), { kind: "layout", itemId: "grp_archive", layout: { display: "stack" } }).state;
    const group = state.canvas.items.grp_archive!;
    expect(groupStackBox(group)).toEqual({ x: group.x, y: group.y, width: GROUP_STACK.width + 2 * GROUP_STACK.pad, height: GROUP_STACK.title + GROUP_STACK.height + 2 * GROUP_STACK.pad });
    expect(groupStackBox(archive().canvas.items.grp_archive!)).toBeNull();
    expect(group.width).toBe(archive().canvas.items.grp_archive!.width);
  });

  it("hides its members at every depth, and nothing else", () => {
    const state = change(archive(), { kind: "layout", itemId: "grp_archive", layout: { display: "stack" } }).state;
    expect(groupUnderStack(state.canvas, "one")).toBe(true);
    expect(groupUnderStack(state.canvas, "grp_inner")).toBe(true);
    expect(groupUnderStack(state.canvas, "inner")).toBe(true);
    expect(groupUnderStack(state.canvas, "grp_archive")).toBe(false);
    expect(groupUnderStack(archive().canvas, "one")).toBe(false);
  });

  it("takes a drop on its footprint, and not where its spread members were", () => {
    let state = change(archive(), { kind: "layout", itemId: "grp_archive", layout: { display: "stack" } }).state;
    state = card(state, "loose", { x: 3000, y: 3000, width: 100, height: 100 });
    expect(groupDropTarget(state.canvas, { x: 200, y: 200 }, ["loose"])?.id).toBe("grp_archive");
    expect(groupDropTarget(state.canvas, { x: 1200, y: 1200 }, ["loose"])).toBeNull();
    // The nested frame lies inside the stack's own footprint area, but it is not drawn.
    expect(groupDropTarget(state.canvas, { x: 150, y: 1350 }, ["loose"])).toBeNull();
  });

  it("is aimed at as the group itself — a pile has no open space", () => {
    const state = change(archive(), { kind: "layout", itemId: "grp_archive", layout: { display: "stack" } }).state;
    expect(groupAim(state.canvas, { gapIn: "grp_archive" }, null, false).itemId).toBe("grp_archive");
    expect(groupAim(state.canvas, { gapIn: "grp_archive" }, null, true)).toEqual({ itemId: "grp_archive", inside: null, among: null });
    // A spread frame's open space under ⌘ is still a selection among its members.
    expect(groupAim(archive().canvas, { gapIn: "grp_archive" }, null, true).among).toBe("grp_archive");
  });
});

describe("⇧S: stack what is spread, spread what is stacked", () => {
  it("stacks a spread group, and spreads it again once it is stacked", () => {
    let state = archive();
    const first = stackToggle(state.canvas, ["grp_archive"], null)!;
    expect(first.groups.map((g) => g.id)).toEqual(["grp_archive"]);
    expect(first.stacked).toBe(true);
    state = change(state, groupStackAction(first.groups[0]!, first.stacked)).state;
    const second = stackToggle(state.canvas, ["grp_archive"], null)!;
    expect(second.stacked).toBe(false);
  });

  it("a selected member stands for its group, and nothing selected means the group you are in", () => {
    const state = archive();
    expect(stackToggle(state.canvas, ["three"], null)!.groups.map((g) => g.id)).toEqual(["grp_archive"]);
    expect(stackToggle(state.canvas, ["inner"], null)!.groups.map((g) => g.id)).toEqual(["grp_inner"]);
    expect(stackToggle(state.canvas, [], "grp_inner")!.groups.map((g) => g.id)).toEqual(["grp_inner"]);
    // Two members of one group are one group, not two presses.
    expect(stackToggle(state.canvas, ["one", "two", "grp_archive"], null)!.groups).toHaveLength(1);
  });

  it("several groups that disagree are made to agree: any spread stacks them all", () => {
    let state = archive();
    state = change(state, groupStackAction(state.canvas.items.grp_inner!, true)).state;
    expect(stackToggle(state.canvas, ["grp_archive", "grp_inner"], null)!.stacked).toBe(true);
    state = change(state, groupStackAction(state.canvas.items.grp_archive!, true)).state;
    expect(stackToggle(state.canvas, ["grp_archive", "grp_inner"], null)!.stacked).toBe(false);
  });

  it("is nothing on a canvas item outside any group, or with nothing at all", () => {
    let state = archive();
    state = card(state, "loose", { x: 3000, y: 0, width: 100, height: 100 });
    expect(stackToggle(state.canvas, ["loose"], null)).toBeNull();
    expect(stackToggle(state.canvas, [], null)).toBeNull();
  });
});
