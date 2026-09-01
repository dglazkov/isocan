/**
 * Item names and the files under them.
 *
 * An item has a title (what people call it) and its version has a filename
 * (what it is called when it leaves the canvas — `isocan get`, a download, the
 * blob on disk). Renaming an item should move both, or the name you gave it on
 * the canvas is not the name you get in your Downloads folder.
 *
 * Blobs are content-addressed, so two files sharing a name collide nowhere on
 * disk — but they collide in every place a person reads them, which is reason
 * enough to keep them apart.
 */
import type { CanvasContents } from "./model.js";
/** The extension, dot included, or "" — the part a rename must not touch. */
export declare function extensionOf(filename: string): string;
/**
 * The extension a stored blob is filed under, dot NOT included — "md", "png",
 * "bin". Prefer the real filename's extension; fall back to a small mime map.
 *
 * Lives here rather than in a backing because TWO backings now compute a
 * storage filename from a mime type: `<sha256>.<ext>` on a disk and
 * `canvases/{id}/blobs/<sha256>.<ext>` in a bucket, deliberately the same
 * addressing so a home can be copied from one to the other by hand. Two
 * copies of this map would drift, and the drift would be silent — the same
 * bytes filed under two names, and a `.bin` where a `.png` should have been.
 */
export declare function extensionFor(filename: string, mimeType: string): string;
/**
 * A title as a filename: "Bass tab v2" → "bass-tab-v2.svg". Keeps the old
 * extension, because renaming a drawing does not make it a different kind of
 * file. A title with nothing usable in it (an emoji, say) keeps the old stem
 * rather than becoming a bare extension.
 */
export declare function filenameFromTitle(title: string, previous: string): string;
/**
 * `candidate`, or the next free "<stem>-2.<ext>" if it is taken. Case is not
 * the difference between two names: macOS would agree, and so would a person.
 */
export declare function uniqueFilename(candidate: string, taken: Iterable<string>): string;
/** Every filename in use on this canvas, ignoring one item — the one being
 * renamed does not collide with itself. */
export declare function filenamesInUse(canvas: CanvasContents, exceptItemId?: string): string[];
/** The filename a rename should land on: derived from the title, then moved
 * aside if the canvas is already using it. */
export declare function renamedFilename(canvas: CanvasContents, itemId: string, title: string, previous: string): string;
