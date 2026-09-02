import type { CanvasContents, Item } from "./model.js";
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
export declare const MAP_PROP = "map";
export declare const MAP_PARENT_PROP = "mapParent";
export declare function newMapId(): string;
/** Which map this item belongs to, or null for an ordinary item. */
export declare function mapOf(item: Item): string | null;
/** Every node of one map, in creation order so a walk is stable. */
export declare function mapNodes(canvas: CanvasContents, mapId: string): Item[];
/**
 * Every map on the canvas, with its root's title as its name.
 *
 * A map is a SET, and this is what lets the canvas treat one as a single
 * thing — show it, hide it, move it, delete it — even though it is forty
 * items in Files and in `ls`.
 */
export declare function mapsOn(canvas: CanvasContents): {
    id: string;
    title: string;
    nodes: number;
}[];
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
export declare function mapEdges(canvas: CanvasContents, mapId: string): {
    from: Item;
    to: Item;
}[];
/** Every edge on the canvas, whichever map it belongs to — what the canvas
 *  draws, since it shows all maps at once. */
export declare function allMapEdges(canvas: CanvasContents): {
    from: Item;
    to: Item;
}[];
/** The nodes with no parent here — true roots, plus orphans whose parent has
 *  been deleted. */
export declare function mapRoots(canvas: CanvasContents, mapId: string): Item[];
export declare function mapChildren(canvas: CanvasContents, mapId: string, parentId: string): Item[];
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
export declare function mapOutline(canvas: CanvasContents, mapId: string): string;
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
export declare function edgeAnchors(from: NodeBox, to: NodeBox): {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    axis: "x" | "y";
};
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
export declare function tidyMap(canvas: CanvasContents, mapId: string): MapMove[];
export {};
