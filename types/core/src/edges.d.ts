import type { CanvasContents, Item } from "./model.js";
interface EdgeBox {
    x: number;
    y: number;
    width: number;
    height: number;
}
/**
 * **Node-declared directional edges** — any canvas item can declare outgoing
 * directional edges to other items on the canvas via its `properties`.
 *
 * Two property forms are supported so both CLI flags (`--prop edge:next=itm_2`)
 * and structured writes (`properties.edges = JSON.stringify(...)`) work
 * without a dedicated operation:
 *
 * 1. Flat keys: `edge:<key> = "<targetItemId>"` with optional
 *    `edge:<key>:label = "<label>"`.
 * 2. JSON array or comma list on `edges`:
 *    `[{"to":"itm_2","label":" Submit "}]` or `"itm_2,itm_3"`.
 */
/** Prefix for flat outgoing edge property keys (`edge:<key>`). */
export declare const EDGE_PROP_PREFIX = "edge:";
/** Property key holding a comma list or JSON array of outgoing edges. */
export declare const EDGES_PROP = "edges";
interface DeclaredEdge {
    /** Edge key within the source item (defaults to the target item id). */
    key: string;
    /** Target item id on the same canvas. */
    to: string;
    /** Optional label drawn along the directional edge. */
    label?: string;
}
interface NodeEdge {
    from: Item;
    to: Item;
    key: string;
    label?: string;
}
/** Whether a property key is an `edge:<key>` target reference (and not its `:label` companion). */
export declare function isEdgeReferenceProperty(key: string): boolean;
/** Companion label property key for `edge:<key>`. */
export declare function edgeLabelProperty(edgeKey: string): string;
/**
 * Every outgoing directional edge declared on `item.properties`, in deterministic
 * key order, deduplicated by `(key, to)`.
 */
export declare function declaredEdgesOf(item: Pick<Item, "properties">): DeclaredEdge[];
/**
 * Every resolved directional edge declared by items on `canvas`.
 * Self-edges and edges pointing at missing/trashed items are omitted.
 */
export declare function nodeEdges(canvas: CanvasContents): NodeEdge[];
/**
 * Property patch for `item.update` that declares a directional edge from the
 * updated item to `toItemId`.
 */
export declare function edgePatch(toItemId: string, options?: {
    key?: string;
    label?: string | null;
}): Record<string, string | null>;
/**
 * Property patch for `item.update` that removes a declared directional edge
 * by its key (or target item id when the default key was used).
 */
export declare function removeEdgePatch(keyOrTargetId: string): Record<string, null>;
interface EdgeAnchorPair {
    x1: number;
    y1: number;
    cx1: number;
    cy1: number;
    cx2: number;
    cy2: number;
    x2: number;
    y2: number;
    /** Midpoint along the cubic bezier curve for placing an optional edge label. */
    mx: number;
    my: number;
}
/**
 * Cubic bezier anchor and control points connecting `from` to `to` along the
 * dominant axis (horizontal when `|dx| >= |dy|`, vertical otherwise).
 */
export declare function directionalEdgeGeometry(from: EdgeBox, to: EdgeBox): EdgeAnchorPair;
export {};
