/**
 * "This tab is running last week's app."
 *
 * A daemon restart hands the socket back and the canvas keeps working — the
 * replica resyncs, unknown ops trigger a fresh snapshot — but the JavaScript
 * in this tab is whatever was served when it loaded. After an upgrade that is
 * the old app, indefinitely, and nothing on screen says so.
 *
 * Nothing needs to be versioned to notice: Vite hashes the entry bundle's
 * filename by content, and the running module knows its own URL. Ask the
 * server which bundle its index.html points at now; if it isn't this one, the
 * app on disk has moved on.
 */

/** The entry bundle this tab is running, e.g. "index-7PNG8ZF_.js". */
export function runningBundle(url = import.meta.url): string | null {
  const match = /\/assets\/([^/?#]+\.js)/.exec(url);
  return match ? match[1]! : null;
}

/** The entry bundle the server is serving right now, from its index.html. */
export function servedBundle(html: string): string | null {
  const match = /<script[^>]+src="\/assets\/([^"]+\.js)"/.exec(html);
  return match ? match[1]! : null;
}

/**
 * True when the server is serving a different build than this tab is running.
 * Unknowns are never an update: a dev server (no hashed assets), a fetch that
 * failed, or an index.html we cannot parse must not nag.
 */
export function isOutdated(running: string | null, served: string | null): boolean {
  return Boolean(running && served && running !== served);
}

export async function checkForUpdate(): Promise<boolean> {
  if (import.meta.env.DEV) return false; // vite serves unhashed modules
  const running = runningBundle();
  if (!running) return false;
  try {
    const res = await fetch("/", { cache: "no-store" });
    if (!res.ok) return false;
    return isOutdated(running, servedBundle(await res.text()));
  } catch {
    return false;
  }
}
