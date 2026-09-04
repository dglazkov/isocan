import { describe, expect, it } from "vitest";
import type { CanvasContents, Item } from "../src/model.ts";
import { canvasItemOf } from "../src/canvasitem.ts";
import { designSystemProperties } from "../src/designsystem.ts";
import {
  contextLayers,
  governingDesign,
  inheritedPieces,
  layersReport,
  linkedCanvasId,
  memoryLinks,
  memoryOf,
  memoryPatch,
} from "../src/memory.ts";
import { contextReport } from "../src/context.ts";

/**
 * **Memory in layers** (`docs/projects/memory/design.md`, phases 0–1). The
 * link is a canvas card wearing `memory=inherit`; links compose in reading
 * order; a linked canvas contributes its design system, its pins and its
 * size; this canvas's own design system wins and the list says so; a
 * canvas that could not be read keeps its heading with the reason.
 */

const at = "2026-09-04T10:00:00.000Z";

function item(id: string, extra: Partial<Item> = {}): Item {
  return {
    id,
    title: id,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    createdAt: at,
    updatedAt: at,
    createdBy: { id: "usr_a", name: "A" },
    versions: [{ id: `ver_${id}`, blobHash: "h", mimeType: "text/plain", filename: `${id}.txt`, size: 1, createdAt: at, createdBy: { id: "usr_a", name: "A" } }],
    currentVersionId: `ver_${id}`,
    properties: {},
    reactions: {},
    ...extra,
  } as Item;
}

function canvas(items: Item[]): CanvasContents {
  return { items: Object.fromEntries(items.map((i) => [i.id, i])), threads: {}, edges: {} } as unknown as CanvasContents;
}

function card(id: string, canvasId: string, memory: string | null, x = 0, y = 0): Item {
  const made = canvasItemOf("https://isocan.io", canvasId);
  return item(id, {
    title: `Canvas ${canvasId}`,
    x,
    y,
    properties: { ...made.properties, ...(memory ? { memory } : {}) },
  });
}

describe("the link is one property on a canvas card", () => {
  it("reads inherit and personal, and nothing on a plain card or a non-card", () => {
    expect(memoryOf(card("c1", "prj_x", "inherit"))).toBe("inherit");
    expect(memoryOf(card("c2", "prj_x", "personal"))).toBe("personal");
    expect(memoryOf(card("c3", "prj_x", null))).toBeNull();
    expect(memoryOf(item("plain", { properties: { memory: "inherit" } }))).toBeNull();
    expect(linkedCanvasId(card("c1", "prj_x", "inherit"))).toBe("prj_x");
    expect(linkedCanvasId(card("c3", "prj_x", null))).toBeNull();
  });

  it("sets with a property and clears with removeProperties, like a pin", () => {
    expect(memoryPatch("inherit")).toEqual({ properties: { memory: "inherit" } });
    expect(memoryPatch(null)).toEqual({ removeProperties: ["memory"] });
  });

  it("orders links the way the room reads: top to bottom, then left to right", () => {
    const c = canvas([
      card("right", "prj_r", "inherit", 900, 0),
      card("below", "prj_b", "inherit", 0, 700),
      card("left", "prj_l", "inherit", 0, 0),
      card("plain", "prj_p", null, 0, 0),
    ]);
    expect(memoryLinks(c).map((i) => i.id)).toEqual(["left", "right", "below"]);
  });
});

describe("what a linked canvas contributes", () => {
  const design = item("DESIGN.md", { properties: designSystemProperties(), title: "Design system" });
  const pinned = item("brief", { properties: { context: "pinned" }, title: "The brief" });
  const linked = canvas([design, pinned, item("screen")]);
  const from = { canvasId: "prj_ds", title: "Design System" };

  it("its design system, its pins and its size — every piece saying where from", () => {
    const pieces = inheritedPieces(linked, from, false);
    expect(pieces.map((p) => p.name)).toEqual(["Design system", "Pinned items", "The canvas"]);
    expect(pieces.every((p) => p.from?.canvasId === "prj_ds")).toBe(true);
    expect(pieces[1]!.size).toBe("The brief");
    expect(pieces[2]!.size).toBe("3 items");
    expect(pieces[0]!.overridden).toBeUndefined();
  });

  it("is struck, not hidden, when this canvas's own design system wins", () => {
    const pieces = inheritedPieces(linked, from, true);
    expect(pieces[0]!.overridden).toBe("this canvas's wins");
    expect(contextReport(pieces, Date.parse(at))).toContain("(this canvas's wins)");
  });

  it("contributes no design row when it has none, and no pins row when it has none", () => {
    const bare = canvas([item("one")]);
    expect(inheritedPieces(bare, from, false).map((p) => p.name)).toEqual(["The canvas"]);
  });
});

describe("the layers, and the design system that governs", () => {
  const design = item("DESIGN.md", { properties: designSystemProperties() });
  const ds = canvas([design]);
  const here = canvas([card("link", "prj_ds", "inherit"), item("screen")]);

  it("this canvas first, then a heading per link, a refused link keeping its heading", () => {
    const layers = contextLayers(here, [
      { item: here.items["link"]!, canvasId: "prj_ds", title: "Design System", canvas: ds },
      { item: here.items["link"]!, canvasId: "prj_far", title: "Far away", canvas: null, refused: "lives at other.example — not read from here" },
    ]);
    expect(layers.map((l) => l.heading)).toEqual(["This canvas", "Design System", "Far away"]);
    expect(layers[0]!.canvasId).toBeNull();
    expect(layers[1]!.pieces[0]!.name).toBe("Design system");
    expect(layers[2]!.refused).toContain("lives at");
    const text = layersReport(layers, (pieces) => contextReport(pieces, Date.parse(at)));
    expect(text).toContain("Design System — inherited (prj_ds)");
    expect(text).toContain("  lives at other.example");
  });

  it("the inherited design system governs when this canvas has none, and says whose", () => {
    const linked = [{ item: here.items["link"]!, canvasId: "prj_ds", title: "Design System", canvas: ds }];
    expect(governingDesign(here, linked)?.from?.title).toBe("Design System");
    const own = canvas([card("link", "prj_ds", "inherit"), item("DESIGN.md", { properties: designSystemProperties() })]);
    expect(governingDesign(own, linked)?.from).toBeNull();
    expect(governingDesign(canvas([item("x")]), [])).toBeNull();
  });
});
