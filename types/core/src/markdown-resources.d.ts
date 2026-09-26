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
/**
 * **The answer for a link or image that needs no canvas to settle** — a
 * `#fragment`, an external address, or a scheme that is not allowed — or null
 * when the target is a path to resolve against the canvas's files.
 *
 * Split out of `markdownResource` so the renderer can ask it BEFORE reading
 * the canvas: a note whose every link is external never needs the canvas at
 * all, and a renderer subscribed to the whole canvas re-parsed every note on
 * the screen on every operation anybody made (26 Sep 2026: 250 notes, one
 * collaborator dragging one item, half-second frames). One rule, two callers.
 */
export declare function markdownTargetOffCanvas(raw: string): MarkdownResource | null;
export {};
