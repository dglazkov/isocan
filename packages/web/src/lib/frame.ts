import { blobUrl } from "./api.ts";

/**
 * **Where this tab loads item content from, and what that origin asks of
 * it** — the app's whole knowledge of the content origin, in one value.
 *
 * `ticket` is the stage-4b half (`content-read-auth.md`, option A). Null
 * means the origin serves unsigned, which is every local home: loopback,
 * single-user, hash-addressed. A function means the origin serves strangers
 * and asks for a short-lived signature the badged app origin minted — and it
 * may answer `null` for "not minted yet", which is not the same thing at all
 * and is why the two are different shapes rather than a nullable string.
 */
export interface ContentOrigin {
  /** Origin only, no trailing slash: `http://127.0.0.1:4442`,
   * `https://isocan.store`. */
  base: string;
  /** The signed path for these bytes, `null` while it is still being minted,
   * or the whole field null on an origin that asks for no signature. */
  ticket: ((canvasId: string, blobHash: string) => string | null) | null;
}

/**
 * The ONE builder of an item frame's `src` and `sandbox` — invariant 2 of
 * `docs/projects/atlas/content-origin-plan.md`, as code: the sandbox upgrade
 * is keyed to the split, never to a flag. `allow-same-origin` appears if and
 * only if the src is on a different origin from the app, so the pair
 * "app-origin src + allow-same-origin" — the whole-home compromise the
 * content-origin proposal opens with — is unbuildable rather than avoided.
 *
 * With no content origin (a home that advertises none), this returns exactly
 * what `ItemView` always rendered: a same-origin path under `allow-scripts`
 * alone, the opaque-origin frame that can reach nothing. With one, the src
 * moves to the content origin — an origin that holds no cookie, no badge and
 * no API, which is what makes "same origin" safe to grant there: the page
 * gains its own storage and loses nothing of ours to reach.
 *
 * **Null means "not yet", and only ever that** (stage 4b). On an origin that
 * wants a signature, a frame cannot be built until one has been minted, and
 * the honest answer for those few milliseconds is nothing to render — never
 * an app-origin src, which would be today's frame wearing tomorrow's grant.
 * The caller shows a blank card and re-renders when the ticket lands.
 *
 * `srcdoc` frames are not built here and must not be: the draft preview's
 * `allow-scripts` srcdoc is opaque-origin and local by construction, and the
 * edit-text frame's `allow-same-origin`-with-dead-scripts is its own
 * measured posture (`TextEditFrame`). This builder is for frames that load
 * a stored blob by URL.
 */
export function itemFrame(
  origin: ContentOrigin | null,
  canvasId: string,
  blobHash: string,
): { src: string; sandbox: string } | null {
  if (origin === null) {
    return { src: blobUrl(canvasId, blobHash), sandbox: "allow-scripts" };
  }
  const path = origin.ticket ? origin.ticket(canvasId, blobHash) : blobUrl(canvasId, blobHash);
  if (path === null) return null;
  return { src: `${origin.base}${path}`, sandbox: "allow-scripts allow-same-origin" };
}
