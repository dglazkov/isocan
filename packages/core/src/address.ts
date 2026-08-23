/**
 * A canvas's address, spelled in exactly one place.
 *
 * This module exists because of a bug that cost a browser session to find.
 * The product is a **canvas** in the docs and a **project** in the code, and
 * the seam leaked into the one string a stranger pastes to another stranger:
 * the journey and the desk design both wrote `isocan.io/c/7f3a…`, and nothing
 * ever served `/c/` — the app has had exactly two routes, `/` and
 * `/p/:projectId`, since it was written. A doc-shaped share link returned 200,
 * served the app shell, and rendered a blank page.
 *
 * Dimitri settled the address on 2026-08-23: **keep `/p/`**, correct the docs,
 * and leave the rename itself deliberately open (`docs/phases.md`,
 * "Deliberately open"). This file is the other half of that ruling. The router
 * builds its path from `CANVAS_ROUTE`, the Share dialog builds its copyable URL
 * from `canvasUrl`, and `isocan open` and `isocan share` build theirs from the
 * same function — so the next time somebody changes their mind about the
 * prefix, there is one line to change and no second spelling to discover in
 * the wild.
 *
 * It lives in core rather than in either client for the ordinary reason (house
 * rule 4): the web app and the CLI both compute "where does this canvas live",
 * and a computation both clients do belongs to neither.
 */

/** The one prefix. Not `/c/`, and never both — a second URL shape for one
 * canvas is a cost that lasts forever. */
export const CANVAS_PATH_PREFIX = "/p";

/** The router's pattern, so the route and the links agree by construction. */
export const CANVAS_ROUTE = `${CANVAS_PATH_PREFIX}/:projectId`;

/** The path a canvas is served at, origin-relative. */
export function canvasPath(projectId: string): string {
  return `${CANVAS_PATH_PREFIX}/${encodeURIComponent(projectId)}`;
}

/**
 * The whole invitation: origin + path.
 *
 * `origin` is whatever the caller is standing at — the home's address for a
 * CLI on a replica (people always enter through the one origin), or
 * `location.origin` in a tab. A trailing slash is tolerated because a home
 * address read out of a config file often has one.
 */
export function canvasUrl(origin: string, projectId: string): string {
  return `${origin.replace(/\/+$/, "")}${canvasPath(projectId)}`;
}
