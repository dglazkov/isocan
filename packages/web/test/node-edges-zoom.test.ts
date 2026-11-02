import { describe, expect, it } from "vitest";
import type { CanvasContents, Item } from "@isocan/core";
import {
  EDGE_ZOOM_MIN,
  Z_ROOMY,
  edgesShownAtZoom,
  zoomDecisions,
  type ZoomHeld,
} from "../src/lib/chrome.ts";
import { previewedCanvas } from "../src/lib/presentation.ts";
import { NodeEdgesUnderlay } from "../src/components/NodeEdgesUnderlay.tsx";

const actor = { id: "usr_a", name: "Alice" };
const stamp = {
  createdAt: "2026-01-01T00:00:00Z",
  createdBy: actor,
  updatedAt: "2026-01-01T00:00:00Z",
  updatedBy: actor,
};

function makeScreenItem(id = "s1", x = 0, y = 0, properties: Record<string, string> = {}, width = 320, height = 240): Item {
  return {
    id,
    title: "Checkout Screen",
    description: "",
    x,
    y,
    width,
    height,
    properties,
    currentVersionId: `ver_${id}`,
    versions: [
      {
        id: `ver_${id}`,
        blobHash: `hash_${id}`,
        mimeType: "text/html",
        filename: `${id}.html`,
        size: 28,
        createdAt: "2026-01-01T00:00:00Z",
        createdBy: actor,
      },
    ],
    ...stamp,
  };
}

describe("zoom visibility for node content and directional edges", () => {
  it("shows directional edges down to EDGE_ZOOM_MIN with hysteresis", () => {
    expect(EDGE_ZOOM_MIN).toBeGreaterThan(0);
    expect(edgesShownAtZoom(1.0, true)).toBe(true);
    expect(edgesShownAtZoom(0.15, true)).toBe(true);
    expect(edgesShownAtZoom(0.04, true)).toBe(false);

    expect(edgesShownAtZoom(0.084, true)).toBe(true);
    expect(edgesShownAtZoom(0.084, false)).toBe(false);
  });

  it("governs item content room by screen size (width * scale, height * scale), never raw scale", () => {
    const slide = makeScreenItem("slide", 0, 0, {}, 1600, 900);
    const held: ZoomHeld = {};

    // At scale = 0.20, a 1600x900 slide is 320x180 screen pixels and must stay roomy.
    const slideAt20 = zoomDecisions(slide, slide.width, slide.height, 0.20, held);
    expect((slideAt20 & Z_ROOMY) !== 0).toBe(true);

    // At scale = 0.20, a small 160x90 item is 32x18 screen pixels (< 56x40) and drops roomy.
    const small = makeScreenItem("small", 0, 0, {}, 160, 90);
    const smallAt20 = zoomDecisions(small, small.width, small.height, 0.20, {});
    expect((smallAt20 & Z_ROOMY) !== 0).toBe(false);
  });

  it("folds live drag and renders directional SVG edges via NodeEdgesUnderlay", () => {
    const s1 = makeScreenItem("s1", 0, 0, { "edge:next": "s2", "edge:next:label": "Checkout" });
    const s2 = makeScreenItem("s2", 500, 0);
    const canvas: CanvasContents = {
      items: { s1, s2 },
      threads: {},
      trash: [],
    };

    const dragged = previewedCanvas(canvas, { itemIds: ["s1"], dx: 40, dy: 25 });
    expect(dragged.items.s1?.x).toBe(40);
    expect(dragged.items.s1?.y).toBe(25);
    expect(dragged.items.s2?.x).toBe(500);

    const el = NodeEdgesUnderlay({ canvas: dragged });
    expect(el).not.toBeNull();
  });
});
