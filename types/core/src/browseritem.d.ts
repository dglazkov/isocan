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
export declare const BROWSER_MIME = "text/uri-list";
/**
 * What a human types → what the iframe loads. "localhost:5173" means
 * "http://localhost:5173"; anything that is not http(s) after that is an
 * error, not a guess.
 */
export declare function normalizeSiteUrl(input: string): string;
/** First URL in a text/uri-list body (lines starting with # are comments). */
export declare function parseUriList(text: string): string | null;
/** "http://localhost:5173/" → "localhost:5173" — the title a projection
 * wears by default: the address as a person would say it. */
export declare function siteLabel(url: string): string;
/** A filename for the version, so old builds' fallback card and `isocan ls`
 * still say what this is: "localhost-5173.uri". */
export declare function siteFilename(url: string): string;
