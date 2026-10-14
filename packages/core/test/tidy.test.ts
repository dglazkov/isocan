import { describe, expect, it } from "vitest";
import { applyOperation, formatMoves, formatScope, groupArrangeAction, invertOperation, itemChrome, ITEM_CHROME, resolveCanvasGroupRequest, tidyInPlace, tidyMoves } from "../src/index.ts";
import type { CanvasContents, CanvasState, Item, Operation } from "../src/index.ts";

/**
 * **Tidy keeps the arrangement** (14 Oct 2026).
 *
 * The fixture is shaped like the selection that found the bug: a document card
 * top left, a tall text node top right, a one-line display title running
 * under both, and a second document card under the tall one. Tidy re-dealt
 * them into a 2×2 lattice — a new arrangement — and, counting no chrome, put
 * the title against the name strip drawn above its new neighbour. These hold
 * what Tidy means instead: the same arrangement, its lines straightened,
 * nothing overlapping once the name strip and marks row are counted.
 */
const item = (id: string, x: number, y: number, width: number, height: number, kind?: string, extra: Record<string, string> = {}): Item =>
  ({
    id,
    title: `Acme ${id}`,
    description: "",
    x,
    y,
    width,
    height,
    properties: { ...(kind ? { kind } : {}), ...extra },
    currentVersionId: `${id}_v`,
    versions: [{ id: `${id}_v`, blobHash: id.padEnd(64, "0"), mimeType: "text/markdown", filename: `${id}.md`, createdAt: "2026-10-14T12:00:00.000Z", createdBy: { id: "usr_a", name: "A" } }],
  }) as unknown as Item;

const canvasOf = (items: Item[]): CanvasContents =>
  ({ items: Object.fromEntries(items.map((i) => [i.id, i])), threads: {}, trash: [], agents: {} }) as unknown as CanvasContents;

/** A loose, hand-made arrangement: nothing quite lined up. */
const loose = (): Item[] => [
  item("handoff", 0, 0, 700, 900),
  item("framing", 820, 40, 1500, 1900, "text"),
  item("title", 30, 2080, 3400, 190, "text"),
  item("design", 870, 2420, 560, 720),
];
const ids = ["handoff", "framing", "title", "design"];

interface Rect { x: number; y: number; width: number; height: number }
const footprint = (one: Item, scale = 1): Rect => {
  const c = itemChrome(one, scale);
  return { x: one.x, y: one.y - c.above, width: one.width, height: one.height + c.above + c.below };
};
const overlap = (a: Rect, b: Rect): boolean => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const apply = (items: Item[], moves: Array<{ itemId: string; x: number; y: number }>): Item[] =>
  items.map((one) => { const m = moves.find((row) => row.itemId === one.id); return m ? { ...one, x: m.x, y: m.y } : one; });
const pairs = <T,>(list: T[]): Array<[T, T]> => list.flatMap((a, i) => list.slice(i + 1).map((b) => [a, b] as [T, T]));
/**
 * The arrangement, as relations a tidy must keep: every "wholly left of", and
 * "wholly above" between items stacked in one column (their spans across
 * overlap). Two items in different rows AND columns may come into one row —
 * that is what lining up a near-row is — but nothing swaps sides.
 */
const relations = (items: Item[]): string[] =>
  pairs(items).flatMap(([a, b]) => {
    const stacked = a.x < b.x + b.width && b.x < a.x + a.width;
    const level = a.y < b.y + b.height && b.y < a.y + a.height;
    return [
      a.x + a.width <= b.x ? `${a.id}<x${b.id}` : b.x + b.width <= a.x ? `${b.id}<x${a.id}` : "",
      stacked ? (a.y + a.height <= b.y ? `${a.id}<y${b.id}` : b.y + b.height <= a.y ? `${b.id}<y${a.id}` : "") : "",
      stacked ? `${a.id}|${b.id}` : level ? `${a.id}-${b.id}` : "",
    ];
  }).filter(Boolean).sort();
/** Pairs whose arrangement a tidy broke: an order flipped, or a shared row
 * or column lost. */
const broken = (before: Item[], after: Item[]): string[] => {
  const by = new Map(after.map((one) => [one.id, one]));
  const left = (a: Item, b: Item) => a.x + a.width <= b.x;
  const above = (a: Item, b: Item) => a.y + a.height <= b.y;
  const row = (a: Item, b: Item) => a.y < b.y + b.height && b.y < a.y + a.height;
  const column = (a: Item, b: Item) => a.x < b.x + b.width && b.x < a.x + a.width;
  return pairs(before).flatMap(([a, b]) => {
    const [A, B] = [by.get(a.id)!, by.get(b.id)!];
    const bad = (left(a, b) && left(B, A)) || (left(b, a) && left(A, B)) || (above(a, b) && above(B, A)) || (above(b, a) && above(A, B)) ||
      (row(a, b) && !row(A, B)) || (column(a, b) && !column(A, B));
    return bad ? [`${a.id}/${b.id}`] : [];
  });
};
const footprintOverlaps = (items: Item[], scale = 1): string[] =>
  pairs(items).filter(([a, b]) => overlap(footprint(a, scale), footprint(b, scale))).map(([a, b]) => `${a.id}/${b.id}`);

describe("what Tidy used to do with this selection", () => {
  it("re-dealt it into a new arrangement, and ran a title into a neighbour's name strip", () => {
    // The old default: the lattice, at the selection's own corner.
    const before = loose();
    const scoped = formatScope(canvasOf(before), ids)!;
    const after = apply(before, formatMoves(scoped.scope, { mode: "grid", origin: scoped.origin }));
    expect(relations(after)).not.toEqual(relations(before));
    // At 15% zoom the name strip above an item is 160 world units; the
    // lattice's 64-unit gutter is not enough room for it.
    expect(footprintOverlaps(after, 0.15).length).toBeGreaterThan(0);
  });
});

describe("tidy in place", () => {
  it("keeps the arrangement: every left-of and above stays as it was", () => {
    const before = loose();
    const after = apply(before, tidyMoves(canvasOf(before), ids));
    expect(relations(after)).toEqual(relations(before));
  });

  it("snaps near-aligned edges onto shared lines", () => {
    const before = loose();
    const after = new Map(apply(before, tidyMoves(canvasOf(before), ids)).map((one) => [one.id, one]));
    // The two top cards were 40 apart at the top: one row now.
    expect(after.get("handoff")!.y).toBe(after.get("framing")!.y);
    // The title's left edge was 30 off the card above it: one column now.
    expect(after.get("title")!.x).toBe(after.get("handoff")!.x);
    // The card under the tall node was 50 off its left edge: one column.
    expect(after.get("design")!.x).toBe(after.get("framing")!.x);
  });

  it("moves each item a little — under the snap distance — when nothing had to be cleared", () => {
    const before = loose();
    const moves = tidyMoves(canvasOf(before), ids);
    expect(moves.length).toBeGreaterThan(0);
    for (const m of moves) {
      const was = before.find((one) => one.id === m.itemId)!;
      expect(Math.hypot(m.x - was.x, m.y - was.y), m.itemId).toBeLessThanOrEqual(120);
    }
  });

  it("leaves no footprints overlapping, name strip and marks row included, at the zoom it was asked at", () => {
    for (const scale of [1, 0.5, 0.25, 0.15]) {
      const before = loose();
      const chrome = (one: Item) => itemChrome(one, scale);
      const after = apply(before, tidyMoves(canvasOf(before), ids, { chrome }));
      expect(footprintOverlaps(after, scale), `at ${scale}`).toEqual(
        // What already overlapped before is somebody's to fix; the tidy adds nothing.
        footprintOverlaps(before, scale).filter((pair) => footprintOverlaps(after, scale).includes(pair)),
      );
      expect(footprintOverlaps(after, scale).every((pair) => footprintOverlaps(before, scale).includes(pair)), `at ${scale}`).toBe(true);
      expect(relations(after), `at ${scale}`).toEqual(relations(before));
    }
  });

  it("lines up on the item that cannot move, rather than crowding a neighbour's name", () => {
    // Two cards 20 apart at the top, and a title 60 under the left one. The
    // middle of the two tops would lower the left card by 10, into the name
    // strip drawn above the title. So the line goes where the left card
    // already is, and the right card does the moving.
    const before = [
      item("a", 0, 0, 400, 300),
      item("b", 460, 20, 400, 300),
      item("c", 0, 360, 900, 100, "text"),
    ];
    const after = apply(before, tidyMoves(canvasOf(before), ["a", "b", "c"]));
    const at = new Map(after.map((one) => [one.id, one]));
    expect(at.get("a")!.y).toBe(0);
    expect(at.get("b")!.y).toBe(0);
    expect(footprintOverlaps(after)).toEqual([]);
    expect(relations(after)).toEqual(relations(before));
  });

  it("is a fixed point: a tidied selection does not move again", () => {
    const before = loose();
    const once = apply(before, tidyMoves(canvasOf(before), ids));
    expect(tidyMoves(canvasOf(once), ids)).toEqual([]);
  });

  it("steers clear of what was not selected", () => {
    // `z` sits just under the design card's new place: it was clear of it and
    // stays clear, and it is not moved.
    const before = [...loose(), item("z", 870, 3230, 400, 200)];
    const after = apply(before, tidyMoves(canvasOf(before), ids));
    expect(after.find((one) => one.id === "z")).toEqual(before.find((one) => one.id === "z"));
    expect(footprintOverlaps(after)).toEqual([]);
  });

  it("carries a mark on a selected item with it", () => {
    const before = [...loose(), item("ink", 100, 100, 50, 50, "drawing", { annotates: "handoff" })];
    const moves = tidyMoves(canvasOf(before), ids);
    const card = moves.find((m) => m.itemId === "handoff");
    const ink = moves.find((m) => m.itemId === "ink");
    expect(card).toBeDefined();
    expect(ink).toEqual({ itemId: "ink", x: 100 + card!.x, y: 100 + card!.y });
  });

  it("holds over many loose arrangements: order kept, nothing new overlapping", () => {
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let trial = 0; trial < 300; trial++) {
      // A rough grid of cards, each jittered off its cell — on odd trials
      // packed tight, so name strips and marks rows crowd their neighbours.
      const items: Item[] = [];
      const cols = 2 + Math.floor(rand() * 3), rows = 1 + Math.floor(rand() * 3);
      const tight = trial % 2 === 1;
      let top = 0;
      for (let r = 0; r < rows; r++) {
        let left = 0, tallest = 0;
        for (let c = 0; c < cols; c++) {
          const w = 100 + Math.floor(rand() * 900), h = 60 + Math.floor(rand() * 900);
          const x = tight ? left : c * 1200 + Math.floor(rand() * 120);
          const y = tight ? top + Math.floor(rand() * 60) : r * 1200 + Math.floor(rand() * 120);
          items.push(item(`i${r}_${c}`, x, y, w, h, rand() < 0.3 ? "text" : undefined));
          left = x + w + 20 + Math.floor(rand() * 180);
          tallest = Math.max(tallest, y - top + h);
        }
        top += tallest + 20 + Math.floor(rand() * 180);
      }
      const scale = [1, 0.4, 0.2][trial % 3]!;
      const chrome = (one: Item) => itemChrome(one, scale);
      const after = apply(items, tidyMoves(canvasOf(items), items.map((one) => one.id), { chrome }));
      // Nothing swaps sides and no shared row or column is lost; a near-row
      // may BECOME a row, and a near-column a column.
      expect(broken(items, after), `trial ${trial}`).toEqual([]);
      expect(footprintOverlaps(after, scale).every((pair) => footprintOverlaps(items, scale).includes(pair)), `trial ${trial}`).toBe(true);
    }
  });

  it("evens out gaps that are nearly equal", () => {
    const units = [0, 1, 2, 3].map((i) => ({ id: `u${i}`, box: { x: [0, 300, 610, 900][i]!, y: 0, width: 200, height: 100 }, footprint: { x: [0, 300, 610, 900][i]!, y: 0, width: 200, height: 100 } }));
    const at = tidyInPlace(units);
    const xs = [0, 1, 2, 3].map((i) => at.get(`u${i}`)!.x);
    const gaps = xs.slice(1).map((x, i) => x - xs[i]! - 200);
    expect(new Set(gaps).size).toBe(1);
  });

  it("counts a name strip and a marks row the size the canvas draws them", () => {
    expect(itemChrome(item("a", 0, 0, 10, 10))).toEqual({ above: ITEM_CHROME.above, below: ITEM_CHROME.below });
    expect(itemChrome(item("a", 0, 0, 10, 10), 0.5)).toEqual({ above: ITEM_CHROME.above * 2, below: ITEM_CHROME.below * 2 });
    expect(itemChrome(item("g", 0, 0, 10, 10, "group"))).toEqual({ above: 0, below: 0 });
  });
});

describe("one tidy, one undo", () => {
  const actor = { id: "usr_a", name: "A" };
  const ts = "2026-10-14T12:00:00.000Z";
  const born = (groupMode: "groups" | "legacy"): CanvasState => {
    const state = applyOperation(null, { id: "op_birth", actor, ts, canvasId: "prj_tidy", op: { type: "project.create", canvasId: "prj_tidy", title: "Acme tidy", groupMode } })!;
    state.canvas.items = canvasOf(loose()).items;
    return state;
  };
  const undoes = (state: CanvasState, op: Operation): void => {
    const after = applyOperation(state, { id: "op_tidy", actor, ts, canvasId: "prj_tidy", op })!;
    expect(ids.some((id) => after.canvas.items[id]!.x !== state.canvas.items[id]!.x || after.canvas.items[id]!.y !== state.canvas.items[id]!.y)).toBe(true);
    const inverse = invertOperation(state, op);
    expect(inverse).not.toBeNull();
    const back = applyOperation(after, { id: "op_undo", actor, ts, canvasId: "prj_tidy", op: inverse! })!;
    for (const id of ids) expect([back.canvas.items[id]!.x, back.canvas.items[id]!.y], id).toEqual([state.canvas.items[id]!.x, state.canvas.items[id]!.y]);
  };

  it("is one items.move on a canvas without groups, and one inverse puts every item back", () => {
    const state = born("legacy");
    undoes(state, { type: "items.move", moves: tidyMoves(state.canvas, ids) });
  });

  it("is one group change on a group canvas, and one inverse puts every item back", () => {
    const state = born("groups");
    const op = resolveCanvasGroupRequest(state, { type: "group.change", action: groupArrangeAction(state, ids, { kind: "tidy", mode: "in-place" }) }, { actor, ts, opId: "op_tidy" });
    undoes(state, op);
  });
});

describe("tidy in place on a group canvas", () => {
  it("is one transform that keeps the arrangement and clears the name strips", () => {
    const before = loose();
    const state = { project: { id: "prj_1", name: "Acme", groupMode: "groups", createdAt: "", updatedAt: "", createdBy: "usr_a", updatedBy: "usr_a" }, canvas: canvasOf(before) } as unknown as CanvasState;
    const action = groupArrangeAction(state, ids, { kind: "tidy", mode: "in-place" });
    expect(action.kind).toBe("transform");
    if (!("moves" in action)) throw new Error("a tidy is a move transform");
    const after = apply(before, action.moves);
    expect(relations(after)).toEqual(relations(before));
    expect(footprintOverlaps(after)).toEqual([]);
    // The same numbers the legacy canvas and the CLI get.
    const legacy = apply(before, tidyMoves(canvasOf(before), ids));
    expect(after.map((one) => [one.x, one.y])).toEqual(legacy.map((one) => [one.x, one.y]));
  });
});
