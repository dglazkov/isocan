import { extensionOf } from "./filenames.ts";
import { moduleKinds } from "./modules.ts";

/**
 * **What a file is, and how big it lands** — the two facts the CLI and the web
 * app both need about a file they are given, in one place.
 *
 * Step 4 of `docs/research/2026-09-06-architecture-review.md`, and the review
 * that prompted it was half right in an instructive way. It read the web's five
 * extensions as an incomplete copy of the CLI's fourteen and proposed one
 * canonical `mimeFor`. **The two entry points are not duplication and stay:**
 *
 * - `mimeFor(filename)` has **only an extension** to go on. The table is its
 *   whole knowledge.
 * - `mimeTypeOf(file)` already holds `file.type` from the browser and reaches
 *   for the table **only as a patch**, when the browser said nothing useful. A
 *   browser gets `image/png` right; it gets `.md` wrong.
 *
 * Collapsing those into one signature would be a regression dressed as
 * tidying. What IS shared — and what was genuinely duplicated — is the table
 * itself, the order it is consulted in, and `defaultSize`. Those are here.
 *
 * The web now consults the whole table rather than the five rows browsers get
 * wrong. That is not the dead weight it looks like: the table is reached only
 * when `file.type` was empty or `application/octet-stream`, so extra rows can
 * only ever improve an answer the browser declined to give, and can never
 * override one it did.
 */
const BY_EXT: Record<string, string> = {
  md: "text/markdown",
  markdown: "text/markdown",
  html: "text/html",
  htm: "text/html",
  txt: "text/plain",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};

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
export function mimeFromName(filename: string): string | undefined {
  const ext = extensionOf(filename).slice(1).toLowerCase();
  if (!ext) return undefined;
  const added = moduleKinds().find((k) => k.extensions?.includes(ext));
  if (added) return added.mimes[0]!;
  return BY_EXT[ext];
}

/**
 * **Sensible default canvas footprint per media kind.**
 *
 * The web reads an image's natural size and only falls back here; the CLI has
 * no way to measure, so this is its answer. It was three number pairs written
 * out twice — `cli/src/mime.ts` and `web/src/lib/upload.ts` — which is the
 * shape a fact takes just before the two copies stop agreeing.
 */
export function defaultSize(mimeType: string): { width: number; height: number } {
  if (mimeType.startsWith("image/")) return { width: 480, height: 360 };
  if (mimeType.startsWith("video/")) return { width: 480, height: 270 };
  return { width: 420, height: 320 };
}
