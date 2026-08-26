import { blobUrl } from "./api.ts";

/**
 * The ONE builder of an item frame's `src` and `sandbox` — invariant 2 of
 * `docs/projects/atlas/content-origin-plan.md`, as code: the sandbox upgrade
 * is keyed to the split, never to a flag. `allow-same-origin` appears if and
 * only if the src is on a different origin from the app, so the pair
 * "app-origin src + allow-same-origin" — the whole-home compromise the
 * content-origin proposal opens with — is unbuildable rather than avoided.
 *
 * With no content base (every home today), this returns exactly what
 * `ItemView` always rendered: a same-origin path under `allow-scripts`
 * alone, the opaque-origin frame that can reach nothing. With one, the src
 * moves to the content origin — an origin that holds no cookie, no badge and
 * no API, which is what makes "same origin" safe to grant there: the page
 * gains its own storage and loses nothing of ours to reach.
 *
 * `srcdoc` frames are not built here and must not be: the draft preview's
 * `allow-scripts` srcdoc is opaque-origin and local by construction, and the
 * edit-text frame's `allow-same-origin`-with-dead-scripts is its own
 * measured posture (`TextEditFrame`). This builder is for frames that load
 * a stored blob by URL.
 */
export function itemFrame(
  contentBase: string | null,
  canvasId: string,
  blobHash: string,
): { src: string; sandbox: string } {
  const path = blobUrl(canvasId, blobHash);
  if (contentBase === null) return { src: path, sandbox: "allow-scripts" };
  return { src: `${contentBase}${path}`, sandbox: "allow-scripts allow-same-origin" };
}
