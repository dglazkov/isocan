import { createHmac, timingSafeEqual } from "node:crypto";

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
export const CONTENT_TTL_DEFAULT_SECONDS = 300;

/** The bounds an override is held to: below a minute the mint is re-paid
 * inside a single visit, and above a day "short-lived" stops being true and
 * the signature is the durable token the 23 August ledger refused. An
 * unparseable or out-of-range value takes the default rather than guessing —
 * `contentPorts`' ethic, for the same reason. */
const TTL_MIN_SECONDS = 60;
const TTL_MAX_SECONDS = 86_400;

export function contentTtl(envValue: string | undefined): number {
  if (envValue === undefined) return CONTENT_TTL_DEFAULT_SECONDS;
  const seconds = Number(envValue.trim());
  if (!Number.isInteger(seconds)) return CONTENT_TTL_DEFAULT_SECONDS;
  if (seconds < TTL_MIN_SECONDS || seconds > TTL_MAX_SECONDS) return CONTENT_TTL_DEFAULT_SECONDS;
  return seconds;
}

/** The query parameters a signed read carries. Two, both opaque to everything
 * but this file. */
const EXPIRY_PARAM = "exp";
const SIGNATURE_PARAM = "sig";

/**
 * What is signed, spelled once.
 *
 * The version prefix is not ceremony: a signature format that changes without
 * one is a signature an old verifier accepts under a new meaning. Newlines
 * rather than a joined string because a canvas id and a hash are both
 * unambiguous alphabets — but the next field somebody adds might not be, and
 * a separator that cannot appear in any field is what stops `(a, bc)` and
 * `(ab, c)` from signing the same bytes.
 */
function message(canvasId: string, blobHash: string, expiresAt: number): string {
  return `v1\n${canvasId}\n${blobHash}\n${expiresAt}`;
}

/** The signature alone, base64url — 32 bytes of HMAC-SHA256 as 43 characters. */
export function signContentRead(
  key: string,
  canvasId: string,
  blobHash: string,
  expiresAt: number,
): string {
  return createHmac("sha256", key).update(message(canvasId, blobHash, expiresAt)).digest("base64url");
}

/**
 * The path a frame's `src` is built from: the content role's own route with
 * the credential on it. Relative, because the app joins it to the content
 * base it was advertised — one place decides the origin (`itemFrame`, the
 * web app's invariant-2 seam) and one place decides the path (here), and
 * neither can drift into the other's job.
 */
export function signedBlobPath(
  key: string,
  canvasId: string,
  blobHash: string,
  expiresAt: number,
): string {
  const sig = signContentRead(key, canvasId, blobHash, expiresAt);
  return (
    `/api/projects/${encodeURIComponent(canvasId)}/blobs/${encodeURIComponent(blobHash)}` +
    `?${EXPIRY_PARAM}=${expiresAt}&${SIGNATURE_PARAM}=${sig}`
  );
}

/**
 * Why a signed read was refused, or `"ok"`. Four verdicts rather than a
 * boolean because they are four different things to say to a reader of the
 * logs — and exactly one thing to say to the caller, which is 403: telling
 * an unsigned caller apart from a mistyped one is a distinction only an
 * attacker is taking notes on.
 */
export type ReadVerdict = "ok" | "unsigned" | "expired" | "bad-signature";

/** Does this request carry a live signature over these exact bytes? */
export function verifyContentRead(
  key: string,
  canvasId: string,
  blobHash: string,
  query: { exp?: unknown; sig?: unknown },
  nowSeconds: number,
): ReadVerdict {
  const rawExp = typeof query.exp === "string" ? query.exp : null;
  const presented = typeof query.sig === "string" ? query.sig : null;
  if (rawExp === null || presented === null) return "unsigned";
  const expiresAt = Number(rawExp);
  if (!Number.isInteger(expiresAt)) return "bad-signature";
  /**
   * **The signature is checked before the clock, and that is deliberate.**
   * Refusing an expired-but-VALID signature as `expired` and a forged one as
   * `bad-signature` is only honest if the expiry it read was one this home
   * signed; otherwise anybody could choose which refusal they get by writing
   * a date in the query, and the log would record their choice rather than
   * what happened.
   */
  const expected = signContentRead(key, canvasId, blobHash, expiresAt);
  if (!constantTimeEquals(presented, expected)) return "bad-signature";
  return expiresAt <= nowSeconds ? "expired" : "ok";
}

/** How long a verified response may still be held, in seconds — never
 * negative, and never longer than the credential that fetched it. */
export function remainingSeconds(query: { exp?: unknown }, nowSeconds: number): number {
  const expiresAt = Number(typeof query.exp === "string" ? query.exp : NaN);
  if (!Number.isInteger(expiresAt)) return 0;
  return Math.max(0, expiresAt - nowSeconds);
}

function constantTimeEquals(presented: string, expected: string): boolean {
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  // Length is not a secret here — every signature this home mints is the same
  // 43 characters — and `timingSafeEqual` throws on a mismatch, so it is
  // checked rather than compared.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
