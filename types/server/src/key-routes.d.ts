import type { FastifyInstance } from "fastify";
import { type KeyEnv } from "../../core/src/keys.js";
/**
 * **The settings area's hands: model keys, over HTTP, to this machine only**
 * (keys phase 2; `docs/projects/keys/design.md`).
 *
 * `GET /api/keys` lists every provider — set or not, `…abcd`, when, what uses
 * it, whether the environment overrides it — and NEVER the value.
 * `PUT /api/keys/:provider` takes `{ key }` and answers with the row.
 * `DELETE` removes one. `PUT /api/keys/sharing` takes `{ share }` — owner-only
 * spend's switch (keys phase 3). `POST /api/keys/:provider/test` makes the one cheap
 * call `isocan keys test` makes and answers with the provider's words, the
 * key scrubbed out of them. They are `isocan keys`, spoken by the web app, and
 * they read and write the same `keys.json` through the same `@isocan/core`
 * helpers — the rows are core's `keyRows`, so the two surfaces cannot disagree.
 *
 * **The gate is the tree's, and then some.** `treeGate` in `http.ts`: this
 * daemon bound to loopback (and not told it serves the world), the peer ON
 * loopback — otherwise 404, the same answer a hosted home gives, because there
 * a key route does not exist. Two more checks, because a loopback peer is not
 * the same thing as this machine's person: a page on another site the browser
 * is showing can reach `127.0.0.1` too.
 *
 * - **Host is a loopback name.** A rebound DNS name arrives carrying ITS name.
 * - **Origin, when there is one, is a loopback origin.** The door hook's
 *   `originAllowed` lets a bearer through unjudged and widens with
 *   `ISOCAN_ALLOWED_ORIGINS`; neither belongs anywhere near a key.
 *
 * Both are the voice harness's `doorRefusal` (keys phase 0), mirrored rather
 * than imported because the harness depends on the server and not the other
 * way round. And the bodies are JSON or nothing: this scope has ONE parser,
 * `application/json`, so a cross-site `text/plain` PUT is a 415 before any
 * handler, and a malformed body is refused without the parse error that would
 * quote it back.
 *
 * **The value goes one way.** In through `PUT`, onto disk, and out of no
 * response, error or log line — the tests grep every answer for it.
 */
/** What a daemon may hand these routes. Tests use both; a running home uses neither. */
export interface KeyRouteOptions {
    /** The environment the env-override is read from. Default: `process.env`. */
    env?: KeyEnv;
    /** The transport `test` asks the provider through. Default: global `fetch`. */
    fetch?: typeof fetch;
}
interface KeyRouteScope {
    /** The home whose `keys.json` this daemon reads — its own, as the judge's is. */
    home: string;
    /** What the bind says (`RouteOptions.servesWorld`): a daemon serving the world has no key routes. */
    servesWorld: boolean | undefined;
    keys?: KeyRouteOptions;
}
/** The keys routes, in a scope of their own, on `app`. */
export declare function registerKeyRoutes(app: FastifyInstance, scope: KeyRouteScope): void;
export {};
