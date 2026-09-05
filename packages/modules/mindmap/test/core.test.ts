import { describe, expect, it } from "vitest";
import type { CanvasContents, Item } from "@isocan/core";
import {
  MAP_PARENT_PROP,
  MAP_PROP,
  allMapEdges,
  mapEdges,
  mapOutline,
  mapRoots,
  mapsOn,
  newMapId,
  edgeAnchors,
} from "../src/core.ts";
import { PARENT_PROP } from "@isocan/core";
import { tidyMap, type MapMove } from "../src/core.ts";

/**
 * **A mind map is items and properties, and that is the whole design.**
 *
 * Nothing here is a new operation. What these tests hold is that the derived
 * half — which nodes are in a map, which lines are drawn, what the outline
 * says — survives the states a real canvas reaches: a deleted parent, a
 * property pointing somewhere else, two nodes made each other's parent.
 */
const actor = { id: "usr_1", name: "Di" };
let clock = 0;
const node = (id: string, title: string, props: Record<string, string>): Item =>
  ({
    id,
    title,
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    description: "",
    properties: { kind: "text", ...props },
    versions: [],
    currentVersionId: "v",
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, clock++)).toISOString(),
    createdBy: actor,
    updatedAt: "2026-01-01T00:00:00.000Z",
    updatedBy: actor,
  }) as unknown as Item;

const canvasOf = (items: Item[]): CanvasContents =>
  ({ items: Object.fromEntries(items.map((i) => [i.id, i])), threads: {} }) as unknown as CanvasContents;

const MAP = "map_1";
const root = () => node("n_root", "Lake house", { [MAP_PROP]: MAP });
const child = (id: string, title: string, parent: string) =>
  node(id, title, { [MAP_PROP]: MAP, [MAP_PARENT_PROP]: parent });

describe("what belongs to a map", () => {
  it("is not the same word as lineage", () => {
    /**
     * `parent` means MADE FROM — three variations of a screen, a spec written
     * from a sketch. A topic hierarchy is a different relationship, and
     * sharing the property would make `isocan lineage` report map structure
     * as provenance: a lie that would be believed because it looks like data.
     */
    expect(MAP_PARENT_PROP).not.toBe(PARENT_PROP);
  });

  it("gives every map an id of its own", () => {
    expect(newMapId()).not.toBe(newMapId());
    expect(newMapId().startsWith("map_")).toBe(true);
  });

  it("names a map by its root, and counts what is in it", () => {
    // A map is a SET: forty nodes are forty items in Files and in `ls`, and
    // this is what lets the canvas treat them as one thing.
    const canvas = canvasOf([root(), child("n_a", "Booking", "n_root")]);
    expect(mapsOn(canvas)).toEqual([{ id: MAP, title: "Lake house", nodes: 2 }]);
  });

  it("ignores ordinary items entirely", () => {
    const canvas = canvasOf([root(), node("itm_x", "A screen", {})]);
    expect(mapsOn(canvas)[0]!.nodes).toBe(1);
  });
});

describe("the lines, which are derived and never stored", () => {
  it("joins a parent to each child", () => {
    const canvas = canvasOf([root(), child("n_a", "Booking", "n_root")]);
    const edges = mapEdges(canvas, MAP);
    expect(edges).toHaveLength(1);
    expect(edges[0]!.from.id).toBe("n_root");
    expect(edges[0]!.to.id).toBe("n_a");
  });

  it("draws no line to a node that has been deleted", () => {
    /**
     * Items get deleted, and a map with a hole in it is still a map. The
     * orphan becomes a root so its branch is still drawn and still walked —
     * dropping the subtree would lose work over a deletion somebody may undo.
     */
    const canvas = canvasOf([child("n_a", "Booking", "n_gone")]);
    expect(mapEdges(canvas, MAP)).toEqual([]);
    expect(mapRoots(canvas, MAP).map((n) => n.id)).toEqual(["n_a"]);
  });

  it("refuses an edge that leaves the map", () => {
    // A property pointing at an item in another map — or at no map at all —
    // is not a line anybody meant to draw.
    const outside = node("n_out", "Elsewhere", { [MAP_PROP]: "map_2" });
    const canvas = canvasOf([root(), child("n_a", "Booking", "n_out"), outside]);
    expect(mapEdges(canvas, MAP)).toEqual([]);
  });

  it("collects every map's lines for the canvas, which shows them all at once", () => {
    const other = node("m_root", "Other map", { [MAP_PROP]: "map_2" });
    const otherKid = node("m_kid", "Branch", { [MAP_PROP]: "map_2", [MAP_PARENT_PROP]: "m_root" });
    const canvas = canvasOf([root(), child("n_a", "Booking", "n_root"), other, otherKid]);
    expect(allMapEdges(canvas)).toHaveLength(2);
  });
});

describe("the outline, which is a projection", () => {
  it("draws the tree the way a terminal reads one", () => {
    const canvas = canvasOf([
      root(),
      child("n_a", "Booking", "n_root"),
      child("n_a1", "Checkout day is exclusive", "n_a"),
      child("n_a2", "Timezone is the browser's", "n_a"),
      child("n_b", "The four screens are islands", "n_root"),
    ]);
    expect(mapOutline(canvas, MAP)).toBe(
      [
        "Lake house",
        "├── Booking",
        "│   ├── Checkout day is exclusive",
        "│   └── Timezone is the browser's",
        "└── The four screens are islands",
      ].join("\n"),
    );
  });

  it("cannot be hung by a cycle", () => {
    /**
     * A property holds one id, so this is a tree by construction — but
     * `mapParent` is a string, and two `item.update`s can make A the parent
     * of B and B the parent of A. That canvas is reachable, so a walk that
     * trusted the shape would hang the CLI rather than print something odd.
     */
    const a = node("n_a", "A", { [MAP_PROP]: MAP, [MAP_PARENT_PROP]: "n_b" });
    const b = node("n_b", "B", { [MAP_PROP]: MAP, [MAP_PARENT_PROP]: "n_a" });
    const out = mapOutline(canvasOf([a, b]), MAP);
    expect(out).toContain("loops back");
    // And it terminated, which is the actual assertion.
    expect(out.split("\n").length).toBeLessThan(10);
  });

  it("prints a forest when a map has more than one root", () => {
    const canvas = canvasOf([
      root(),
      node("n_second", "Another thread", { [MAP_PROP]: MAP }),
    ]);
    expect(mapOutline(canvas, MAP)).toBe("Lake house\n\nAnother thread");
  });

  it("says nothing about an empty map rather than throwing", () => {
    expect(mapOutline(canvasOf([]), MAP)).toBe("");
  });
});

describe("where a line meets a node", () => {
  const box = (x: number, y: number) => ({ x, y, width: 100, height: 40 });

  it("meets the sides when the nodes are side by side", () => {
    // Centre to centre would run the line visibly through the words at both
    // ends — a text node is chromeless and has nothing to hide it.
    const a = edgeAnchors(box(0, 0), box(200, 0));
    expect(a).toEqual({ x1: 100, y1: 20, x2: 200, y2: 20, axis: "x" });
  });

  it("meets the top and bottom when one is below the other", () => {
    // Chosen on the DOMINANT axis, so a node dragged underneath its parent
    // gets a vertical line rather than one that loops out sideways. This is
    // what keeps the drawing sensible after somebody rearranges by hand,
    // which is the whole point of making it draggable.
    const a = edgeAnchors(box(0, 0), box(0, 300));
    expect(a).toEqual({ x1: 50, y1: 40, x2: 50, y2: 300, axis: "y" });
  });

  it("works in both directions", () => {
    const left = edgeAnchors(box(200, 0), box(0, 0));
    expect(left.x1).toBe(200);
    expect(left.x2).toBe(100);
    const up = edgeAnchors(box(0, 300), box(0, 0));
    expect(up.y1).toBe(300);
    expect(up.y2).toBe(40);
  });

  it("does not divide by zero when a node sits on its parent", () => {
    // Reachable: drag a child exactly onto its parent. A NaN here would take
    // the whole SVG layer down, not just this line.
    const a = edgeAnchors(box(0, 0), box(0, 0));
    const { axis, ...points } = a;
    expect(axis === "x" || axis === "y").toBe(true);
    for (const n of Object.values(points)) expect(Number.isFinite(n)).toBe(true);
  });
});

describe("a branch leaves the way it points", () => {
  const box = (x: number, y: number) => ({ x, y, width: 100, height: 40 });

  it("says which side it left by, so a curve can bulge the right way", () => {
    /* The points alone cannot say it: (100,20)->(200,20) could be a line
       leaving a right edge or crossing a gap between two stacked nodes. A
       curve that bulges on the wrong axis enters the node side-on and reads
       as a stray stroke rather than a branch. */
    expect(edgeAnchors(box(0, 0), box(200, 0)).axis).toBe("x");
    expect(edgeAnchors(box(0, 0), box(0, 300)).axis).toBe("y");
  });

  it("keeps saying it when the line runs backwards", () => {
    expect(edgeAnchors(box(200, 0), box(0, 0)).axis).toBe("x");
    expect(edgeAnchors(box(0, 300), box(0, 0)).axis).toBe("y");
  });
});

/**
 * **Stage 3 — the tidy pass.**
 *
 * Placement so far has been incremental: a child lands right of its parent and
 * stacks under the lowest sibling, decided once and never revisited. That is
 * legible for thirty nodes typed in order and it records the ORDER rather than
 * the SHAPE — a parent level with its first child while its last is four rows
 * down, so the eye reads a ladder instead of a fork.
 */
describe("tidying a map", () => {
  /** A node with a real size, since the layout is about geometry. */
  const box = (id: string, parent: string | null, w = 100, h = 40): Item =>
    ({
      ...node(id, id, parent ? { [MAP_PROP]: MAP, [MAP_PARENT_PROP]: parent } : { [MAP_PROP]: MAP }),
      width: w,
      height: h,
    }) as unknown as Item;

  const at = (moves: ReturnType<typeof tidyMap>, id: string) => moves.find((m) => m.itemId === id);

  it("centres a parent on its children, which is the whole point", () => {
    /* Three children in a column; the parent belongs level with the MIDDLE
       one, not with the first. That single difference is what turns a ladder
       back into a fork. */
    const canvas = canvasOf([box("r", null), box("a", "r"), box("b", "r"), box("c", "r")]);
    const moves = tidyMap(canvas, MAP);
    const [a, b, c] = ["a", "b", "c"].map((id) => at(moves, id)!) as [MapMove, MapMove, MapMove];
    expect(a.y).toBeLessThan(b.y);
    expect(b.y).toBeLessThan(c.y);
    expect(at(moves, "r")!.y).toBe(b.y);
  });

  it("puts each depth in its own column", () => {
    const canvas = canvasOf([box("r", null), box("a", "r"), box("a1", "a")]);
    const moves = tidyMap(canvas, MAP);
    const x = (id: string) => at(moves, id)?.x ?? canvas.items[id]!.x;
    expect(x("a")).toBeGreaterThan(x("r"));
    expect(x("a1")).toBeGreaterThan(x("a"));
  });

  it("sizes a column to its widest node, not to a constant", () => {
    /* A long label reaching into the next column is the failure that makes an
       automatic layout look worse than the pile it replaced. */
    const canvas = canvasOf([box("r", null, 400), box("a", "r", 50), box("a1", "a", 50)]);
    const moves = tidyMap(canvas, MAP);
    /* A node already in the right place is not in `moves` — see "reports only
       what actually moves" — so read through to where it actually is. */
    const x = (id: string) => at(moves, id)?.x ?? canvas.items[id]!.x;
    expect(x("a") - x("r")).toBeGreaterThanOrEqual(400);
  });

  it("never overlaps two leaves", () => {
    const canvas = canvasOf([
      box("r", null), box("a", "r"), box("b", "r"),
      box("a1", "a"), box("a2", "a"), box("b1", "b"),
    ]);
    const moves = tidyMap(canvas, MAP);
    const rows = ["a1", "a2", "b1"].map((id) => at(moves, id)!).sort((p, q) => p.y - q.y);
    for (let i = 1; i < rows.length; i += 1) {
      expect(rows[i]!.y - rows[i - 1]!.y).toBeGreaterThanOrEqual(40);
    }
  });

  it("reports only what actually moves", () => {
    /* A tidy that reports every node makes an undo step out of nothing and a
       diff nobody can read. Tidying twice is a no-op. */
    const canvas = canvasOf([box("r", null), box("a", "r"), box("b", "r")]);
    const first = tidyMap(canvas, MAP);
    for (const m of first) Object.assign(canvas.items[m.itemId]!, { x: m.x, y: m.y });
    expect(tidyMap(canvas, MAP)).toEqual([]);
  });

  it("does not hang on a map that made two nodes each other's parent", () => {
    /* `mapParent` is a string, so two `item.update`s can do this. The outline
       already survives it; a layout that recursed forever would take the
       surface down instead. */
    const a = box("a", "b");
    const b = box("b", "a");
    expect(() => tidyMap(canvasOf([a, b]), MAP)).not.toThrow();
  });

  it("has nothing to say about a map that is not there", () => {
    expect(tidyMap(canvasOf([]), MAP)).toEqual([]);
  });
});
