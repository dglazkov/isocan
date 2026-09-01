import type { FastifyInstance } from "fastify";
import { Engine } from "./engine.js";
import { type AuthConfig, type SigningKeys } from "./attest.js";
import type { Store } from "./store.js";
import type { BadgeRecord, Desk } from "./desk.js";
import { PresenceHub } from "./presence.js";
import type { HomeLinks } from "./home-links.js";
import type { ParkCursors } from "./park.js";
import { RcHolds } from "./rc-holds.js";
declare module "fastify" {
    interface FastifyRequest {
        /** The badge this request presented, resolved once by the door hook. */
        badge: BadgeRecord | null;
    }
}
/**
 * How a blob may be cached — and **`private` is phase 9's, not decoration.**
 *
 * A blob's bytes are immutable by construction (the URL is their hash), so a
 * year is the honest freshness. What changed is who may hold the copy. The
 * route now requires a badge and an admission, and the hosted home sits behind
 * a Cloud CDN backend running `--cache-mode=USE_ORIGIN_HEADERS`
 * (`infra/80-load-balancer.sh`) — which means *this header* is what decides
 * whether the edge keeps a copy. A shared cache holding a credentialed
 * response would hand a swept badge exactly the bytes it was just expelled
 * from, and it would do it without the request ever reaching the door: a
 * closed route with an open back gate.
 *
 * `private` keeps the browser cache, which is the one that matters for a
 * canvas full of images being panned around, and gives up the edge copy. That
 * is the cost of closing the route, paid in bandwidth rather than in
 * correctness, and it is the right way round.
 */
/**
 * **What the static file server calls each thing it serves.**
 *
 * Exported so its guard can import it rather than restate it: a test that
 * spells the map out a second time is a test of its own copy
 * (`docs/reviews/lessons.md` #5). `packages/server/test/statictypes.test.ts`
 * holds it to every extension under `packages/web/public/`.
 */
export declare const STATIC_TYPES: Record<string, string>;
export interface RouteOptions {
    /** Where a canvas born here, naming nothing, is born — or null when it stays
     * here. What the health route reports as `home` (redefined in phase 10.3,
     * because `stalenessOf` and older CLIs read that key and the birth default
     * is the one whole-daemon answer that still exists), and what a `POST
     * /api/home/join` with no address falls back to. */
    birthHome?: string | null;
    /**
     * **Every home this daemon dials, and which canvas belongs to which.**
     *
     * It decides three things here: which canvas's writes and reads forward and
     * to where, whether a given page is served at this origin at all (see
     * `registerPages` — the one-origin rule is per canvas now), and what `GET
     * /api/homes` answers. Absent means a daemon that is the home of everything
     * it holds, which is every daemon a test constructs without one.
     */
    homes?: HomeLinks | null;
    /**
     * The content origin's base URL, or null/absent when none exists — which
     * is every daemon at stage 1 of the content-origin plan. The daemon sets
     * this from the content listener it actually started (stage 2), never from
     * configuration alone: an advertised base is a base that answers. It is
     * what `GET /api/serving` reports and nothing else reads it.
     */
    contentBase?: string | null;
    /**
     * **The attester this home has borrowed**, or null when it has borrowed
     * none — which is every local daemon and is not a defect.
     *
     * Configuration reaching the routes the way `homeUrl` does, and for the same
     * reason: what a home can VERIFY is innkeeper configuration, not a
     * per-invocation choice, and it must be answerable without a rebuild. It
     * decides three things: whether `email:` may be granted here, what the
     * browser is handed to sign in with, and which canvas a presented token is
     * checked against. See `attest.ts` for why that is one value and not a
     * boolean somebody could set wrongly.
     */
    auth?: AuthConfig | null;
    /**
     * Where the public keys a presented token is checked against come from.
     * Defaults to Google's published endpoint; see `SigningKeys` in `attest.ts`
     * for why this is configuration and what it buys.
     */
    signingKeys?: SigningKeys;
    /**
     * The durable park cursor (on-demand phase 1) — one row per actor per
     * canvas, adopted by the newest park. Absent only in a caller that wired
     * the routes by hand; the daemon always supplies one, and the park routes
     * answer 501 without it rather than inventing a home directory to write in.
     */
    park?: ParkCursors;
    /**
     * The rc hold/ask registry (agent-custody). Shared with the WS layer (which
     * mirrors what member daemons relay) and the home-links (which relay this
     * daemon's own holds up) — so the daemon supplies one instance; a caller
     * that wires routes by hand gets a private registry, which is the same
     * behavior the inline map gave it.
     */
    rc?: RcHolds;
}
export declare function registerRoutes(app: FastifyInstance, engine: Engine, store: Store, desk: Desk, presence: PresenceHub, options?: RouteOptions): void;
/** The header a replica names its home in — a machine-readable copy of what
 * the body says, for a `curl` or a script that would rather not scrape prose.
 * Deliberately NOT `Location`, and deliberately not a 3xx: see below. */
export declare const HOME_HEADER = "X-Isocan-Home";
