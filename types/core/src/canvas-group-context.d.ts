import type { CanvasContents, Item, ItemVersion } from "./model.js";
/** A caller chooses scope; only the writer chooses membership and version metadata. */
export interface ContextRequest {
    rootIds: string[];
    includeExcluded?: boolean;
    expectedRevision?: number;
}
/** One hierarchy row, retained even when its content is excluded or unavailable. */
interface ContextEntry {
    itemId: string;
    parentId: string | null;
    depth: number;
    title: string;
    kind: string;
    excluded: boolean;
    unavailable?: string;
    version: ItemVersion | null;
    threadIds: string[];
    /** Ink keeps its target and normalized region even after the original items are gone. */
    annotation?: {
        targetId: string;
        region: string | null;
    };
}
/** The exact scope of a message at one writer revision, independent of later item edits. */
export interface ContextManifest {
    canvasId: string;
    revision: number;
    rootIds: string[];
    expandedIds: string[];
    includeExcluded: boolean;
    ambient: boolean;
    entries: ContextEntry[];
    counts: {
        included: number;
        excluded: number;
        unavailable: number;
    };
}
/** Paged references keep a complete manifest separate from the content actually retrieved. */
export interface ContextContentPage {
    canvasId: string;
    revision: number;
    offset: number;
    limit: number;
    total: number;
    nextOffset: number | null;
    entries: Array<{
        itemId: string;
        versionId: string | null;
        face: "source" | "visual";
        status: "available" | "excluded" | "unavailable";
        reason?: string;
        blob?: {
            blobHash: string;
            mimeType: string;
            filename: string;
            size: number;
        };
        url?: string;
    }>;
    /** Counts describe this page; the manifest counts describe its entire scope. */
    counts: {
        included: number;
        excluded: number;
        unavailable: number;
    };
}
/** Deterministic hierarchy traversal; attachment targets and unrelated links are never followed. */
export declare function contextClosure(canvas: CanvasContents, rootIds: readonly string[]): Array<{
    itemId: string;
    depth: number;
}>;
/** Shared with fresh manifest resolution so ambient exclusion has one ancestor rule. */
export declare function excludedInAmbient(canvas: CanvasContents, item: Item): boolean;
/** Pins name roots, while group exclusions govern the whole ambient subtree. */
export declare function ambientContextItems(canvas: CanvasContents): Item[];
/** Replay validates retained metadata without consulting live items which may be long gone. */
export declare function validateContextManifest(value: ContextManifest, canvasId: string): void;
/** Shared protected route spelling for complete live context and its paged references. */
export declare function canvasContextRoute(canvasId: string): string;
/** A saved request is addressed by its comment, never by re-resolving its former roots. */
export declare function commentContextRoute(canvasId: string, threadId: string, commentId: string): string;
export {};
