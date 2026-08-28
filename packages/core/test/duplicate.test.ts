import { describe, expect, it } from "vitest";
import type { CanvasContents, Item } from "../src/model.ts";
import { boundsOf, copyProperties, duplicatePlacements } from "../src/duplicate.ts";
import { PARENT_PROP } from "../src/lineage.ts";

/**
 * **Copying a SELECTION, where the arrangement is part of what was copied.**
 *
 * Four screens in a row must paste as four screens in a row. Placing each
 * item independently loses that, and loses it silently — every item lands
 * somewhere legal and the group is gone.
 */

const item = (
  id: string,
  x: number,
  y: number,
  width = 100,
  height = 100,
  properties: Record<string, string> = {},
): Item => ({ id, x, y, width, height, properties }) as unknown as Item;

const canvas = (items: Item[]): CanvasContents =>
  ({ items: Object.fromEntries(items.map((i) => [i.id, i])) }) as unknown as CanvasContents;

describe("the shape of a copied group survives", () => {
  it("keeps every relative offset", () => {
    // A row and a caption under it: the two facts about this selection are
    // the gap between the screens and the caption being BELOW the first.
    const row = [item("a", 0, 0), item("b", 200, 0), item("c", 100, 300, 80, 20)];
    const placed = duplicatePlacements(canvas(row), row, { x: 1000, y: 1000 });
    const at = (id: string) => placed.find((p) => p.item.id === id)!;
    expect(at("b").x - at("a").x).toBe(200);
    expect(at("c").y - at("a").y).toBe(300);
    expect(at("c").x - at("a").x).toBe(100);
  });

  it("puts the whole box somewhere clear, not each item somewhere clear", () => {
    // The originals are occupants: a copy landing on its own source is the
    // one placement nobody wants.
    const originals = [item("a", 0, 0), item("b", 200, 0)];
    const placed = duplicatePlacements(canvas(originals), originals, { x: 0, y: 0 });
    for (const p of placed) {
      const clashes = originals.some(
        (o) => p.x < o.x + o.width && p.x + p.item.width > o.x && p.y < o.y + o.height && p.y + p.item.height > o.y,
      );
      expect(clashes, `${p.item.id} landed on an original`).toBe(false);
    }
    // …and the shape is still the shape.
    expect(placed[1]!.x - placed[0]!.x).toBe(200);
  });

  it("lands beside the originals when nowhere was asked for", () => {
    const one = [item("a", 500, 500)];
    const placed = duplicatePlacements(canvas(one), one);
    expect(placed[0]!.x).toBeGreaterThan(500);
    expect(placed[0]!.y).toBeGreaterThan(500);
  });

  it("measures the box a set of items occupies", () => {
    expect(boundsOf([item("a", 10, 10), item("b", 110, 60, 40, 40)])).toEqual({
      x: 10,
      y: 10,
      width: 140,
      height: 100,
    });
    expect(boundsOf([])).toBe(null);
  });
});

describe("what a copy inherits", () => {
  it("records that it was made from the original", () => {
    // `lineage` is the word this canvas already has for it, so a paste writes
    // a relationship `isocan lineage` shows without anybody adding a feature.
    const source = item("itm_a", 0, 0, 100, 100, { kind: "text" });
    const copied = copyProperties(source, { sameCanvas: true });
    expect(copied[PARENT_PROP]).toBe("itm_a");
    expect(copied.kind).toBe("text");
  });

  it("claims no parent across canvases", () => {
    // The id would point at an item this canvas does not have, and a dangling
    // parent is worse than none: a claim about provenance resolving to
    // nothing, which reads as a bug rather than as an absence.
    const source = item("itm_a", 0, 0, 100, 100, { [PARENT_PROP]: "itm_older" });
    expect(copyProperties(source, { sameCanvas: false })[PARENT_PROP]).toBeUndefined();
  });

  it("never inherits the file the original is saved to", () => {
    // Two items claiming one path would each overwrite the other on `save`,
    // and the copy is not that file.
    const source = item("itm_a", 0, 0, 100, 100, { file: "src/index.html", kind: "text" });
    const copied = copyProperties(source, { sameCanvas: true });
    expect(copied.file).toBeUndefined();
    expect(copied.kind).toBe("text");
  });
});
