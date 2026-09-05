import type { CanvasContents, Item } from "@isocan/core";
import { newId } from "@isocan/core";

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
function mapParentOf(item: Item): string | null {
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
interface NodeBox {
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

/**
 * **Stage 3: a map that lands in a shape somebody would have dragged it into.**
 *
 * Placement so far has been INCREMENTAL — a child goes to the right of its
 * parent and stacks under the lowest sibling, decided once at the moment it is
 * added and never revisited. That was the right first move: it means an agent
 * writing thirty nodes from one sentence produces something legible rather
 * than a pile, which was the stated risk. It also means the arrangement
 * records the ORDER things were typed rather than the shape of the tree, and
 * the difference shows the moment a branch grows: a parent sits level with its
 * first child while its last child is four rows down, so the eye reads a
 * ladder instead of a fork.
 *
 * This is the tidy pass. Depth chooses the column; a post-order sweep chooses
 * the row. Each leaf takes the next free row, and **a parent is centred on the
 * band its descendants occupy** — which is the whole difference, and the one
 * thing every hand-drawn mind map does.
 *
 * **It returns moves rather than applying them.** Layout that writes is layout
 * that cannot be previewed, cannot be undone as one thing, and cannot be
 * tested without a canvas. The caller sends one `items.move`, so tidying is a
 * single undo step — which matters, because the first thing anyone does after
 * an automatic layout is decide they preferred it before.
 *
 * Columns are sized to the WIDEST node in them rather than to a constant, so a
 * long label does not overlap the column to its right — the failure that makes
 * an automatic layout look worse than the pile it replaced.
 */
export interface MapMove {
  itemId: string;
  x: number;
  y: number;
}

/** Space between a column and the next, and between one row and the next. */
const TIDY_GAP_X = 60;
const TIDY_GAP_Y = 24;

export function tidyMap(canvas: CanvasContents, mapId: string): MapMove[] {
  const roots = mapRoots(canvas, mapId);
  if (roots.length === 0) return [];

  // Depth of every node, and the widest node at each depth — the column's
  // width, which is what stops a long label reaching into the next column.
  const depthOf = new Map<string, number>();
  const walk = (item: Item, depth: number, seen: Set<string>): void => {
    if (seen.has(item.id)) return; // a cycle is guarded elsewhere; do not hang here
    seen.add(item.id);
    depthOf.set(item.id, depth);
    for (const child of mapChildren(canvas, mapId, item.id)) walk(child, depth + 1, seen);
  };
  const seen = new Set<string>();
  for (const root of roots) walk(root, 0, seen);

  const widest: number[] = [];
  for (const [itemId, depth] of depthOf) {
    const item = canvas.items[itemId];
    if (!item) continue;
    widest[depth] = Math.max(widest[depth] ?? 0, item.width);
  }
  const columnX: number[] = [];
  let x = roots[0]!.x;
  for (let d = 0; d < widest.length; d += 1) {
    columnX[d] = x;
    x += (widest[d] ?? 0) + TIDY_GAP_X;
  }

  const moves: MapMove[] = [];
  /**
   * The top of the band the tree will occupy.
   *
   * Anchored on the topmost NODE, not on the root: a tidy moves the root down
   * to sit level with the middle of its children, so anchoring there made the
   * pass shift the whole map a little further each time it ran. Tidying twice
   * has to be the same as tidying once — otherwise "tidy" is a verb that
   * never settles, and the second press looks like a bug in the first.
   *
   * The topmost node after a tidy is the first leaf, whose top IS this
   * cursor's start, which is what makes the anchor a fixed point.
   */
  const all = mapNodes(canvas, mapId);
  let cursorY = Math.min(...all.map((n) => n.y));

  /** Places a subtree and answers the vertical centre it ended up occupying. */
  const place = (item: Item, depth: number, placed: Set<string>): number => {
    if (placed.has(item.id)) return cursorY;
    placed.add(item.id);
    const children = mapChildren(canvas, mapId, item.id).filter((c) => !placed.has(c.id));
    let centre: number;
    if (children.length === 0) {
      // A leaf takes the next free row and advances the cursor past itself.
      centre = cursorY + item.height / 2;
      cursorY += item.height + TIDY_GAP_Y;
    } else {
      const centres = children.map((child) => place(child, depth + 1, placed));
      // Centred on its children — a parent level with its FIRST child is the
      // ladder this pass exists to remove.
      centre = (centres[0]! + centres[centres.length - 1]!) / 2;
    }
    moves.push({
      itemId: item.id,
      x: columnX[depth] ?? item.x,
      y: Math.round(centre - item.height / 2),
    });
    return centre;
  };

  const placed = new Set<string>();
  for (const root of roots) place(root, 0, placed);
  // Only what actually moves: a tidy that reports every node as changed makes
  // an undo step out of nothing and a diff nobody can read.
  return moves.filter((m) => {
    const item = canvas.items[m.itemId];
    return !item || item.x !== m.x || item.y !== m.y;
  });
}
