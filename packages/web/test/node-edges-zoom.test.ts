import { describe, expect, it } from "vitest";
import type { CanvasContents, Item } from "@isocan/core";
import {
  CONTENT_ZOOM_MIN,
  EDGE_ZOOM_MIN,
  Z_CONTENT,
  Z_EDGES,
  contentShownAtZoom,
  edgesShownAtZoom,
  zoomBandAt,
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

function makeScreenItem(id = "s1", x = 0, y = 0, properties: Record<string, string> = {}): Item {
  return {
    id,
    title: "Checkout Screen",
    description: "",
    x,
    y,
    width: 320,
    height: 240,
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

describe("3-band zoom visibility for node content and edges", () => {
  it("orders thresholds so CONTENT_ZOOM_MIN > EDGE_ZOOM_MIN", () => {
    expect(CONTENT_ZOOM_MIN).toBeGreaterThan(EDGE_ZOOM_MIN);
    expect(EDGE_ZOOM_MIN).toBeGreaterThan(0);
  });

  it("classifies close, farther, and furthest zoom bands", () => {
    const closeBand = zoomBandAt(1.0);
    expect(closeBand).toBe("close");
    expect(contentShownAtZoom(1.0, true)).toBe(true);
    expect(edgesShownAtZoom(1.0, true)).toBe(true);

    const fartherBand = zoomBandAt(0.15);
    expect(fartherBand).toBe("farther");
    expect(contentShownAtZoom(0.15, true)).toBe(false);
    expect(edgesShownAtZoom(0.15, true)).toBe(true);

    const furthestBand = zoomBandAt(0.04);
    expect(furthestBand).toBe("furthest");
    expect(contentShownAtZoom(0.04, false)).toBe(false);
    expect(edgesShownAtZoom(0.04, true)).toBe(false);
  });

  it("applies hysteresis around CONTENT_ZOOM_MIN and EDGE_ZOOM_MIN", () => {
    expect(contentShownAtZoom(0.26, true)).toBe(true);
    expect(contentShownAtZoom(0.26, false)).toBe(false);

    expect(edgesShownAtZoom(0.084, true)).toBe(true);
    expect(edgesShownAtZoom(0.084, false)).toBe(false);
  });

  it("encodes Z_CONTENT and Z_EDGES bits in zoomDecisions across the 3 zoom bands", () => {
    const item = makeScreenItem();
    const held: ZoomHeld = { r: true, t: true, s: false, g: false, c: true, e: true };

    const closeMask = zoomDecisions(item, 320, 240, 1.0, held);
    expect((closeMask & Z_CONTENT) !== 0).toBe(true);
    expect((closeMask & Z_EDGES) !== 0).toBe(true);

    const fartherMask = zoomDecisions(item, 320, 240, 0.15, held);
    expect((fartherMask & Z_CONTENT) !== 0).toBe(false);
    expect((fartherMask & Z_EDGES) !== 0).toBe(true);

    const furthestMask = zoomDecisions(item, 320, 240, 0.04, held);
    expect((furthestMask & Z_CONTENT) !== 0).toBe(false);
    expect((furthestMask & Z_EDGES) !== 0).toBe(false);
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
