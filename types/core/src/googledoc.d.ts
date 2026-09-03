import type { Item } from "./model.js";
/**
 * **A Google Doc on the canvas**
 * (`docs/research/2026-09-02-google-docs-on-the-canvas.md`, stages 2–3).
 *
 * One item per doc, holding both halves: the doc's markdown export as the
 * item's version blob — so the canvas can render it, search it, thumb it,
 * version it and hand it to an agent — and the doc's own address as
 * `source`, the property the ↗ opens (the same one a canvas item wears).
 * `synced` records when the snapshot was taken, so a sync knows what it is
 * comparing against and a reader knows how old the words are.
 *
 * Nothing here talks to Google: this file knows the shape of a doc's
 * address and its export URL, and how to name what comes back. The daemon
 * fetches for the app (a browser cannot read docs.google.com cross-origin),
 * the CLI fetches for itself, and both put the same item on the canvas.
 *
 * **Public docs only, today.** The anonymous export works for a doc shared
 * by link; a private one answers with a sign-in page, which `docTitleFrom`
 * would read as a title — so the fetchers check the content type and refuse
 * HTML. The credentialed path (a Drive token on the machine that syncs) is
 * the research note's stage 3 and is not built.
 */
export declare const DOC_SYNCED_PROP = "synced";
export declare const DOC_MIME = "text/markdown";
/** The document id inside any docs.google.com document address, or null. */
export declare function googleDocId(url: string): string | null;
/** The doc's canonical address — what `source` records and the ↗ opens. */
export declare function googleDocUrl(id: string): string;
/** Where the markdown comes from, anonymously, for a doc shared by link. */
export declare function googleDocExportUrl(id: string): string;
/**
 * **The credentialed half** (stage 3): the Drive API, for a doc the
 * anonymous export refuses. `files.export` hands back the same markdown
 * with a bearer token; `files.get` with `modifiedTime` is the one metadata
 * call a sync makes before deciding whether to read the words again. The
 * token lives on the machine that syncs (`~/.isocan/google.json`), never on
 * the canvas — core only knows the addresses.
 */
export declare function googleDriveExportUrl(id: string): string;
export declare function googleDriveMetaUrl(id: string): string;
/** Who a token speaks for — what `isocan gdoc auth` prints to say it works. */
export declare const GOOGLE_DRIVE_ABOUT_URL = "https://www.googleapis.com/drive/v3/about?fields=user";
/** Has the doc moved since the snapshot? Both ISO stamps; an item that never
 *  said when it synced is always stale. */
export declare function docStale(syncedAt: string | null, modifiedTime: string): boolean;
/** The framed, read-only form — the live mode the note designs (stage 4). */
export declare function googleDocPreviewUrl(id: string): string;
/** A title from the export: the first heading, else the first line that says
 *  anything, else the id. Trimmed to a title's length. */
export declare function docTitleFrom(markdown: string, fallback: string): string;
/** A filename for the item's version: the title as a slug, `.md`. */
export declare function docFilenameFrom(title: string): string;
/** The properties a doc item wears at placement and after every sync. */
export declare function docProperties(source: string, syncedAt: string): Record<string, string>;
/** Is this item a Google Doc's snapshot — the ones `gdoc sync` refreshes. */
export declare function isGoogleDocItem(item: Item): boolean;
/** When the snapshot was taken, or null for an item that never said. */
export declare function docSyncedAt(item: Item): string | null;
