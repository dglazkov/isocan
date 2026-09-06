/**
 * **How a cookieless origin knows who may read a private canvas's bytes** —
 * option A of `docs/projects/multiuser/content-read-auth.md`, decided
 * 6 September 2026 and built here.
 *
 * The collision the decision resolves, in one line each: expulsion reaches
 * the bytes (the blob route's ledger in `http.ts`, 23 August), and the
 * content origin holds nothing (`docs/projects/atlas/content-origin.md`,
 * 26 August). The origin that must serve private bytes is the origin that
 * must not carry the credential saying who is asking.
 *
 * So the credential is the URL, and it dies in minutes. The **badged app
 * origin** mints a signature over `(canvasId, blobHash, expiry)` for each
 * frame it renders — a mint the door's admission hook has already gated, so
 * an expelled badge cannot mint at all. The **content origin** verifies that
 * signature and serves or refuses, looking nothing up and asking nobody: it
 * holds one secret and no questions, which is what keeps it an origin that
 * owns nothing.
 *
 * **What it costs, stated where it is built rather than only where it was
 * decided.** On the hosted shape, expulsion reaches the bytes *within one
 * TTL* rather than at once. An expelled badge cannot mint anew; what it
 * already minted lives out its minutes. `CONTENT_TTL_DEFAULT_SECONDS` is
 * therefore the number that says how true "expulsion reaches the bytes" is,
 * and it is small on purpose.
 *
 * **What it gives back.** The URL *is* the credential and it expires, so a
 * verified response may be cached publicly for the rest of its TTL — the
 * edge copy the 23 August change had to give up (`Cache-Control: private`)
 * comes back, on the one origin where it is safe. See `CONTENT_BLOB_ROUTE`'s
 * handler for the cache header this makes possible, and
 * `infra/82-content-origin.sh` for the cache-key policy that makes it true
 * (a shared cache that dropped the query string would serve a signed
 * response to an unsigned request, which is the whole hole reopened).
 *
 * Nothing here knows about Fastify, the desk or the store. It is a string, a
 * secret and a clock.
 */
/**
 * **Five minutes** — the second of the two numbers `content-read-auth.md`
 * left to the owners, and the one it framed as "makes 'within one TTL' feel
 * like 'at once' to a person, at the price of one mint per frame render".
 *
 * That price was the argument for the calmer hour, and it is not what the
 * mint actually costs: signatures are minted in ONE batched call per canvas
 * visit (`SIGN_BLOBS_ROUTE`), not one call per frame, so a canvas of forty
 * screens costs one round trip either way. With the cost gone, the number
 * that makes expulsion nearly immediate is the one to take.
 *
 * `ISOCAN_CONTENT_TTL` overrides it, in seconds, for a home that wants the
 * calmer edge cache and can live with an expulsion taking that long to be
 * true for bytes already framed.
 */
export declare const CONTENT_TTL_DEFAULT_SECONDS = 300;
export declare function contentTtl(envValue: string | undefined): number;
/** The query parameters a signed read carries. Two, both opaque to everything
 * but this file. */
export declare const EXPIRY_PARAM = "exp";
export declare const SIGNATURE_PARAM = "sig";
/** The signature alone, base64url — 32 bytes of HMAC-SHA256 as 43 characters. */
export declare function signContentRead(key: string, canvasId: string, blobHash: string, expiresAt: number): string;
/**
 * The path a frame's `src` is built from: the content role's own route with
 * the credential on it. Relative, because the app joins it to the content
 * base it was advertised — one place decides the origin (`itemFrame`, the
 * web app's invariant-2 seam) and one place decides the path (here), and
 * neither can drift into the other's job.
 */
export declare function signedBlobPath(key: string, canvasId: string, blobHash: string, expiresAt: number): string;
/**
 * Why a signed read was refused, or `"ok"`. Four verdicts rather than a
 * boolean because they are four different things to say to a reader of the
 * logs — and exactly one thing to say to the caller, which is 403: telling
 * an unsigned caller apart from a mistyped one is a distinction only an
 * attacker is taking notes on.
 */
export type ReadVerdict = "ok" | "unsigned" | "expired" | "bad-signature";
/** Does this request carry a live signature over these exact bytes? */
export declare function verifyContentRead(key: string, canvasId: string, blobHash: string, query: {
    exp?: unknown;
    sig?: unknown;
}, nowSeconds: number): ReadVerdict;
/** How long a verified response may still be held, in seconds — never
 * negative, and never longer than the credential that fetched it. */
export declare function remainingSeconds(query: {
    exp?: unknown;
}, nowSeconds: number): number;
