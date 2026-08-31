import type { CanvasContents, Item } from "./model.ts";
import { newId } from "./ids.ts";

/**
 * **Mind maps: a graph you can drag, made of things the canvas already has.**
 *
 * A node is a TEXT ITEM. It already renders chromeless, already carries a size
 * ladder and a face, and already moves when you drag it. An edge is a PROPERTY
 * on the child naming its parent. The arrows are derived from wherever the two
 * items are right now, which is what makes a link follow a drag and what means
 * there is no edge geometry to keep in sync with anything.
 *
 * **Zero new op types.** `item.add` with properties, `item.move`,
 * `item.update`. That is the whole feature on the wire, and it is why undo,
 * replay, presence and the CLI all work on a map without being told a map
 * exists.
 *
 * **Not `parent`.** `lineage.ts` owns that word and it means *made from* —
 * three variations of a screen, a spec written from a sketch. A topic
 * hierarchy is a different relationship, and overloading it would make
 * `isocan lineage` report map structure as provenance, which is a lie that
 * would be believed.
 */
export const MAP_PROP = "map";
export const MAP_PARENT_PROP = "mapParent";

export function newMapId(): string {
  return newId("map");
}

/** Which map this item belongs to, or null for an ordinary item. */
export function mapOf(item: Item): string | null {
  return item.properties[MAP_PROP] ?? null;
}

/** The node this one hangs from, or null for a root. */
export function mapParentOf(item: Item): string | null {
  return item.properties[MAP_PARENT_PROP] ?? null;
}

/** Every node of one map, in creation order so a walk is stable. */
export function mapNodes(canvas: CanvasContents, mapId: string): Item[] {
  return Object.values(canvas.items)
    .filter((item) => mapOf(item) === mapId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/**
 * Every map on the canvas, with its root's title as its name.
 *
 * A map is a SET, and this is what lets the canvas treat one as a single
 * thing — show it, hide it, move it, delete it — even though it is forty
 * items in Files and in `ls`.
 */
export function mapsOn(canvas: CanvasContents): { id: string; title: string; nodes: number }[] {
  const byMap = new Map<string, Item[]>();
  for (const item of Object.values(canvas.items)) {
    const id = mapOf(item);
    if (id === null) continue;
    const held = byMap.get(id);
    if (held) held.push(item);
    else byMap.set(id, [item]);
  }
  return [...byMap.entries()]
    .map(([id, items]) => {
      const roots = items.filter((item) => mapParentOf(item) === null);
      const named = roots[0] ?? items[0]!;
      return { id, title: named.title, nodes: items.length };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}

/**
 * The edges of a map: parent → child, both ends resolved to items that are
 * actually here.
 *
 * **A child whose parent is gone is not an edge**, and it is not an error
 * either — items get deleted, and a map with a hole in it is still a map. The
 * orphan becomes a root, which is what `roots` below does, so the branch is
 * still drawn and still walked. The alternative — dropping the whole subtree
 * because one node went — would lose work over a deletion somebody may undo.
 */
export function mapEdges(canvas: CanvasContents, mapId: string): { from: Item; to: Item }[] {
  const edges: { from: Item; to: Item }[] = [];
  for (const child of mapNodes(canvas, mapId)) {
    const parentId = mapParentOf(child);
    if (parentId === null) continue;
    const parent = canvas.items[parentId];
    // Both ends must be in THIS map: a stray property pointing outside it is
    // not a line anybody meant to draw.
    if (!parent || mapOf(parent) !== mapId) continue;
    edges.push({ from: parent, to: child });
  }
  return edges;
}

/** Every edge on the canvas, whichever map it belongs to — what the canvas
 *  draws, since it shows all maps at once. */
export function allMapEdges(canvas: CanvasContents): { from: Item; to: Item }[] {
  return mapsOn(canvas).flatMap((map) => mapEdges(canvas, map.id));
}

/** The nodes with no parent here — true roots, plus orphans whose parent has
 *  been deleted. */
export function mapRoots(canvas: CanvasContents, mapId: string): Item[] {
  return mapNodes(canvas, mapId).filter((item) => {
    const parentId = mapParentOf(item);
    if (parentId === null) return true;
    const parent = canvas.items[parentId];
    return !parent || mapOf(parent) !== mapId;
  });
}

export function mapChildren(canvas: CanvasContents, mapId: string, parentId: string): Item[] {
  return mapNodes(canvas, mapId).filter((item) => mapParentOf(item) === parentId);
}

/**
 * The map as a tree, in the terminal's own vocabulary.
 *
 * Box-drawing rather than indentation, because in a terminal that is what
 * makes a tree readable at a glance — and the terminal is where agents read.
 * Tens of lines rather than a dependency: the ASCII graph libraries that do
 * this ship React and render nothing interactive, which is the wrong half of
 * this feature twice over.
 *
 * **Derived on demand, never stored.** An outline written to the canvas would
 * drift the moment somebody dragged a node. A projection cannot.
 *
 * **Cycle-safe.** A property holds one id so this is a tree by construction —
 * but `mapParent` is just a string, and two `item.update`s can make A the
 * parent of B and B the parent of A. That is a canvas somebody can reach, so
 * a walk that trusted the shape would hang the CLI. Seen nodes are tracked
 * and a repeat is cut with a marker rather than followed.
 */
export function mapOutline(canvas: CanvasContents, mapId: string): string {
  const lines: string[] = [];
  const seen = new Set<string>();

  const walk = (node: Item, prefix: string, last: boolean, top: boolean): void => {
    if (top) {
      lines.push(node.title);
    } else {
      lines.push(`${prefix}${last ? "└── " : "├── "}${node.title}`);
    }
    if (seen.has(node.id)) {
      lines.push(`${prefix}${last ? "    " : "│   "}└── ↩ (loops back)`);
      return;
    }
    seen.add(node.id);
    const kids = mapChildren(canvas, mapId, node.id);
    kids.forEach((kid, i) => {
      const deeper = top ? "" : `${prefix}${last ? "    " : "│   "}`;
      walk(kid, deeper, i === kids.length - 1, false);
    });
  };

  /**
   * **A map made entirely of a cycle has no roots, and must still print.**
   *
   * `mapRoots` looks for nodes whose parent is missing — and in a two-node
   * loop both parents are present, so it finds none and the walk never
   * starts. Terminating is not enough: a canvas whose nodes all vanished from
   * the outline would read as "the map is empty" when the map is right there
   * on the screen. So the oldest node is used as a way in, and the loop is
   * marked where it closes.
   */
  const nodes = mapNodes(canvas, mapId);
  const found = mapRoots(canvas, mapId);
  const roots = found.length > 0 ? found : nodes.slice(0, 1);
  roots.forEach((root, i) => {
    if (i > 0) lines.push("");
    walk(root, "", true, true);
  });
  return lines.join("\n");
}

/** A box, which is all the geometry an edge needs from an item. */
export interface NodeBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * **Where a line between two nodes should start and stop.**
 *
 * Centre to centre would be simpler and wrong: a text node is chromeless, so
 * the line would run visibly through the words at both ends. This meets each
 * box on the side that faces the other one, so the line starts where the node
 * stops.
 *
 * Which side is chosen by the DOMINANT axis — the bigger of the horizontal
 * and vertical separation. A map laid out left-to-right joins side to side; a
 * node dragged directly below its parent joins bottom to top. Picking on the
 * axis rather than always going horizontal is what keeps the line sensible
 * after somebody rearranges the map by hand, which is the whole point of
 * making it draggable.
 */
export function edgeAnchors(
  from: NodeBox,
  to: NodeBox,
): { x1: number; y1: number; x2: number; y2: number; axis: "x" | "y" } {
  const fromMid = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
  const toMid = { x: to.x + to.width / 2, y: to.y + to.height / 2 };
  const dx = toMid.x - fromMid.x;
  const dy = toMid.y - fromMid.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    const rightwards = dx >= 0;
    return {
      x1: rightwards ? from.x + from.width : from.x,
      y1: fromMid.y,
      x2: rightwards ? to.x : to.x + to.width,
      y2: toMid.y,
      axis: "x",
    };
  }
  const downwards = dy >= 0;
  return {
    x1: fromMid.x,
    y1: downwards ? from.y + from.height : from.y,
    x2: toMid.x,
    y2: downwards ? to.y : to.y + to.height,
    /**
     * **Which side the line leaves by**, which the points alone cannot say.
     *
     * A curve has to bulge PERPENDICULAR to the edge it leaves, or it enters
     * the node at an angle and reads as a stray stroke rather than a branch.
     * The choice is already made here — on the dominant axis — and was being
     * thrown away, so the renderer could only draw something straight.
     */
    axis: "y",
  };
}
