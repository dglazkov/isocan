import type { Item } from "./model.js";
import type { Operation } from "./ops.js";
import { type MotionBuild } from "./motion.js";
import { type MotionRenderedFrom } from "./motion-render.js";
/** How a surface uploads bytes and sends one op in one group — the two things that differ between them. */
export interface MotionWriter {
    upload: (bytes: Uint8Array, mimeType: string, filename: string) => Promise<{
        blobHash: string;
        size: number;
    }>;
    send: (op: Operation, group: string) => Promise<void>;
}
/** The gap between what a motion is made from and what is placed beside it, in world units. */
export declare const MOTION_BESIDE = 40;
/**
 * **A new motion item, beside the selection** — `isocan motion new`'s and
 * *Animate…*'s one write. Sized to the stage with the player's controls
 * below it, so the drawing is never under them. `description` is the words
 * it was made from, when there were words.
 */
export declare function addMotionItem(w: MotionWriter, built: MotionBuild, title: string, description?: string): Promise<{
    itemId: string;
    filename: string;
}>;
/**
 * **A new version of a motion** — `motion edit`, `motion refresh` and
 * *Refresh from sources*: the new document and the properties that describe
 * it in one `item.edit`, conditional on the version the caller read, so an
 * edit made from a stale read is refused rather than stacked on top.
 */
export declare function versionMotionItem(w: MotionWriter, motion: Pick<Item, "id" | "title" | "currentVersionId" | "versions">, built: MotionBuild, description?: string): Promise<{
    versionId: string;
}>;
/**
 * **A movie of a motion, beside it** — `isocan motion render`'s and *Render
 * movie…*'s one write: a `video/mp4`, `video/webm` or `image/gif` item, as
 * `renderedFrom.format` says (an MP4 when it says nothing), as wide as the
 * motion, as tall as the frame's shape says, wearing `renderedFrom`.
 */
export declare function addMotionMovie(w: MotionWriter, motion: Pick<Item, "title" | "x" | "y" | "width">, bytes: Uint8Array, renderedFrom: MotionRenderedFrom): Promise<{
    itemId: string;
    title: string;
    filename: string;
}>;
