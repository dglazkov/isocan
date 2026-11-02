import { describe, expect, it } from "vitest";
import { LIVE_DRAG_MAX_ROOTS, presenceDrag } from "../src/live-drag.ts";

const drag = { gesture: "g1", roots: ["itm_a"], from: { x: 10, y: 20 }, dx: 4.5, dy: -2 };

describe("presenceDrag — a client's word for its drag, kept only when it is one", () => {
  it("keeps a well-formed drag, into and box included", () => {
    expect(presenceDrag(drag)).toEqual(drag);
    expect(presenceDrag({ ...drag, into: null })).toEqual({ ...drag, into: null });
    expect(presenceDrag({ ...drag, into: "grp_1" })?.into).toBe("grp_1");
    const box = { x: 0, y: 0, width: 900, height: 400 };
    expect(presenceDrag({ ...drag, box })?.box).toEqual(box);
  });

  it("drops what it does not recognise rather than relaying it", () => {
    expect(presenceDrag(undefined)).toBeNull();
    expect(presenceDrag(null)).toBeNull();
    expect(presenceDrag("drag")).toBeNull();
    expect(presenceDrag({ ...drag, gesture: "" })).toBeNull();
    expect(presenceDrag({ ...drag, roots: [] })).toBeNull();
    expect(presenceDrag({ ...drag, roots: [7] })).toBeNull();
    expect(presenceDrag({ ...drag, dx: Number.NaN })).toBeNull();
    expect(presenceDrag({ ...drag, from: { x: 1 } })).toBeNull();
    expect(presenceDrag({ ...drag, into: 5 })).toBeNull();
    expect(presenceDrag({ ...drag, box: { x: 0, y: 0, width: -1, height: 2 } })).toBeNull();
    // Extra fields are not carried along.
    expect(presenceDrag({ ...drag, secret: "x" })).not.toHaveProperty("secret");
  });

  it("refuses a roots list past the box threshold — a big selection is sent as a box", () => {
    const many = Array.from({ length: LIVE_DRAG_MAX_ROOTS + 1 }, (_, i) => `itm_${i}`);
    expect(presenceDrag({ ...drag, roots: many })).toBeNull();
    expect(presenceDrag({ ...drag, roots: many.slice(0, LIVE_DRAG_MAX_ROOTS) })?.roots).toHaveLength(LIVE_DRAG_MAX_ROOTS);
  });
});
