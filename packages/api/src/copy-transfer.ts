import { visualFaceOf, type Item } from "@isocan/core";

/** Both copy callers verify exactly the captured current source and visual faces. */
export async function transferCopyFaces(items: readonly Item[], io: {
  read(hash: string, signal?: AbortSignal): Promise<Uint8Array>;
  upload?(bytes: Uint8Array, mimeType: string, filename: string, signal?: AbortSignal): Promise<{ blobHash: string }>;
}, signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted();
  const faces = new Map<string, { blobHash: string; mimeType: string; filename: string }>();
  for (const item of items) {
    const current = item.versions.find((version) => version.id === item.currentVersionId);
    if (!current) throw new Error(`copy cannot read the current version of ${item.id}`);
    faces.set(current.blobHash, current);
    const visual = visualFaceOf(current);
    faces.set(visual.blobHash, visual);
  }
  for (const face of faces.values()) {
    signal?.throwIfAborted();
    const bytes = await io.read(face.blobHash, signal);
    signal?.throwIfAborted();
    const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
    const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    if (hash !== face.blobHash) throw new Error(`copy could not verify saved bytes ${face.blobHash}`);
    signal?.throwIfAborted();
    if (io.upload) {
      const uploaded = await io.upload(bytes, face.mimeType, face.filename, signal);
      signal?.throwIfAborted();
      if (uploaded.blobHash !== face.blobHash) throw new Error("copied blob upload hash disagreed with its bytes");
    }
  }
}
