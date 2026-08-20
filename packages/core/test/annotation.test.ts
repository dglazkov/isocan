import { describe, expect, it } from "vitest";
import {
  annotationProperties,
  annotationRegion,
  annotationTarget,
  annotationTargetFor,
  annotationsOf,
  isAnnotation,
  regionOf,
} from "../src/index.ts";
import { apply, nv, seedState } from "./helpers.ts";

const ink = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });
const screen = { x: 100, y: 100, width: 400, height: 300 };

describe("regionOf", () => {
  it("says where the ink lands, in fractions of the target", () => {
    // Top-right quarter of the screen.
    expect(regionOf(ink(300, 100, 200, 150), screen)).toEqual({ x: 0.5, y: 0, width: 0.5, height: 0.5 });
  });

  it("clips ink that hangs over the edge, so a region is always ON the target", () => {
    const region = regionOf(ink(0, 0, 600, 500), screen)!;
    expect(region).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });

  it("survives a resize, because it is not in pixels", () => {
    const small = regionOf(ink(300, 100, 200, 150), screen);
    const doubled = regionOf(ink(500, 100, 400, 300), { x: 100, y: 100, width: 800, height: 600 });
    expect(doubled).toEqual(small);
  });
});

describe("annotation properties", () => {
  const state = (properties: Record<string, string>) => {
    const seeded = seedState();
    return apply(seeded, {
      type: "item.add",
      itemId: "itm_ink",
      version: { ...nv("ver_ink"), mimeType: "image/svg+xml", filename: "sketch.svg" },
      width: 50,
      height: 50,
      placement: { x: 0, y: 0 },
      properties,
    })!;
  };

  it("marks a drawing as being about an item", () => {
    const props = annotationProperties("itm_1", { x: 0.5, y: 0, width: 0.5, height: 0.5 });
    const after = state({ kind: "drawing", ...props });
    const item = after.canvas.items.itm_ink!;
    expect(isAnnotation(item)).toBe(true);
    expect(annotationTarget(item)).toBe("itm_1");
    expect(annotationRegion(item)).toEqual({ x: 0.5, y: 0, width: 0.5, height: 0.5 });
  });

  it("is only an annotation if it is ink — a note item pointing at something is not", () => {
    const after = state({ annotates: "itm_1" }); // no kind=drawing
    expect(isAnnotation(after.canvas.items.itm_ink!)).toBe(false);
  });

  it("a drawing with no target is just a drawing", () => {
    const after = state({ kind: "drawing" });
    expect(annotationTarget(after.canvas.items.itm_ink!)).toBeNull();
    expect(annotationRegion(after.canvas.items.itm_ink!)).toBeNull();
  });

  it("finds everything annotating an item — what travels with it, and what to clear", () => {
    const after = state({ kind: "drawing", ...annotationProperties("itm_1", { x: 0, y: 0, width: 1, height: 1 }) });
    expect(annotationsOf(after.canvas, "itm_1").map((i) => i.id)).toEqual(["itm_ink"]);
    expect(annotationsOf(after.canvas, "itm_2")).toEqual([]);
  });
});

describe("annotationTargetFor", () => {
  const items = seedState().canvas.items;
  const one = items.itm_1!; // 100,100 200x150 — 100..300 across, 100..250 down
  const two = items.itm_2!; // 500,120 300x200

  it("picks the item the ink is drawn over", () => {
    expect(annotationTargetFor(ink(140, 140, 80, 60), [one, two])?.id).toBe("itm_1");
  });

  it("leaves ink on bare canvas alone — a drawing is not a note about anything", () => {
    expect(annotationTargetFor(ink(1200, 1200, 100, 80), [one, two])).toBeNull();
  });

  it("needs a real share of the ink, not a clipped corner", () => {
    // 400 square units of overlap against 90,000 of ink: this is a drawing
    // that happens to touch the item, not a note about it.
    expect(annotationTargetFor(ink(280, 230, 300, 300), [one, two])).toBeNull();
  });

  it("takes the one it covers most when two are under it", () => {
    const overlapping = { ...two, x: 150, y: 130, width: 300, height: 200 };
    const chosen = annotationTargetFor(ink(200, 180, 100, 80), [one, overlapping]);
    expect(chosen?.id).toBe("itm_2");
  });
});
