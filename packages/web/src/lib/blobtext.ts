/**
 * A blob's body as text, memoized.
 *
 * Lifted out of ItemView so more than one renderer can read a file without
 * fetching it twice — and without importing from the component that renders
 * it, which would be a cycle.
 */
const textCache = new Map<string, string>();

/**
 * Only a 2xx is cached — a 404's body is the daemon's
 * `{"error":"blob not found"}`, and reading that as the document is how that
 * JSON ends up rendered on the canvas, then remembered as the file's contents
 * for the rest of the session.
 */
export async function fetchBlobText(url: string): Promise<string> {
  const cached = textCache.get(url);
  if (cached !== undefined) return cached;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.text();
  textCache.set(url, body);
  return body;
}

/** What is already in hand, for a first paint with no flash of "…". */
export const peekBlobText = (url: string): string | undefined => textCache.get(url);

/** Loaded text, a load failure, or neither yet. */
export type TextLoad = { text: string } | { failed: string } | null;
