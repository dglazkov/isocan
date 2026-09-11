import type { CanvasContents, Item } from "./model.js";
/** Import provenance only: unlike `file`, this never asks a machine to write a file. */
export declare const SOURCE_PATH_PROP = "sourcePath";
type MarkdownResource = {
    kind: "external" | "fragment";
    url: string;
} | {
    kind: "item";
    itemId: string;
    blobHash: string;
    mimeType: string;
    fragment: string;
} | {
    kind: "missing" | "ambiguous" | "unsafe";
    path: string;
};
/** Resolve against saved canvas resources, never the app URL or the daemon's disk.
 * A duplicate path is ambiguous; a basename in another directory is not a match. */
export declare function markdownResource(canvas: CanvasContents, source: Item, versionId: string, raw: string): MarkdownResource;
export {};
