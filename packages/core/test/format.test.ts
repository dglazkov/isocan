import { describe, expect, it } from "vitest";
import {
  FORMAT_GAP_X,
  FORMAT_MODES,
  formatMoves,
  isFormatMode,
  lineageProperties,
  type CanvasContents,
  type Item,
} from "../src/index.ts";

const ACTOR = { id: "usr_1", name: "Di" };
let clock = 0;
function item(
  id: string,
  over: Partial<{ x: number; y: number; width: number; height: number; mime: string; parent: string; props: Record<string, string> }> = {},
) {
  const at = `2026-08-21T00:00:${String(clock++).padStart(2, "0")}.000Z`;
  return {
    id, x: over.x ?? 0, y: over.y ?? 0, width: over.width ?? 100, height: over.height ?? 80,
    title: id, description: "",
    properties: { ...(over.parent ? lineageProperties(over.parent) : {}), ...(over.props ?? {}) },
    versions: [{ id: `v_${id}`, blobHash: "h", mimeType: over.mime ?? "text/html", filename: `${id}.html`, size: 1, createdAt: at, createdBy: ACTOR }],
    currentVersionId: `v_${id}`, createdAt: at, createdBy: ACTOR, updatedAt: at, updatedBy: ACTOR,
  };
}
const canvas = (items: ReturnType<typeof item>[]): CanvasContents => ({
  items: Object.fromEntries(items.map((i) => [i.id, i])), threads: {}, trash: [],
});

/**
 * These describe the SMART arrangement, and they pass `mode` explicitly now
 * that `grid` is the default. The default moved because "make it neat" is the
 * request nine times out of ten and it should not come with an opinion about
 * what belongs under what — `smart` is the one that reads the canvas, and
 * being asked for by name is the right price for interpreting somebody's
 * layout.
 */
const SMART = { mode: "smart" } as const;

describe("formatting a canvas", () => {
  it("puts the screens in a row, keeping the order they were already in", () => {
    const state = canvas([item("b", { x: 500 }), item("a", { x: 100 }), item("c", { x: 900 })]);
    const moves = formatMoves(state, SMART);
    const at = (id: string) => moves.find((m) => m.itemId === id) ?? state.items[id]!;
    expect(at("a").x).toBeLessThan(at("b").x);
    expect(at("b").x).toBeLessThan(at("c").x);
    // One row: same top for all three.
    expect(new Set(["a", "b", "c"].map((id) => at(id).y)).size).toBe(1);
  });

  it("leaves a canvas that is already formatted alone", () => {
    // A tidy has to be a fixed point, or running it twice walks the canvas.
    const state = canvas([item("a", { x: 0 }), item("b", { x: 500 })]);
    const once = formatMoves(state, SMART);
    for (const move of once) Object.assign(state.items[move.itemId]!, { x: move.x, y: move.y });
    expect(formatMoves(state, SMART)).toEqual([]);
  });

  it("hangs what was made from a screen underneath it", () => {
    const state = canvas([item("a"), item("v1", { parent: "a" }), item("b", { x: 900 })]);
    const moves = formatMoves(state, SMART);
    const at = (id: string) => moves.find((m) => m.itemId === id) ?? state.items[id]!;
    expect(at("v1").x).toBe(at("a").x);
    expect(at("v1").y).toBeGreaterThan(at("a").y);
    // And the next screen clears the whole column, not just its parent.
    expect(at("b").x).toBeGreaterThanOrEqual(at("a").x + 100 + FORMAT_GAP_X);
  });

  it("keeps going down: a variation of a variation sits under the variation", () => {
    const state = canvas([item("a"), item("v1", { parent: "a" }), item("v2", { parent: "v1" })]);
    const moves = formatMoves(state, SMART);
    const y = (id: string) => (moves.find((m) => m.itemId === id) ?? state.items[id]!).y;
    expect(y("v1")).toBeGreaterThan(y("a"));
    expect(y("v2")).toBeGreaterThan(y("v1"));
  });

  it("does not lose a child whose parent was deleted", () => {
    const state = canvas([item("a"), item("orphan", { parent: "itm_gone" })]);
    const moves = formatMoves(state, SMART);
    expect(moves.map((m) => m.itemId).concat(["a", "orphan"]).includes("orphan")).toBe(true);
    // It stands in the row itself rather than hanging off nothing.
    const at = (id: string) => moves.find((m) => m.itemId === id) ?? state.items[id]!;
    expect(at("orphan").y).toBe(at("a").y);
  });

  it("gathers images below the screens instead of giving them a slot in the row", () => {
    const state = canvas([
      item("screen", { x: 0 }),
      item("photo", { x: 300, mime: "image/jpeg" }),
      item("photo2", { x: 600, mime: "image/png" }),
    ]);
    const moves = formatMoves(state, SMART);
    const at = (id: string) => moves.find((m) => m.itemId === id) ?? state.items[id]!;
    expect(at("photo").y).toBeGreaterThan(at("screen").y + 80);
    expect(at("photo2").y).toBeGreaterThanOrEqual(at("photo").y);
  });

  it("leaves ink that annotates something where it is — it travels with its target", () => {
    const state = canvas([
      item("screen"),
      item("mark", { x: 40, y: 40, mime: "image/svg+xml", props: { kind: "drawing", annotates: "screen", region: "0.1,0.1,0.2,0.2" } }),
    ]);
    expect(formatMoves(state, SMART).find((m) => m.itemId === "mark")).toBeUndefined();
  });

  it("survives a lineage cycle written by hand", () => {
    const state = canvas([item("a", { parent: "b" }), item("b", { parent: "a" })]);
    expect(() => formatMoves(state, SMART)).not.toThrow();
  });

  it("does nothing to an empty canvas", () => {
    expect(formatMoves(canvas([]))).toEqual([]);
  });
});

/**
 * **`grid` — straighten the lines, decide nothing.**
 *
 * The default, and the reason is what people mean when they say "make it
 * neat": line it up. `smart` reads the canvas — lineage, kinds, what belongs
 * under what — and moving somebody's work on an interpretation should be asked
 * for by name.
 */
describe("the grid tidy", () => {
  const at = (id: string, x: number, y: number, width = 100, height = 80): Item =>
    ({
      id,
      x,
      y,
      width,
      height,
      title: id,
      description: "",
      properties: {},
      versions: [],
      currentVersionId: "",
      createdAt: "2026-01-01T00:00:00Z",
      createdBy: { id: "u", name: "U" },
      updatedAt: "2026-01-01T00:00:00Z",
      updatedBy: { id: "u", name: "U" },
    }) as unknown as Item;

  const canvasOf = (items: Item[]) => ({
    items: Object.fromEntries(items.map((i) => [i.id, i])),
    threads: {},
    trash: [],
  });

  it("lines every left edge up on one lattice", () => {
    /* The whole point, and the difference from simply pushing things
       together: columns take the width of the WIDEST item, so edges agree
       down the canvas even when the items do not match. */
    const canvas = canvasOf([at("a", 3, 5, 100), at("b", 260, 9, 300), at("c", 7, 400, 60)]);
    const moves = formatMoves(canvas, { perRow: 2 });
    const placed = new Map(moves.map((m) => [m.itemId, m]));
    const a = placed.get("a") ?? { x: 3, y: 5 };
    const c = placed.get("c") ?? { x: 7, y: 400 };
    expect(a.x).toBe(c.x);
  });

  it("keeps the reading order the canvas already had", () => {
    /* People arrange by hand and resent losing it. Left-to-right within a
       band, top to bottom between bands. */
    const canvas = canvasOf([at("right", 500, 0), at("left", 0, 0), at("below", 0, 500)]);
    const moves = formatMoves(canvas, { perRow: 2 });
    const placed = new Map(moves.map((m) => [m.itemId, [m.x, m.y]]));
    const left = placed.get("left") ?? [0, 0];
    const right = placed.get("right") ?? [500, 0];
    expect(left[0]!).toBeLessThan(right[0]!);
    expect(left[1]!).toBe(right[1]!);
  });

  it("does not put a slightly lower item at the end of the row above", () => {
    /* A plain `y - x` sort does exactly that. Banding by the tallest item is
       what makes "roughly level" mean "the same row", the way an eye reads. */
    const canvas = canvasOf([at("a", 0, 0), at("b", 200, 3), at("c", 400, 6)]);
    const moves = formatMoves(canvas, { perRow: 3 });
    const ys = new Set(
      ["a", "b", "c"].map((id) => moves.find((m) => m.itemId === id)?.y ?? 0),
    );
    expect(ys.size).toBe(1);
  });

  it("is a fixed point — running it twice moves nothing the second time", () => {
    const canvas = canvasOf([at("a", 3, 5), at("b", 260, 9), at("c", 7, 400)]);
    for (const move of formatMoves(canvas, { perRow: 2 })) {
      canvas.items[move.itemId]!.x = move.x;
      canvas.items[move.itemId]!.y = move.y;
    }
    expect(formatMoves(canvas, { perRow: 2 })).toEqual([]);
  });

  it("is what a bare format does", () => {
    /* The decision: no mode means `grid`. */
    const canvas = canvasOf([at("a", 3, 5), at("b", 260, 9)]);
    expect(formatMoves(canvas, { perRow: 2 })).toEqual(formatMoves(canvas, { mode: "grid", perRow: 2 }));
  });

  it("knows which modes exist, and refuses one that does not", () => {
    expect(isFormatMode("grid")).toBe(true);
    expect(isFormatMode("smart")).toBe(true);
    expect(isFormatMode("tidy")).toBe(false);
    expect(FORMAT_MODES).toEqual(["grid", "smart"]);
  });
});
