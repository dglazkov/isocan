import type { CanvasContents, Item } from "./model.js";
/**
 * **Export to JSON Canvas** — [jsoncanvas.org](https://jsoncanvas.org), the
 * open file format Obsidian and others read. MIT, and its coordinate model is
 * ours almost exactly: same units, same origin, `x/y/width/height` straight
 * across with no scaling and no flipped axis.
 *
 * `docs/research/json-canvas.md` costed it and recommended export first. This
 * is that, and one thing it recommended has already changed underneath it:
 * the research listed **edges** as "the whole question", unanswered, because
 * isocan had no relationship primitive. Mind maps shipped on 29 Aug and
 * answered it — an edge is a PROPERTY (`mapParent`), not a new op — so a
 * canvas holding a map exports as a real graph rather than as a pile of boxes.
 *
 * **Export only, deliberately.** Import is not here and is not next: this
 * format carries no versions, no comment threads, no actors, no timestamps,
 * no properties and no oplog, so reading one in would mint a canvas whose
 * history begins at import. That is a different feature with a different
 * argument, and pretending a round trip exists is how somebody loses work.
 */
export interface JsonCanvasNode {
    id: string;
    type: "file" | "text" | "link" | "group";
    x: number;
    y: number;
    width: number;
    height: number;
    /** `file`: a path. */
    file?: string;
    /** `link`: a URL. */
    url?: string;
    /** `text`: inline markdown. */
    text?: string;
}
export interface JsonCanvasEdge {
    id: string;
    fromNode: string;
    toNode: string;
    /** The spec's ends; an isocan map edge points at the child. */
    toEnd?: "none" | "arrow";
    label?: string;
}
export interface JsonCanvasFile {
    nodes: JsonCanvasNode[];
    edges: JsonCanvasEdge[];
}
/** What this canvas holds that the format has no room for. Returned beside the
 *  file rather than logged, so every surface can say the same thing — an
 *  export that quietly drops half a canvas is the worst kind of success. */
export interface ExportLosses {
    versions: number;
    threads: number;
    properties: number;
    reactions: number;
}
/**
 * Array order IS z-order in this format — first is furthest back — so items
 * are written in the order the canvas holds them, which is the order they were
 * added. isocan has no z-index of its own to honour beyond that.
 */
export declare function toJsonCanvas(canvas: CanvasContents, 
/**
 * What only a caller that can read blobs knows.
 *
 * `fileRef` names an item's bytes; without it a `file` node carries the
 * filename, which is what a reader with the directory beside it wants
 * anyway. `bodyOf` hands over a site item's `text/uri-list` content — the
 * URL lives in the BYTES, not in the version record, so core cannot reach it
 * and an exporter that pretended otherwise would silently downgrade every
 * link to a file.
 */
read?: {
    fileRef?: (item: Item, filename: string) => string;
    bodyOf?: (item: Item) => string | null;
}): {
    file: JsonCanvasFile;
    lost: ExportLosses;
};
/** One sentence per surface, so the CLI and the app warn identically. */
export declare function describeLosses(lost: ExportLosses): string[];
