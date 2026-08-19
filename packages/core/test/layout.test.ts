import { describe, expect, it } from "vitest";
import { alignMoves, distributeMoves, itemKind, type LayoutBox } from "../src/index.ts";
import { apply, nv, seedState } from "./helpers.ts";

const box = (id: string, x: number, y: number, width = 100, height = 60): LayoutBox => ({
  id,
  x,
  y,
  width,
  height,
});

describe("alignMoves", () => {
  const boxes = [box("a", 0, 0), box("b", 40, 100, 200, 60), box("c", 90, 200)];

  it("aligns to the group's own leftmost edge", () => {
    expect(alignMoves(boxes, "left")).toEqual([
      { itemId: "b", x: 0, y: 100 },
      { itemId: "c", x: 0, y: 200 },
    ]);
  });

  it("aligns right edges, which means different x for different widths", () => {
    // The group's right edge is b's: 40 + 200 = 240.
    expect(alignMoves(boxes, "right")).toEqual([
      { itemId: "a", x: 140, y: 0 },
      { itemId: "c", x: 140, y: 200 },
    ]);
  });

  it("centers on the group's middle", () => {
    const moves = alignMoves([box("a", 0, 0), box("b", 100, 100)], "hcenter");
    expect(moves).toEqual([
      { itemId: "a", x: 50, y: 0 },
      { itemId: "b", x: 50, y: 100 },
    ]);
  });

  it("aligns tops and bottoms down the other axis", () => {
    expect(alignMoves([box("a", 0, 0), box("b", 0, 90)], "top")).toEqual([{ itemId: "b", x: 0, y: 0 }]);
    expect(alignMoves([box("a", 0, 0), box("b", 0, 90)], "bottom")).toEqual([{ itemId: "a", x: 0, y: 90 }]);
  });

  it("moves nothing when everything is already aligned", () => {
    expect(alignMoves([box("a", 5, 0), box("b", 5, 80)], "left")).toEqual([]);
  });

  it("has nothing to say about a single item", () => {
    expect(alignMoves([box("a", 0, 0)], "left")).toEqual([]);
  });
});

describe("distributeMoves", () => {
  it("makes the GAPS equal, not the centers", () => {
    // Widths 100, 200, 100 across a span from 0 to 800: 400 of gap over two
    // gaps, so 200 each. Centers would land the wide one somewhere else.
    const moves = distributeMoves([box("a", 0, 0), box("wide", 150, 0, 200, 60), box("c", 700, 0)], "h");
    expect(moves).toEqual([{ itemId: "wide", x: 300, y: 0 }]);
  });

  it("holds the outermost two still — they define the run", () => {
    const moves = distributeMoves([box("a", 0, 0), box("b", 10, 0), box("c", 900, 0)], "h");
    expect(moves.map((m) => m.itemId)).toEqual(["b"]);
  });

  it("works vertically", () => {
    const moves = distributeMoves([box("a", 0, 0), box("b", 0, 10), box("c", 0, 400)], "v");
    // Heights 60 each over a 460 span: 280 of gap over two gaps = 140 each.
    expect(moves).toEqual([{ itemId: "b", x: 0, y: 200 }]);
  });

  it("needs three to have anything to space", () => {
    expect(distributeMoves([box("a", 0, 0), box("b", 500, 0)], "h")).toEqual([]);
  });

  it("takes the order from position, not from the order it was handed", () => {
    const jumbled = [box("c", 700, 0), box("a", 0, 0), box("b", 150, 0)];
    expect(distributeMoves(jumbled, "h")).toEqual([{ itemId: "b", x: 350, y: 0 }]);
  });
});

describe("itemKind", () => {
  it("calls the Pen's output a drawing, not just an image", () => {
    let state = seedState();
    state = apply(state, {
      type: "item.add",
      itemId: "itm_ink",
      version: { ...nv("ver_ink"), mimeType: "image/svg+xml", filename: "sketch.svg" },
      width: 10,
      height: 10,
      placement: { x: 0, y: 0 },
      properties: { kind: "drawing" },
    })!;
    expect(itemKind(state.canvas.items.itm_ink!)).toBe("drawing");
  });

  it("reads the kind off the current version's mime type", () => {
    let state = seedState();
    state = apply(state, {
      type: "item.add",
      itemId: "itm_png",
      version: { ...nv("ver_png"), mimeType: "image/png", filename: "shot.png" },
      width: 10,
      height: 10,
      placement: { x: 0, y: 0 },
    })!;
    expect(itemKind(state.canvas.items.itm_png!)).toBe("image");
    expect(itemKind(state.canvas.items.itm_1!)).toBe("document"); // text/markdown
  });

  it("knows a projected site from the blob that names it", () => {
    let state = seedState();
    state = apply(state, {
      type: "item.add",
      itemId: "itm_site",
      version: { ...nv("ver_site"), mimeType: "text/uri-list", filename: "localhost-5173.uri" },
      width: 10,
      height: 10,
      placement: { x: 0, y: 0 },
    })!;
    expect(itemKind(state.canvas.items.itm_site!)).toBe("site");
  });
});
