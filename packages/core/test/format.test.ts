import { describe, expect, it } from "vitest";
import { FORMAT_GAP_X, formatMoves, lineageProperties, type CanvasState } from "../src/index.ts";

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
const canvas = (items: ReturnType<typeof item>[]): CanvasState => ({
  items: Object.fromEntries(items.map((i) => [i.id, i])), threads: {}, trash: [],
});

describe("formatting a canvas", () => {
  it("puts the screens in a row, keeping the order they were already in", () => {
    const state = canvas([item("b", { x: 500 }), item("a", { x: 100 }), item("c", { x: 900 })]);
    const moves = formatMoves(state);
    const at = (id: string) => moves.find((m) => m.itemId === id) ?? state.items[id]!;
    expect(at("a").x).toBeLessThan(at("b").x);
    expect(at("b").x).toBeLessThan(at("c").x);
    // One row: same top for all three.
    expect(new Set(["a", "b", "c"].map((id) => at(id).y)).size).toBe(1);
  });

  it("leaves a canvas that is already formatted alone", () => {
    // A tidy has to be a fixed point, or running it twice walks the canvas.
    const state = canvas([item("a", { x: 0 }), item("b", { x: 500 })]);
    const once = formatMoves(state);
    for (const move of once) Object.assign(state.items[move.itemId]!, { x: move.x, y: move.y });
    expect(formatMoves(state)).toEqual([]);
  });

  it("hangs what was made from a screen underneath it", () => {
    const state = canvas([item("a"), item("v1", { parent: "a" }), item("b", { x: 900 })]);
    const moves = formatMoves(state);
    const at = (id: string) => moves.find((m) => m.itemId === id) ?? state.items[id]!;
    expect(at("v1").x).toBe(at("a").x);
    expect(at("v1").y).toBeGreaterThan(at("a").y);
    // And the next screen clears the whole column, not just its parent.
    expect(at("b").x).toBeGreaterThanOrEqual(at("a").x + 100 + FORMAT_GAP_X);
  });

  it("keeps going down: a variation of a variation sits under the variation", () => {
    const state = canvas([item("a"), item("v1", { parent: "a" }), item("v2", { parent: "v1" })]);
    const moves = formatMoves(state);
    const y = (id: string) => (moves.find((m) => m.itemId === id) ?? state.items[id]!).y;
    expect(y("v1")).toBeGreaterThan(y("a"));
    expect(y("v2")).toBeGreaterThan(y("v1"));
  });

  it("does not lose a child whose parent was deleted", () => {
    const state = canvas([item("a"), item("orphan", { parent: "itm_gone" })]);
    const moves = formatMoves(state);
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
    const moves = formatMoves(state);
    const at = (id: string) => moves.find((m) => m.itemId === id) ?? state.items[id]!;
    expect(at("photo").y).toBeGreaterThan(at("screen").y + 80);
    expect(at("photo2").y).toBeGreaterThanOrEqual(at("photo").y);
  });

  it("leaves ink that annotates something where it is — it travels with its target", () => {
    const state = canvas([
      item("screen"),
      item("mark", { x: 40, y: 40, mime: "image/svg+xml", props: { kind: "drawing", annotates: "screen", region: "0.1,0.1,0.2,0.2" } }),
    ]);
    expect(formatMoves(state).find((m) => m.itemId === "mark")).toBeUndefined();
  });

  it("survives a lineage cycle written by hand", () => {
    const state = canvas([item("a", { parent: "b" }), item("b", { parent: "a" })]);
    expect(() => formatMoves(state)).not.toThrow();
  });

  it("does nothing to an empty canvas", () => {
    expect(formatMoves(canvas([]))).toEqual([]);
  });
});
