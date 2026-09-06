import { describe, expect, it } from "vitest";
import { formatMoves, formatScope } from "../src/format.ts";
import type { CanvasContents, Item } from "../src/model.ts";

/**
 * **Tidying a selection tidies the selection** (#196).
 *
 * `isocan format --in <area>` already narrowed the arrangement to a sheet's
 * contents, "a wall formatted as a wall", by handing `formatMoves` a canvas
 * holding only what was inside and an origin at the sheet's corner. A
 * selection is the same idea from a different source, so it is the same
 * shape — and it lives in core because the app's Format menu and `isocan
 * format <items...>` must land the same items on the same coordinates.
 *
 * The decision worth a test is the ORIGIN. A tidy of six things must happen
 * where those six things are: formatting them at the canvas's own origin
 * would shove somebody's work across the room and, worse, straight through
 * whatever was already standing there.
 */
const at = (id: string, x: number, y: number): Item =>
  ({
    id,
    title: id,
    description: "",
    x,
    y,
    width: 200,
    height: 120,
    properties: {},
    currentVersionId: `${id}_v`,
    versions: [
      {
        id: `${id}_v`,
        blobHash: id.padEnd(64, "0"),
        mimeType: "text/html",
        filename: `${id}.html`,
        createdAt: "2026-09-06T12:00:00.000Z",
        createdBy: { id: "usr_a", name: "A" },
      },
    ],
  }) as unknown as Item;

const canvas = (items: Item[]): CanvasContents =>
  ({ items: Object.fromEntries(items.map((i) => [i.id, i])), threads: {}, trash: {}, agents: {} }) as unknown as CanvasContents;

// Three far away from the origin, and one back near it that must not move.
const far = [at("a", 4000, 3000), at("b", 4600, 3400), at("c", 5200, 3050)];
const near = at("z", 0, 0);
const world = canvas([...far, near]);

describe("formatting only what was picked", () => {
  it("takes the selection's own top-left as the origin, not the canvas's", () => {
    const scoped = formatScope(world, ["a", "b", "c"]);
    expect(scoped).not.toBeNull();
    // The smallest x and y among the three, which is where they already are.
    expect(scoped!.origin).toEqual({ x: 4000, y: 3000 });
  });

  it("moves nothing that was not selected", () => {
    const scoped = formatScope(world, ["a", "b", "c"])!;
    const moves = formatMoves(scoped.scope, { mode: "grid", origin: scoped.origin });
    expect(moves.map((m) => m.itemId).sort()).not.toContain("z");
  });

  it("keeps the selection where it was, rather than hauling it to the canvas origin", () => {
    const scoped = formatScope(world, ["a", "b", "c"])!;
    const moves = formatMoves(scoped.scope, { mode: "grid", origin: scoped.origin });
    // Every destination is out where the work already lives. Without the
    // origin these land near 0,0 — on top of `z`, which nobody selected.
    for (const move of moves) {
      expect(move.x).toBeGreaterThanOrEqual(4000);
      expect(move.y).toBeGreaterThanOrEqual(3000);
    }
  });

  it("refuses one item, because one is already arranged with respect to itself", () => {
    expect(formatScope(world, ["a"])).toBeNull();
    expect(formatScope(world, [])).toBeNull();
  });

  it("ignores ids the canvas does not have, and counts what is left", () => {
    expect(formatScope(world, ["a", "nope"])).toBeNull();
    expect(formatScope(world, ["a", "b", "nope"])).not.toBeNull();
  });
});
