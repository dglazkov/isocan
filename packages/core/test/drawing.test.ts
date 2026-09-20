import { describe, expect, it } from "vitest";
import { drawingViewBox,
  DRAWING_KIND,
  inkColour,
  inkFromSvg,
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

describe("reading a drawing's world box back", () => {
  it("returns the viewBox drawingSvg wrote", () => {
    const strokes = [{ points: [{ x: 10, y: 20 }, { x: 40, y: 60 }], color: "#0f8a80", width: 3 }];
    const bounds = inkBounds(strokes)!;
    expect(drawingViewBox(drawingSvg(strokes, bounds))).toEqual(bounds);
  });

  it("reads a comma-separated viewBox, which is legal SVG", () => {
    expect(drawingViewBox('<svg viewBox="0,10,100,50"/>')).toEqual({
      minX: 0, minY: 10, maxX: 100, maxY: 60,
    });
  });

  it("says no rather than guessing", () => {
    // Placement depends on this answer: a wrong box puts the strokes
    // somewhere other than where they were drawn.
    for (const svg of ['<svg/>', '<svg viewBox="0 0 100"/>', '<svg viewBox="a b c d"/>', '<svg viewBox="0 0 0 50"/>']) {
      expect(drawingViewBox(svg), svg).toBeNull();
    }
  });
});

/**
 * **The inverse, held to being an inverse.**
 *
 * `inkFromSvg` exists so the CLI's drawing paths — handed an SVG rather than
 * strokes — can still record what colour the ink is. Its only real obligation
 * is that it agrees with the writer, so the test is the round trip: whatever
 * `inkColour` said about the strokes it must still say after they have been
 * through `drawingSvg` and back.
 */
describe("ink read back out of the SVG it was written into", () => {
  const run = (color: string, length: number, y = 0): InkStroke => ({
    color,
    width: 6,
    points: [{ x: 0, y }, { x: length / 2, y }, { x: length, y }],
  });
  const roundTrip = (strokes: InkStroke[]) =>
    inkFromSvg(drawingSvg(strokes, inkBounds(strokes)!));

  it("agrees with the writer about the colour, which is the whole job", () => {
    for (const hex of ["#e02424", "#1d4ed8", "#16a34a", "#000000"]) {
      const strokes = [run(hex, 200)];
      expect(inkColour(roundTrip(strokes))).toBe(inkColour(strokes));
    }
  });

  it("keeps which colour covered the most ground, not merely which colours appear", () => {
    // The ordering is the part an approximation could break: on-curve points
    // make the polyline a little short, and it must shorten every stroke the
    // same way or the winner could change.
    const strokes = [run("#1d4ed8", 40), run("#e02424", 400, 50)];
    expect(inkColour(strokes)).toBe("red");
    expect(inkColour(roundTrip(strokes))).toBe("red");
  });

  it("reads a dot as a dot, so a canvas of dots is not silent", () => {
    const dot: InkStroke = { color: "#e02424", width: 8, points: [{ x: 5, y: 5 }] };
    const back = roundTrip([dot]);
    expect(back[0]!.points).toHaveLength(1);
    expect(inkColour(back)).toBe("red");
  });

  it("carries the stroke width back, because a dot is measured by it", () => {
    expect(roundTrip([run("#e02424", 200)])[0]!.width).toBe(6);
  });

  it("says nothing about an SVG this canvas did not draw", () => {
    // A guessed colour is worse than none: an <svg> of rects and text is not
    // ink, and must not come back as a confident word.
    expect(inkFromSvg('<svg><rect width="10" height="10" fill="#e02424"/></svg>')).toEqual([]);
    expect(inkFromSvg("not markup at all")).toEqual([]);
    expect(inkColour(inkFromSvg('<svg><path d="M 0 0 L 9 9"/></svg>'))).toBeNull();
  });

  it("stops where understanding stops rather than reading past a command it does not know", () => {
    // An arc's numbers are flags and radii, not coordinates; reading them as
    // points would invent a stroke that covers the canvas.
    const read = inkFromSvg('<svg><path d="M 0 0 L 10 0 A 5 5 0 0 1 90 90" stroke="#e02424" stroke-width="2"/></svg>');
    expect(read[0]!.points).toEqual([{ x: 0, y: 0 }, { x: 10, y: 0 }]);
  });
});
