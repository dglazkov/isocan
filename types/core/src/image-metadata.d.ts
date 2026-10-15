import type { CanvasContents, Item } from "./model.js";
/**
 * **What an image's bytes and its canvas say about it** — shared between the
 * View Focus Metadata Inspector (`/i/:itemId`) and any CLI or test caller.
 *
 * Pure and dependency-free: PNG `IHDR` / `tEXt` / `iTXt`, JPEG `SOF` + `APP1`
 * EXIF TIFF tags, WebP `VP8` / `VP8L` / `VP8X`, GIF headers, and SVG root
 * attributes are read straight from a `Uint8Array` with bounds checks at every
 * offset, so a truncated upload returns whatever facts are readable rather
 * than throwing.
 */
/** Dimensions, color format, and embedded PNG/JPEG/SVG header metadata of an image blob. */
export interface ImageBinaryMetadata {
    format: "png" | "jpeg" | "webp" | "svg" | "gif" | "unknown";
    width: number | null;
    height: number | null;
    aspectRatio: string | null;
    bitDepth?: number;
    colorType?: string;
    hasAlpha?: boolean;
    /** PNG `tEXt` / uncompressed `iTXt` keyword-value pairs (e.g. `Software`, `Description`, `parameters`, `prompt`). */
    textTags: Record<string, string>;
    /** JPEG `APP1` EXIF TIFF tags (e.g. `Make`, `Model`, `Software`, `DateTime`, `ImageDescription`, `Artist`). */
    exifTags: Record<string, string>;
}
/** A canvas item or comment thread that references an image by id, blob hash, or filename. */
export interface ImageBacklink {
    kind: "item-content" | "item-property" | "thread";
    itemId?: string;
    threadId?: string;
    title: string;
    detail: string;
}
/**
 * Human-readable aspect ratio (`"16:9"`, `"4:3"`, `"1:1"`). Falls back to a
 * compact decimal ratio (`"1.85:1"`) when the simplified terms exceed 32.
 */
export declare function formatAspectRatio(width: number, height: number): string | null;
/**
 * Inspect an image's binary header for dimensions, color format, PNG `tEXt` /
 * `iTXt` generation tags, JPEG EXIF fields, or SVG root dimensions.
 */
export declare function parseImageMetadata(bytes: Uint8Array, mimeType?: string): ImageBinaryMetadata;
/**
 * Find every place on `canvas` that references `item` (or any of its versions'
 * blob hashes or filenames):
 * - Other items' `properties` naming `item.id` or a version's `blobHash`.
 * - Other items' text bodies (`itemTexts[otherId]`, e.g. HTML screens or
 *   Markdown docs) referencing a version's `blobHash`, `item.id`, or filename.
 * - Comment threads anchored to `item.id` or citing `#item` via `itemRefs`.
 */
export declare function imageBacklinksIn(canvas: CanvasContents, item: Item, itemTexts?: Readonly<Record<string, string>>): ImageBacklink[];
