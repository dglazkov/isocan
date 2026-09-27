/**
 * The extension a stored blob is filed under, dot NOT included — "md", "png",
 * "bin". Prefer the real filename's extension; fall back to the table above,
 * read backwards.
 *
 * TWO backings compute a storage filename from a mime type: `<sha256>.<ext>`
 * on a disk and `canvases/{id}/blobs/<sha256>.<ext>` in a bucket, deliberately
 * the same addressing so a home can be copied from one to the other by hand.
 * This used to keep its own mime → extension map in `filenames.ts` for that
 * reason — and so became the second copy of the table it existed to stop
 * copying (cleanup DU-4, 27 Sep 2026). One table now, both directions: a PDF
 * with no extension files as `.pdf` because `mimeFromName` knows a `.pdf`.
 * A backing records the name it wrote, so blobs already stored keep theirs.
 *
 * `text/uri-list` is the one row the table cannot hold: it is a site item's
 * mime (`BROWSER_MIME`), and a `.uri` file added by name must not become one.
 */
export declare function extensionFor(filename: string, mimeType: string): string;
/**
 * **The mime a name implies, or nothing** — a loaded module's extensions
 * first, then the table.
 *
 * The order is the shared fact, not an implementation detail: `isocan add
 * diagram.mmd` and dropping the same file on the canvas must both land it as
 * the module's kind, and both must fall back to the same answer once the
 * module is gone. Two copies of that order is how one surface would keep
 * calling a file a diagram after the other stopped.
 *
 * Answers `undefined` rather than a default, because the two callers have
 * different last resorts — the CLI has nothing else to go on, the browser
 * still has whatever `file.type` said.
 */
export declare function mimeFromName(filename: string): string | undefined;
/**
 * **Sensible default canvas footprint per media kind.**
 *
 * The web reads an image's natural size and only falls back here; the CLI has
 * no way to measure, so this is its answer. It was three number pairs written
 * out twice — `cli/src/mime.ts` and `web/src/lib/upload.ts` — which is the
 * shape a fact takes just before the two copies stop agreeing.
 */
export declare function defaultSize(mimeType: string): {
    width: number;
    height: number;
};
