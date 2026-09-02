import type { FastifyInstance } from "fastify";
import type { Engine } from "./engine.js";
import type { Store } from "./store.js";
import type { HomeLinks } from "./home-links.js";
/**
 * **The content role** — the route set a content origin serves, and nothing
 * else (`docs/projects/atlas/content-origin-plan.md`, stage 1).
 *
 * The proposal's rule, held structurally: an origin that serves item content
 * must hold *nothing* — no door, no canvas questions, no API — or it has
 * become a second API with no door on it. So the role is one function that
 * registers exactly one route, and `content.test.ts` enumerates the route
 * table to keep it that way.
 *
 * The same function serves BOTH origins. Today the main app mounts it on the
 * app origin, where the door's `onRequest` hook still gates it — behavior
 * identical to the inline route this replaced. Stage 2 mounts it again on a
 * second loopback listener with no door at all, which is acceptable there for
 * the tree's three facts: loopback-bound, single-user home, hash-addressed.
 * Stage 4 mounts it by Host header on the hosted shape — see
 * `isContentRequest` — once the read-auth question is answered.
 *
 * Addressing keeps `(canvasId, hash)` as opaque path segments: answering
 * "bytes for this pair, or 404" is not answering questions about canvases,
 * and hash-only addressing would force a cross-canvas lookup the store does
 * not owe anyone.
 */
/** One spelling of the role's one route. The path is identical on every
 * origin that mounts the role, so a frame URL is always `base + path` and
 * nothing ever rewrites paths per origin. */
export declare const CONTENT_BLOB_ROUTE = "/api/projects/:id/blobs/:hash";
export interface ContentDeps {
    engine: Engine;
    store: Store;
    /** Bytes this replica never held stream through from the canvas's home —
     * the same pass-through the app-origin route has always done. */
    homes: HomeLinks | null;
}
interface ContentOptions {
    /**
     * The `Content-Security-Policy` these responses carry, or null for none.
     *
     * The app origin passes `"sandbox allow-scripts"` — defense in depth for a
     * directly-opened blob document, unchanged from before the extraction. The
     * content role must NOT send that header as-is: a response-header sandbox
     * intersects with any iframe attribute and re-imposes the opaque origin,
     * defeating the storage the split exists to grant (measured from the other
     * side in `docs/research/2026-08-26-wysiwyg.md`). What the content role
     * sends instead is stage 3's decision, made on measurement.
     */
    csp: string | null;
}
/**
 * Is this request addressed to the content origin? The hosted shape has one
 * `$PORT`, so the role is recognized by Host header there rather than by
 * listener; a local content listener never needs to ask (everything it hears
 * is the role's). Null `contentHost` — every shape today — means no request
 * ever is.
 */
export declare function isContentRequest(hostHeader: string | undefined, contentHost: string | null): boolean;
/**
 * Which ports the local content listener should try, in order — or none.
 *
 * None when the daemon is bound wide: `ISOCAN_BIND=0.0.0.0` is the hosted
 * shape, where the content origin is a Host header on the same `$PORT`
 * (stage 4), never a second listener — and a second listener that bound wide
 * by accident would serve badge-less blobs to the network, which is the one
 * misconfiguration this function exists to make unreachable.
 *
 * `ISOCAN_CONTENT_PORT` pins a port, `0` asks for an ephemeral one, and
 * `off` disables the listener. Unset — every local daemon — tries the main
 * port's neighbour first (4441 → 4442, stable across restarts so a tab's
 * frames survive a daemon bounce) and falls back to ephemeral, because a
 * neighbour that happens to be taken must degrade the ADDRESS, never the
 * origin split. An unparseable value disables rather than guesses.
 */
export declare function contentPorts(host: string, envValue: string | undefined, mainPort: number): number[];
/**
 * **What a page on the content origin may reach for** — stage 3 of
 * `docs/projects/atlas/content-origin-plan.md`, chosen by measuring rather
 * than guessing.
 *
 * The origin split stopped INBOUND theft: a page there has no cookie, no
 * badge and no API to call, which is what made `allow-same-origin` safe to
 * grant. It did nothing about OUTBOUND — a scripted page can still compute
 * something and send it somewhere. That is this header's whole job, and its
 * cost is real: a policy too tight silently breaks screens agents write.
 *
 * **So it was measured.** 76 HTML blobs across this machine's canvases,
 * 15.5MB of real agent-written screens (2026-08-27):
 *
 * | what | files |
 * | --- | --- |
 * | inline `<script>` | 48 |
 * | remote stylesheet | 28 — **every one of them Google Fonts** |
 * | `localStorage` | 14 |
 * | remote `<script src>`, `fetch`, XHR, WebSocket, `<iframe>`, `<form>`, remote `<img>`, `eval` | **0** |
 *
 * The only hosts referenced at all were `fonts.googleapis.com`,
 * `fonts.gstatic.com` — and `www.w3.org`, which is an SVG namespace and not
 * a request. These pages are self-contained; they render and they remember,
 * and they do not phone anywhere.
 *
 * So: everything that renders, nothing that talks. `connect-src 'none'`
 * closes fetch, XHR, WebSocket and `sendBeacon` — free today, by the
 * measurement, and the main exfiltration channel. Images and media are
 * limited to `data:`/`blob:` because an image URL is exfiltration with extra
 * steps. Fonts are the one remote allowance, because they are the one remote
 * thing anybody actually used.
 *
 * **NO `sandbox` directive here**, and that is load-bearing: a
 * response-header sandbox intersects with the iframe's and re-imposes the
 * opaque origin, which would take away the storage this whole origin exists
 * to grant. The app origin keeps its own `sandbox allow-scripts` header; the
 * content origin must never carry one.
 *
 * **What it does not close, stated so nobody assumes otherwise:** a page can
 * still navigate ITSELF — `location = "https://…?" + secret` — and no
 * portable CSP directive stops that (`navigate-to` never shipped broadly).
 * Inside a sandboxed frame it cannot take the top window with it, so the
 * blast radius is the frame; the leak is still a leak. Closing it needs a
 * different mechanism than a header.
 */
export declare const CONTENT_CSP: string;
/** Register the content role's routes — all of them, which is one. */
export declare function registerContentRoutes(app: FastifyInstance, deps: ContentDeps, options: ContentOptions): void;
export {};
