import type { Item } from "@isocan/core";
import { visualFaceOf } from "@isocan/core";

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
  uploadBlob(bytes: Uint8Array, mimeType: string, filename: string, signal?: AbortSignal): Promise<{ blobHash: string }>;
  /** sha256, hex — the same spelling the store addresses blobs by. */
  digest(bytes: Uint8Array, signal?: AbortSignal): Promise<string>;
}

/** Every face the frozen source snapshot needs: each item's current version
 *  and its visual face, deduplicated, because two items may share bytes. */
export function copyFaces(items: readonly Item[]): CopyFace[] {
  const faces = new Map<string, CopyFace>();
  for (const item of items) {
    const version = item.versions.find((entry) => entry.id === item.currentVersionId);
    if (!version) continue;
    faces.set(version.blobHash, version);
    const visual = visualFaceOf(version);
    faces.set(visual.blobHash, visual);
  }
  return [...faces.values()];
}

/** Read and verify every face; upload it too when the destination is another
 *  canvas, where a blob is addressed per canvas and the bytes have to be put
 *  where the new item will look for them. A same-canvas copy still checks
 *  every byte: a missing face refuses the whole paste. */
export async function transferCopyFaces(
  io: CopyBytesPort,
  faces: readonly CopyFace[],
  options: { upload: boolean; signal?: AbortSignal | undefined },
): Promise<void> {
  for (const face of faces) {
    options.signal?.throwIfAborted();
    const bytes = await io.downloadBlob(face.blobHash, options.signal);
    options.signal?.throwIfAborted();
    if (await io.digest(bytes, options.signal) !== face.blobHash) throw new Error(`copy could not verify saved bytes ${face.blobHash}`);
    options.signal?.throwIfAborted();
    if (!options.upload) continue;
    const uploaded = await io.uploadBlob(bytes, face.mimeType, face.filename, options.signal);
    if (uploaded.blobHash !== face.blobHash) throw new Error("copied blob upload hash disagreed with its bytes");
  }
}
