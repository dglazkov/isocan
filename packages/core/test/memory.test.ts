import { describe, expect, it } from "vitest";
import type { CanvasContents, Item } from "../src/model.ts";
import { canvasItemOf } from "../src/canvasitem.ts";
import { designSystemProperties } from "../src/designsystem.ts";
import {
  CONTEXT_SHEET_SIZE,
  contextLayers,
  contextLayerKey,
  contextSheet,
  contextSheetSpot,
  governingDesign,
  inheritedPieces,
  layersReport,
  linkedCanvasId,
  memoryLinks,
  memoryOf,
  memoryPatch,
  personalMemoryLinks,
  personalContributions,
  personalCanvasItemOf,
} from "../src/memory.ts";
import { contextReport } from "../src/context.ts";
import { formatRecapHead, type RecapHeadResponse } from "../src/recap-head.ts";

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

  it("excludes inheritance edges by their own or an ancestor's ambient policy", () => {
    const parent = item("parent", { properties: { kind: "group", context: "excluded" } });
    const nested = item("nested", { containerId: parent.id, properties: { kind: "group" } });
    const child = { ...card("child", "prj_child", "inherit"), containerId: nested.id };
    const direct = card("direct", "prj_direct", "inherit");
    direct.properties.context = "excluded";
    const visible = card("visible", "prj_visible", "inherit");
    const c = canvas([parent, nested, child, direct, visible]);
    expect(memoryLinks(c).map((one) => one.id)).toEqual([visible.id]);
    delete parent.properties.context;
    expect(memoryLinks(c).map((one) => one.id)).toEqual([child.id, visible.id]);
    expect(memoryOf(child)).toBe("inherit");
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

  it("renders the authoritative head through the shared report and preserves pieces on a failed head", () => {
    const response: RecapHeadResponse = { canvasId: from.canvasId, home: "https://acme.invalid", title: "Current source label", revision: 120,
      head: { fromSeq: 21, toSeq: 120, fromTs: at, toTs: at, count: 100, comments: 4,
        actors: [{ name: "Acme", ops: 100 }], items: [{ id: "brief", title: "The brief", ops: 90 }],
        omitted: { earlierAvailableOps: 20, actors: 1, items: 2, hiddenItems: 3, clippedLabels: 1 } } };
    const pieces = inheritedPieces(linked, from, true, { value: response });
    expect(pieces.find((piece) => piece.name === "Recent work")).toMatchObject({ present: true, recap: response, from: { canvasId: from.canvasId, title: response.title } });
    const report = contextReport(pieces, Date.parse(at));
    expect(report).toContain(formatRecapHead(response.head));
    expect(report).toContain("earlier available operations");
    expect(report).toContain("(this canvas's wins)");
    const failed = inheritedPieces(linked, from, true, { refused: "Required history is unavailable" });
    expect(failed.find((piece) => piece.name === "Recent work")).toMatchObject({ present: false, stale: "Required history is unavailable" });
    expect(failed.filter((piece) => piece.name !== "Recent work")).toEqual(inheritedPieces(linked, from, true));
    expect(contextReport(failed, Date.parse(at))).toContain("Required history is unavailable");
  });
});

describe("the Context sheet, a convention with one name", () => {
  it("is any sheet titled Context, and none when there is none", () => {
    const sheet = item("sheet", { title: "Context", properties: { kind: "area" }, width: 1600, height: 1000 });
    expect(contextSheet(canvas([sheet, item("x")]))?.id).toBe("sheet");
    expect(contextSheet(canvas([{ ...sheet, properties: { kind: "group" } }]))?.id).toBe("sheet");
    expect(contextSheet(canvas([item("Context")]))).toBeNull();
  });

  it("is laid at the origin when the origin is clear, else to the left of everything", () => {
    expect(contextSheetSpot(canvas([]))).toEqual({ x: 0, y: 0 });
    expect(contextSheetSpot(canvas([item("far", { x: 3000, y: 200 })]))).toEqual({ x: 0, y: 0 });
    const spot = contextSheetSpot(canvas([item("near", { x: 100, y: 50, width: 400, height: 300 })]));
    expect(spot).toEqual({ x: 100 - 40 - CONTEXT_SHEET_SIZE.width, y: 50 });
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
    expect(layers.map((l) => l.kind)).toEqual(["local", "inherited", "inherited"]);
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

describe("personal contributions are a separate, explicitly owned layer", () => {
  it("constructs a shared card from an owner label and address without accepting private preview metadata", () => {
    const card = personalCanvasItemOf("https://acme.invalid", "prj_memory", { name: "Maya" });
    expect(card.title).toBe("Maya's canvas");
    expect(card.properties).toEqual({
      kind: "canvas", canvas: "prj_memory", source: "https://acme.invalid/p/prj_memory", memory: "personal",
    });
    expect(card.blob).toBe("https://acme.invalid/p/prj_memory\n");
  });

  it("finds personal candidates in reading order while excluded ancestors remove edges", () => {
    const group = item("group", { properties: { kind: "group", context: "excluded" } });
    const hidden = { ...card("hidden", "prj_secret", "personal"), containerId: group.id };
    const visible = card("visible", "prj_self", "personal", 0, 500);
    const first = card("first", "prj_self", "personal", 0, 0);
    const c = canvas([group, hidden, visible, first, card("inherited", "prj_library", "inherit")]);
    expect(personalMemoryLinks(c).map(({ id }) => id)).toEqual(["first", "visible"]);
    expect(memoryLinks(c).map(({ id }) => id)).toEqual(["inherited"]);
  });

  it("selects design and contributed pins once, excluding ancestors and refusing missing current versions", () => {
    const design = item("design", { properties: { ...designSystemProperties(), context: "pinned" } });
    const group = item("group", { properties: { kind: "group", context: "pinned" } });
    const pin = item("pin", { containerId: group.id, properties: { context: "pinned" } });
    const missing = item("missing", { properties: { context: "pinned" }, currentVersionId: "ver_gone" });
    const hiddenGroup = item("hidden", { properties: { kind: "group", context: "excluded" } });
    const hiddenPin = item("secret", { containerId: hiddenGroup.id, properties: { context: "pinned" } });
    const c = canvas([design, group, pin, missing, hiddenGroup, hiddenPin, item("unrelated")]);
    const contributed = personalContributions(c);
    expect(contributed.map(({ kind, item }) => [kind, item.id])).toEqual([
      ["design", "design"], ["pin", "group"], ["pin", "pin"], ["pin", "missing"],
    ]);
    expect(contributed.find(({ item }) => item.id === "pin")?.version?.id).toBe(pin.currentVersionId);
    expect(contributed.find(({ item }) => item.id === "missing")?.version).toBeNull();
    design.properties.context = "excluded";
    expect(personalContributions(c).some(({ item }) => item.id === "design")).toBe(false);
  });

  it("labels personal provenance without giving it inherited governing authority or collapsing repeated links", () => {
    const c = canvas([]);
    const local = contextLayers(c, []);
    const personal = {
      kind: "personal" as const, canvasId: "prj_personal", itemId: "itm_link",
      owner: { id: "usr_maya", name: "Maya" }, heading: "Maya's canvas", pieces: [],
    };
    expect(layersReport([...local, personal], contextReport)).toContain("Maya's canvas — personal (prj_personal)");
    expect(layersReport([{ ...personal, refused: "Not delegated" }], contextReport)).toContain("Not delegated");
    expect(contextLayerKey(personal)).not.toEqual(contextLayerKey({ ...personal, itemId: "itm_other" }));
    expect(contextLayerKey(personal)).not.toEqual(contextLayerKey({ ...personal, kind: "inherited" }));
    expect(governingDesign(c, [])).toBeNull();
  });
});
