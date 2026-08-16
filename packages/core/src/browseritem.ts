/**
 * The mini-browser item (#40): a live site — typically a localhost dev
 * server — projected onto the canvas. Deliberately NOT a new op type: the
 * item is an ordinary `item.add` whose version blob is a `text/uri-list`
 * (the registered MIME type for "this file is a URL") holding the projected
 * URL. Everything the vocabulary already promises comes free — undo is
 * `item.delete`, changing the URL is `item.addVersion` (so `isocan edit`
 * and the version fan-out just work), GC keeps the blob alive — and a build
 * that predates the feature renders the generic file card instead of
 * corrupting or resyncing.
 *
 * These helpers are the contract both clients share, so the CLI and the web
 * app can never disagree about what the blob means.
 */

export const BROWSER_MIME = "text/uri-list";

/**
 * What a human types → what the iframe loads. "localhost:5173" means
 * "http://localhost:5173"; anything that is not http(s) after that is an
 * error, not a guess.
 */
export function normalizeSiteUrl(input: string): string {
  const trimmed = input.trim();
  if (trimmed === "") throw new Error("empty URL");
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error(`not a URL: ${input}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`only http(s) can be projected, got: ${url.protocol}`);
  }
  return url.href;
}

/** First URL in a text/uri-list body (lines starting with # are comments). */
export function parseUriList(text: string): string | null {
  for (const line of text.split(/\r?\n/)) {
    const entry = line.trim();
    if (entry !== "" && !entry.startsWith("#")) return entry;
  }
  return null;
}

/** "http://localhost:5173/" → "localhost:5173" — the title a projection
 * wears by default: the address as a person would say it. */
export function siteLabel(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/** A filename for the version, so old builds' fallback card and `isocan ls`
 * still say what this is: "localhost-5173.uri". */
export function siteFilename(url: string): string {
  const stem = siteLabel(url).replace(/[^a-zA-Z0-9.-]+/g, "-").replace(/^-+|-+$/g, "");
  return `${stem || "site"}.uri`;
}
