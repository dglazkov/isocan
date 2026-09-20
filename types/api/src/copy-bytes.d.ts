import type { Item } from "../../core/src/index.js";
/**
 * **The bytes half of a copy, once**, for every act that copies items between
 * canvases: ordinary `canvas copy --from`, and the deliberate pin-from-source
 * act in `context-pin.ts`.
 *
 * It is here rather than inside `CanvasGroups` because a browser cannot import
 * `node:crypto`, and the one thing a second implementation would be free to
 * get wrong is exactly the thing this does: **verify before you write.** A
 * copy that uploaded whatever arrived would happily reproduce a corrupted or
 * substituted face under the hash the new item is about to claim, and nothing
 * downstream would ever notice — the item would simply be wrong forever.
 *
 * So the digest is injected (Node's `createHash`, the browser's `crypto.subtle`)
 * and the ORDER is the contract: every face of every item is read and verified,
 * and uploaded where the canvas differs, BEFORE the single structural act is
 * submitted. A missing child cannot leave a plausible-looking partial group.
 */
export interface CopyFace {
    blobHash: string;
    mimeType: string;
    filename: string;
}
/** Transport bound to one source and one destination by whoever injects it,
 *  so a caller here cannot accidentally read a canvas it did not classify. */
export interface CopyBytesPort {
    downloadBlob(blobHash: string, signal?: AbortSignal): Promise<Uint8Array>;
    uploadBlob(bytes: Uint8Array, mimeType: string, filename: string, signal?: AbortSignal): Promise<{
        blobHash: string;
    }>;
    /** sha256, hex — the same spelling the store addresses blobs by. */
    digest(bytes: Uint8Array, signal?: AbortSignal): Promise<string>;
}
/** Every face the frozen source snapshot needs: each item's current version
 *  and its visual face, deduplicated, because two items may share bytes. */
export declare function copyFaces(items: readonly Item[]): CopyFace[];
/** Read and verify every face; upload it too when the destination is another
 *  canvas, where a blob is addressed per canvas and the bytes have to be put
 *  where the new item will look for them. A same-canvas copy still checks
 *  every byte: a missing face refuses the whole paste. */
export declare function transferCopyFaces(io: CopyBytesPort, faces: readonly CopyFace[], options: {
    upload: boolean;
    signal?: AbortSignal | undefined;
}): Promise<void>;
