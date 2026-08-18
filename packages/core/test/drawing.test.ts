import { describe, expect, it } from "vitest";
import {
  DRAWING_KIND,
  INK_PADDING,
  drawingSvg,
  inkBounds,
  inkPath,
  isDrawingItem,
  type InkStroke,
} from "../src/index.ts";
import { apply, seedState } from "./helpers.ts";
import { nv } from "./helpers.ts";

function stroke(points: Array<[number, number]>, width = 4, color = "#c93a55"): InkStroke {
  return { points: points.map(([x, y]) => ({ x, y })), color, width };
}

describe("inkBounds", () => {
  it("is null when there is nothing to draw", () => {
    expect(inkBounds([])).toBeNull();
    expect(inkBounds([stroke([])])).toBeNull();
  });

  it("grows the box by half the stroke width and the padding", () => {
    const bounds = inkBounds([stroke([[100, 100], [140, 180]], 4)])!;
    expect(bounds).toEqual({
      minX: 100 - 2 - INK_PADDING,
      minY: 100 - 2 - INK_PADDING,
      maxX: 140 + 2 + INK_PADDING,
      maxY: 180 + 2 + INK_PADDING,
    });
  });

  it("spans every stroke, each with its own weight", () => {
    const bounds = inkBounds([stroke([[0, 0]], 2), stroke([[50, 20]], 10)])!;
    expect(bounds.minX).toBe(0 - 1 - INK_PADDING);
    expect(bounds.maxX).toBe(50 + 5 + INK_PADDING);
  });
});

describe("inkPath", () => {
  it("draws nothing from no points", () => {
    expect(inkPath([])).toBe("");
  });

  it("draws a dot from one point: a hair under a round cap", () => {
    expect(inkPath([{ x: 10, y: 20 }])).toBe("M 10 20 l 0.01 0");
  });

  it("draws a straight line from two points", () => {
    expect(inkPath([{ x: 0, y: 0 }, { x: 10, y: 5 }])).toBe("M 0 0 L 10 5");
  });

  it("smooths three or more points through midpoint quadratics", () => {
    const d = inkPath([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 10 }]);
    // Control point = the sample; the curve ends at the midpoint of the pair,
    // then runs out to the last sample.
    expect(d).toBe("M 0 0 Q 10 0 15 5 L 20 10");
  });

  it("rounds to two decimals so a long stroke stays small", () => {
    expect(inkPath([{ x: 1.23456, y: 2 }, { x: 3, y: 4.98765 }])).toBe("M 1.23 2 L 3 4.99");
  });
});

describe("drawingSvg", () => {
  const strokes = [stroke([[100, 100], [140, 180]], 4), stroke([[110, 120]], 4, "#0f8a80")];
  const svg = drawingSvg(strokes, inkBounds(strokes)!);

  it("puts the world box in the viewBox, so ink sits where it was drawn", () => {
    expect(svg).toContain('viewBox="90 90 60 100"');
    expect(svg).toContain('width="60" height="100"');
  });

  it("writes one path per stroke, in that stroke's color and weight", () => {
    expect(svg.match(/<path /g)).toHaveLength(2);
    expect(svg).toContain('stroke="#c93a55"');
    expect(svg).toContain('stroke="#0f8a80"');
    expect(svg).toContain('stroke-width="4"');
  });

  it("skips strokes with no points", () => {
    const withEmpty = [stroke([[0, 0], [10, 10]]), stroke([])];
    expect(drawingSvg(withEmpty, inkBounds(withEmpty)!).match(/<path /g)).toHaveLength(1);
  });

  it("only lets a literal hex color into the markup", () => {
    const bogus = [stroke([[0, 0], [10, 10]], 4, '" onload="alert(1)')];
    const out = drawingSvg(bogus, inkBounds(bogus)!);
    expect(out).not.toContain("onload");
    expect(out).toContain('stroke="#23262b"');
  });
});

describe("isDrawingItem", () => {
  it("recognizes a drawing by its kind, not by its mime type", () => {
    let state = seedState();
    state = apply(state, {
      type: "item.add",
      itemId: "itm_ink",
      version: { ...nv("ver_ink"), mimeType: "image/svg+xml", filename: "sketch.svg" },
      width: 60,
      height: 100,
      placement: { x: 90, y: 90 },
      title: "Sketch",
      properties: { kind: DRAWING_KIND },
    })!;
    expect(isDrawingItem(state.canvas.items.itm_ink!)).toBe(true);
    // An SVG someone merely uploaded is not ink from the Pen.
    expect(isDrawingItem(state.canvas.items.itm_1!)).toBe(false);
  });
});
