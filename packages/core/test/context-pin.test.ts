import { describe, expect, it } from "vitest";
import type { CanvasContents, Item } from "../src/model.ts";
import { canvasItemOf } from "../src/canvasitem.ts";
import { designSystem, designSystemProperties, withoutDesignRole } from "../src/designsystem.ts";
import { CONTEXT_PROP } from "../src/contextmark.ts";
import { contextPieces, contextReport, formatContextSource } from "../src/context.ts";
import { contextPinDecoration, contextSourceProperty, resolveSourcePinPiece, sourcePinPieces } from "../src/context-pin.ts";
import {
  CONTEXT_SOURCE_PROP,
  contextSourceOf,
  copiedContextItems,
  parseContextSource,
  type ContextSource,
} from "../src/context-source.ts";
import { groupCopyAction, groupCopySource } from "../src/canvas-group-copy.ts";

/**
 * **Copy a source piece into a local pin** (memory phase 6,
 * `docs/projects/memory/pin-from-source.md`). Core owns two questions here:
 * what a source offers, and what a copied item wears afterwards. Every name
 * below is synthetic (AGENTS.md).
 */

const at = "2026-09-18T10:00:00.000Z";

function item(id: string, extra: Partial<Item> = {}): Item {
  return {
    id, title: id, x: 0, y: 0, width: 100, height: 100,
    createdAt: at, updatedAt: at, createdBy: { id: "usr_theo", name: "Theo" },
    properties: {}, reactions: {},
    versions: [{ id: `ver_${id}`, blobHash: `hash_${id}`, mimeType: "text/markdown", filename: `${id}.md`, size: 4, createdAt: at, createdBy: { id: "usr_theo", name: "Theo" } }],
    currentVersionId: `ver_${id}`,
    ...extra,
  } as unknown as Item;
}

const canvasOf = (items: Item[]): CanvasContents =>
  ({ items: Object.fromEntries(items.map((one) => [one.id, one])), threads: {}, trash: [] }) as unknown as CanvasContents;

const group = (id: string, extra: Partial<Item> = {}) => item(id, { properties: { kind: "group" }, ...extra });

/** A copy action's creations carry optional properties; every assertion here
 *  is about what they SAY, so an absent bag reads as an empty one. */
const props = (creation: { properties?: Record<string, string> }): Record<string, string> => creation.properties ?? {};

const source: ContextSource = {
  home: "https://acme.invalid", canvasId: "prj_design", canvasTitle: "Acme Design System",
  itemId: "itm_checklist", itemTitle: "Review checklist", versionId: "ver_itm_checklist",
};

describe("what an inherited source offers", () => {
  it("offers its current design and its ambient pins, and nothing else on the canvas", () => {
    const canvas = canvasOf([
      item("itm_design", { title: "Acme DESIGN.md", properties: designSystemProperties() }),
      item("itm_checklist", { title: "Review checklist", y: 10, properties: { [CONTEXT_PROP]: "pinned" } }),
      // Ordinary work in progress: a picker that listed this would be a file
      // browser into somebody else's project.
      item("itm_draft", { title: "Acme draft", y: 20 }),
    ]);
    expect(sourcePinPieces(canvas).map((piece) => [piece.kind, piece.title, piece.count, piece.refused])).toEqual([
      ["design", "Acme DESIGN.md", 1, undefined],
      ["pin", "Review checklist", 1, undefined],
    ]);
  });

  it("counts a pinned group's whole closure, root included, before anybody presses the button", () => {
    const canvas = canvasOf([
      group("itm_pack", { title: "Acme review pack", properties: { kind: "group", [CONTEXT_PROP]: "pinned" } }),
      item("itm_one", { title: "Acme step one", containerId: "itm_pack" }),
      item("itm_two", { title: "Acme step two", containerId: "itm_pack", y: 10 }),
    ]);
    expect(sourcePinPieces(canvas)[0]).toMatchObject({ title: "Acme review pack", count: 3 });
  });

  it("keeps an excluded pin and a pin under an excluded ancestor off the list entirely", () => {
    const canvas = canvasOf([
      item("itm_secret", { title: "Acme secret", properties: { [CONTEXT_PROP]: "excluded" } }),
      group("itm_shelf", { title: "Acme shelf", y: 10, properties: { kind: "group", [CONTEXT_PROP]: "excluded" } }),
      item("itm_inside", { title: "Acme inside", y: 20, containerId: "itm_shelf", properties: { [CONTEXT_PROP]: "pinned" } }),
    ]);
    expect(sourcePinPieces(canvas)).toEqual([]);
  });

  it("refuses a whole closure that holds an excluded child, a missing version or a canvas link", () => {
    const excluded = canvasOf([
      group("itm_pack", { title: "Acme pack", properties: { kind: "group", [CONTEXT_PROP]: "pinned" } }),
      item("itm_kept", { title: "Acme kept out", containerId: "itm_pack", properties: { [CONTEXT_PROP]: "excluded" } }),
    ]);
    expect(sourcePinPieces(excluded)[0]!.refused).toContain("kept out of context on the source");

    const gone = canvasOf([
      group("itm_pack", { title: "Acme pack", properties: { kind: "group", [CONTEXT_PROP]: "pinned" } }),
      item("itm_lost", { title: "Acme lost", containerId: "itm_pack", currentVersionId: "ver_missing" }),
    ]);
    expect(sourcePinPieces(gone)[0]!.refused).toContain("no current version to copy");

    // Canvas links are not copied by this act: a card's saved preview and its
    // inheritance/personal semantics are a separate decision.
    const link = canvasOf([
      group("itm_pack", { title: "Acme pack", properties: { kind: "group", [CONTEXT_PROP]: "pinned" } }),
      item("itm_card", { title: "Acme other canvas", containerId: "itm_pack", properties: { ...canvasItemOf("https://acme.invalid", "prj_other").properties, kind: "canvas" } }),
    ]);
    expect(sourcePinPieces(link)[0]!.refused).toContain("place and inherit that canvas instead");
  });

  it("resolves an exact ID or one unambiguous prefix, and names the candidates otherwise", () => {
    const canvas = canvasOf([
      item("itm_checklist", { title: "Review checklist", properties: { [CONTEXT_PROP]: "pinned" } }),
      item("itm_release", { title: "Review release", y: 10, properties: { [CONTEXT_PROP]: "pinned" } }),
    ]);
    const pieces = sourcePinPieces(canvas);
    expect(resolveSourcePinPiece(pieces, "itm_checklist").title).toBe("Review checklist");
    expect(resolveSourcePinPiece(pieces, "Review c").itemId).toBe("itm_checklist");
    expect(() => resolveSourcePinPiece(pieces, "Review")).toThrow(/ambiguous/);
    expect(() => resolveSourcePinPiece(pieces, "Acme")).toThrow(/Review checklist/);
  });
});

describe("what a copied item wears", () => {
  const canvas = canvasOf([
    group("itm_pack", { title: "Acme review pack", properties: { kind: "group", [CONTEXT_PROP]: "pinned" } }),
    item("itm_design", { title: "Acme DESIGN.md", containerId: "itm_pack", properties: { ...designSystemProperties() } }),
    item("itm_old", { title: "Acme older copy", containerId: "itm_pack", y: 10, properties: { [CONTEXT_SOURCE_PROP]: JSON.stringify({ ...source, canvasId: "prj_first", canvasTitle: "Acme First" }) } }),
  ]);
  const copied = () => {
    const frozen = groupCopySource("prj_design", canvas, ["itm_pack"]);
    let n = 0;
    return groupCopyAction(frozen, "prj_local", {
      newItemId: () => `itm_new${++n}`, newVersionId: () => `ver_new${n}`,
      decorate: contextPinDecoration({ home: source.home, canvasId: source.canvasId, canvasTitle: source.canvasTitle }),
    });
  };

  it("pins only the chosen root, in the same act — never a second write", () => {
    const action = copied();
    const roots = action.items.filter((one) => action.rootIds.includes(one.id));
    expect(roots).toHaveLength(1);
    expect(props(roots[0]!)[CONTEXT_PROP]).toBe("pinned");
    expect(action.items.filter((one) => props(one)[CONTEXT_PROP] === "pinned")).toHaveLength(1);
  });

  it("strips the governing design role from descendants too, so a copied note does not govern here", () => {
    const action = copied();
    expect(action.items.some((one) => props(one).role)).toBe(false);
    // And the local canvas is still without a design system after the copy.
    const after = canvasOf(action.items.map((one) => item(one.id, { title: one.title, properties: props(one) })));
    expect(designSystem(after)).toBeNull();
    expect(withoutDesignRole({ role: "house-style", kind: "text" })).toEqual({ kind: "text" });
    expect(withoutDesignRole({ role: "reference" })).toEqual({ role: "reference" });
  });

  it("records the IMMEDIATE source on every copied item, replacing an older copy's provenance", () => {
    const action = copied();
    for (const one of action.items) {
      const recorded = parseContextSource(props(one)[CONTEXT_SOURCE_PROP]);
      expect(recorded).toMatchObject({ home: source.home, canvasId: "prj_design", canvasTitle: "Acme Design System" });
    }
    const older = action.items.find((one) => one.title === "Acme older copy")!;
    // Copying a copy records where THESE bytes came from, not a chain of homes.
    expect(parseContextSource(props(older)[CONTEXT_SOURCE_PROP])!.canvasId).toBe("prj_design");
    expect(parseContextSource(props(older)[CONTEXT_SOURCE_PROP])!.itemId).toBe("itm_old");
  });
});

describe("provenance is a record, not a capability", () => {
  it("round-trips the six facts and nothing else", () => {
    const property = contextSourceProperty(source);
    expect(parseContextSource(property[CONTEXT_SOURCE_PROP])).toEqual(source);
    // A seventh key is not carried: what a reader repeats is what the copy
    // decided to record, and a badge has no business in a copied property.
    expect(parseContextSource(JSON.stringify({ ...source, badge: "secret" }))).toEqual(source);
  });

  it("ignores malformed provenance as metadata rather than refusing the item", () => {
    for (const bad of [undefined, "", "{", "[]", "null", JSON.stringify({ ...source, home: "" }), JSON.stringify({ home: source.home })]) {
      expect(parseContextSource(bad)).toBeNull();
    }
    expect(contextSourceOf(item("itm_x", { properties: { [CONTEXT_SOURCE_PROP]: "not json" } }))).toBeNull();
  });

  it("says where a copy came from in local Context, on every surface that reads it", () => {
    const local = canvasOf([
      item("itm_copy", { title: "Review checklist", properties: { [CONTEXT_PROP]: "pinned", ...contextSourceProperty(source) } }),
      item("itm_own", { title: "Acme own note", y: 10 }),
    ]);
    expect(copiedContextItems(local).map((row) => row.item.id)).toEqual(["itm_copy"]);
    const piece = contextPieces(local).find((one) => one.name === "Copied from a source")!;
    expect(piece).toMatchObject({ present: true, size: "1 item" });
    expect(piece.copied).toEqual([{ itemId: "itm_copy", title: "Review checklist", source }]);
    expect(contextReport([piece])).toContain(formatContextSource(source));
    expect(formatContextSource(source)).toBe('copied from “Review checklist” on Acme Design System (prj_design) at https://acme.invalid');
  });

  it("says nothing at all on a canvas that has copied nothing", () => {
    expect(contextPieces(canvasOf([item("itm_own")])).some((one) => one.name === "Copied from a source")).toBe(false);
  });
});
