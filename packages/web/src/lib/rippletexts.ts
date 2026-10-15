import type { ItemVersion } from "@isocan/core";
import { readBlobText } from "./api.ts";

/**
 * **The words a ripple reads, fetched once** (proactive-agent phase 6). The
 * pulse strip and the ripple panel both read a run's two ends and every
 * screen in its scope (`rippleVersions` says which); a blob's words never
 * change, so one cache by hash serves both, and only the lazy ripple chunk
 * imports this.
 */
const cache = new Map<string, string>();
const pending = new Map<string, Promise<void>>();

/** A version's words, if they have been read — `rippleRead`'s `textOf`. */
export function rippleText(v: ItemVersion): string | undefined {
  return cache.get(v.blobHash);
}

/** Read the versions not read yet; resolves true when any arrived. A blob that cannot be read stays unread, and the ripple waits rather than guesses. */
export async function readRippleTexts(canvasId: string, versions: readonly ItemVersion[]): Promise<boolean> {
  const missing = versions.filter((v) => !cache.has(v.blobHash));
  if (!missing.length) return false;
  await Promise.all(missing.map((v) => {
    let p = pending.get(v.blobHash);
    if (!p) {
      p = readBlobText(canvasId, v.blobHash)
        .then((text) => void cache.set(v.blobHash, text))
        .catch(() => undefined)
        .finally(() => pending.delete(v.blobHash));
      pending.set(v.blobHash, p);
    }
    return p;
  }));
  return missing.some((v) => cache.has(v.blobHash));
}
