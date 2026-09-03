import type { Item } from "./model.ts";
import { SOURCE_PROP, sourceOf } from "./canvasitem.ts";

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

export const DOC_SYNCED_PROP = "synced";
export const DOC_MIME = "text/markdown";

const DOC_ID = /^[A-Za-z0-9_-]{20,}$/;

/** The document id inside any docs.google.com document address, or null. */
export function googleDocId(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  if (!/(^|\.)docs\.google\.com$/.test(parsed.hostname)) return null;
  const match = parsed.pathname.match(/^\/document\/(?:u\/\d+\/)?d\/([^/]+)/);
  if (!match || !DOC_ID.test(match[1]!)) return null;
  return match[1]!;
}

/** The doc's canonical address — what `source` records and the ↗ opens. */
export function googleDocUrl(id: string): string {
  return `https://docs.google.com/document/d/${id}/edit`;
}

/** Where the markdown comes from, anonymously, for a doc shared by link. */
export function googleDocExportUrl(id: string): string {
  return `https://docs.google.com/document/d/${id}/export?format=md`;
}

/**
 * **The credentialed half** (stage 3): the Drive API, for a doc the
 * anonymous export refuses. `files.export` hands back the same markdown
 * with a bearer token; `files.get` with `modifiedTime` is the one metadata
 * call a sync makes before deciding whether to read the words again. The
 * token lives on the machine that syncs (`~/.isocan/google.json`), never on
 * the canvas — core only knows the addresses.
 */
export function googleDriveExportUrl(id: string): string {
  return `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}/export?mimeType=${encodeURIComponent(DOC_MIME)}`;
}

export function googleDriveMetaUrl(id: string): string {
  return `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=modifiedTime,name`;
}

/** Who a token speaks for — what `isocan gdoc auth` prints to say it works. */
export const GOOGLE_DRIVE_ABOUT_URL = "https://www.googleapis.com/drive/v3/about?fields=user";

/** Has the doc moved since the snapshot? Both ISO stamps; an item that never
 *  said when it synced is always stale. */
export function docStale(syncedAt: string | null, modifiedTime: string): boolean {
  if (!syncedAt) return true;
  return Date.parse(modifiedTime) > Date.parse(syncedAt);
}

/** The framed, read-only form — the live mode the note designs (stage 4). */
export function googleDocPreviewUrl(id: string): string {
  return `https://docs.google.com/document/d/${id}/preview`;
}

/** A title from the export: the first heading, else the first line that says
 *  anything, else the id. Trimmed to a title's length. */
export function docTitleFrom(markdown: string, fallback: string): string {
  const lines = markdown.split("\n").map((one) => one.trim());
  const heading = lines.find((one) => /^#{1,6}\s+\S/.test(one));
  const first = heading ? heading.replace(/^#{1,6}\s+/, "") : lines.find((one) => one.length > 0);
  const title = (first ?? "").replace(/[*_`]/g, "").trim();
  if (!title) return fallback;
  return title.length > 80 ? `${title.slice(0, 79)}…` : title;
}

/** A filename for the item's version: the title as a slug, `.md`. */
export function docFilenameFrom(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${slug || "document"}.md`;
}

/** The properties a doc item wears at placement and after every sync. */
export function docProperties(source: string, syncedAt: string): Record<string, string> {
  return { [SOURCE_PROP]: source, [DOC_SYNCED_PROP]: syncedAt };
}

/** Is this item a Google Doc's snapshot — the ones `gdoc sync` refreshes. */
export function isGoogleDocItem(item: Item): boolean {
  const source = sourceOf(item);
  return source !== null && googleDocId(source) !== null;
}

/** When the snapshot was taken, or null for an item that never said. */
export function docSyncedAt(item: Item): string | null {
  return item.properties[DOC_SYNCED_PROP] ?? null;
}
