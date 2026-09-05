import type { CanvasContents, Item } from "./model.ts";
import { moduleEdges } from "./modules.ts";
import { BROWSER_MIME, parseUriList } from "./browseritem.ts";

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

interface JsonCanvasNode {
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

interface JsonCanvasEdge {
  id: string;
  fromNode: string;
  toNode: string;
  /** The spec's ends; an isocan map edge points at the child. */
  toEnd?: "none" | "arrow";
  label?: string;
}

interface JsonCanvasFile {
  nodes: JsonCanvasNode[];
  edges: JsonCanvasEdge[];
}

/** What this canvas holds that the format has no room for. Returned beside the
 *  file rather than logged, so every surface can say the same thing — an
 *  export that quietly drops half a canvas is the worst kind of success. */
interface ExportLosses {
  versions: number;
  threads: number;
  properties: number;
  reactions: number;
}

const current = (item: Item) =>
  item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions[item.versions.length - 1];

/**
 * Array order IS z-order in this format — first is furthest back — so items
 * are written in the order the canvas holds them, which is the order they were
 * added. isocan has no z-index of its own to honour beyond that.
 */
export function toJsonCanvas(
  canvas: CanvasContents,
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
  read: {
    fileRef?: (item: Item, filename: string) => string;
    bodyOf?: (item: Item) => string | null;
  } = {},
): { file: JsonCanvasFile; lost: ExportLosses } {
  const nodes: JsonCanvasNode[] = [];
  for (const item of Object.values(canvas.items)) {
    const version = current(item);
    if (!version) continue;
    const base = {
      id: item.id,
      x: Math.round(item.x),
      y: Math.round(item.y),
      width: Math.round(item.width),
      height: Math.round(item.height),
    };
    /**
     * A site item is a `text/uri-list` blob, which IS the format's `link` node
     * — the one place the two vocabularies already agree on a thing rather
     * than on a rectangle. The URL is in the bytes, so it is only available
     * when the caller could read them; without it the item is still exported,
     * as a file, rather than dropped.
     */
    if (version.mimeType === BROWSER_MIME && read.bodyOf) {
      const body = read.bodyOf(item);
      const url = body ? parseUriList(body) : null;
      if (url) {
        nodes.push({ ...base, type: "link", url });
        continue;
      }
    }
    nodes.push({
      ...base,
      type: "file",
      file: read.fileRef ? read.fileRef(item, version.filename) : version.filename,
    });
  }

  /**
   * **Edges, which the research could not write.** Every map edge on the
   * canvas, whichever map it belongs to, pointing parent → child with an arrow
   * — the same direction the canvas draws.
   */
  const edges: JsonCanvasEdge[] = moduleEdges(canvas).map(({ from, to }) => ({
    id: `${from.id}-${to.id}`,
    fromNode: from.id,
    toNode: to.id,
    toEnd: "arrow",
  }));

  const items = Object.values(canvas.items);
  return {
    file: { nodes, edges },
    lost: {
      // Every version but the current one: the format holds one state per node.
      versions: items.reduce((n, i) => n + Math.max(0, i.versions.length - 1), 0),
      threads: Object.keys(canvas.threads ?? {}).length,
      properties: items.reduce((n, i) => n + Object.keys(i.properties ?? {}).length, 0),
      reactions: items.reduce((n, i) => n + Object.keys(i.reactions ?? {}).length, 0),
    },
  };
}

/** One sentence per surface, so the CLI and the app warn identically. */
export function describeLosses(lost: ExportLosses): string[] {
  const out: string[] = [];
  if (lost.versions) out.push(`${lost.versions} older version${lost.versions === 1 ? "" : "s"}`);
  if (lost.threads) out.push(`${lost.threads} comment thread${lost.threads === 1 ? "" : "s"}`);
  if (lost.properties) out.push(`${lost.properties} propert${lost.properties === 1 ? "y" : "ies"}`);
  if (lost.reactions) out.push(`${lost.reactions} reaction${lost.reactions === 1 ? "" : "s"}`);
  return out;
}
