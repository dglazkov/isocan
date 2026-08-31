/**
 * A blob's body as text, memoized.
 *
 * Lifted out of ItemView so more than one renderer can read a file without
 * fetching it twice — and without importing from the component that renders
 * it, which would be a cycle.
 */
import { readBlobText } from "./api.ts";

const textCache = new Map<string, string>();

/** Keyed by the pair, not by a URL: the route is `api.ts`'s to spell, and a
 *  cache that takes a URL is a cache that can be handed one from anywhere. */
const cacheKey = (canvasId: string, blobHash: string) => `${canvasId}/${blobHash}`;

/**
 * Only a 2xx is cached — `readBlobText` throws on anything else, which is
 * what keeps a 404's body (the daemon's own `{"error":"blob not found"}`)
 * from being read as the document, rendered on the canvas, and then
 * remembered as the file's contents for the rest of the session.
 *
 * And a 401 is not a failure at all until `readBlobText` has knocked on the
 * door: a cleared cookie used to reach every reader here as `HTTP 401`, which
 * each of them drew as "couldn't load this file" — true of the cookie, and
 * not of the file.
 */
export async function fetchBlobText(canvasId: string, blobHash: string): Promise<string> {
  const key = cacheKey(canvasId, blobHash);
  const cached = textCache.get(key);
  if (cached !== undefined) return cached;
  const body = await readBlobText(canvasId, blobHash);
  textCache.set(key, body);
  return body;
}

/** What is already in hand, for a first paint with no flash of "…". */
export const peekBlobText = (canvasId: string, blobHash: string): string | undefined =>
  textCache.get(cacheKey(canvasId, blobHash));

/** Loaded text, a load failure, or neither yet. */
export type TextLoad = { text: string } | { failed: string } | null;
