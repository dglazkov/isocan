import type { FastifyInstance } from "fastify";
/**
 * **`GET /models/<name>` — the local judge's model, from this machine to its
 * own pages** (local-judge phase 0; design *Privacy, proved rather than
 * implied*).
 *
 * The browser's Worker loads the model from the daemon's own origin, so the
 * privacy proof can say every request went there. What it serves is
 * `<home>/models/<file>`, put there by `isocan model fetch`:
 *
 * - **Known names only.** The name is looked up in core's manifest; the file
 *   comes from the manifest entry, never from the path. No listing, no
 *   traversal, no other file in the directory — an unknown name is a 404.
 * - **This machine only.** The keys routes' gate: a daemon serving the world,
 *   bound off loopback, or asked by a peer off loopback answers 404, the same
 *   answer a hosted home gives, because there the route does not exist (where
 *   a hosted home serves models from is still open — design *Open*). A
 *   loopback Host is required too, so a rebound DNS name cannot read it.
 * - **Named, sized and long-cached.** `application/octet-stream` with an
 *   exact `Content-Length`; `immutable` for a year is safe because the name
 *   pins a hash — a new model is a new name. A known name not yet fetched is
 *   a 404 that says which verb fetches it.
 */
/**
 * **The judge's Worker carries its own policy** (local-judge phase 0, *Privacy,
 * proved rather than implied*). A dedicated Worker takes its
 * Content-Security-Policy from its own script's response — the lab page's
 * meta tag does not reach it — so the static handler sends this with the one
 * asset the lab's build names `judge-worker-<hash>.js`, and with nothing else.
 * `connect-src 'self'` is the point: fetch, XMLHttpRequest, WebSocket and
 * sendBeacon from the Worker reach this origin or are blocked by the browser,
 * whatever MediaPipe's code tries. `script-src` admits this origin's wasm
 * loader and `'wasm-unsafe-eval'` its compile; nothing wider.
 */
export declare const JUDGE_WORKER_POLICY = "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'";
/** The policy a static file is served with, if it has one of its own — only the judge's Worker does. */
export declare function judgeWorkerPolicy(file: string): string | null;
interface ModelFileScope {
    /** The home whose `models/` is served — the one keys.json is in. */
    home: string;
    servesWorld: boolean | undefined;
}
/** `GET /models/:name` on `app`, behind this machine-only gate. */
export declare function registerModelFileRoutes(app: FastifyInstance, scope: ModelFileScope): void;
export {};
