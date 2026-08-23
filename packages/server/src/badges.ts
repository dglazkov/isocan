import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";
import { BADGE_COOKIE, formatBadgeToken, newId, parseBadgeToken } from "@isocan/core";
import type { BadgeKind, BadgeRecord, Desk } from "./desk.ts";

/**
 * Everything the door does with `node:crypto`, in one file: mint, hash,
 * compare, read a carrier off a request, build the cookie, and judge an
 * Origin. Nothing here knows about Fastify or the engine.
 */

/** A minted badge, at the one moment the plaintext secret exists. */
export interface MintedBadge {
  record: BadgeRecord;
  /** `<badgeId>.<secret>` — handed to the caller once and never again. */
  token: string;
}

/** 256 bits of CSPRNG, base64url — the architecture's number. The id is
 * nanoid and is an identifier, not a secret; nothing about it is
 * load-bearing. */
export function mintBadge(kind: BadgeKind, now = new Date().toISOString()): MintedBadge {
  const badgeId = newId("bdg");
  const secret = randomBytes(32).toString("base64url");
  return {
    record: {
      badgeId,
      secretHash: sha256(secret),
      kind,
      createdAt: now,
      lastSeen: now,
      admissions: [],
      claims: [],
    },
    token: formatBadgeToken(badgeId, secret),
  };
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Constant-time over the two digests. Equal length by construction, so
 * there is no length to leak either. */
export function secretMatches(secret: string, expectedHash: string): boolean {
  const presented = Buffer.from(sha256(secret), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  if (presented.length !== expected.length) return false;
  return timingSafeEqual(presented, expected);
}

// ---- carriers ----

export interface PresentedBadge {
  badgeId: string;
  secret: string;
  /** Cookie-carried requests get the Origin check; bearer-carried ones are
   * exempt, because an attacker's page cannot read a bearer token and so has
   * nothing to ride. */
  carrier: "cookie" | "bearer";
}

/**
 * What this request presented, if anything. Bearer wins over cookie when
 * both arrive: an explicit credential beats an ambient one.
 */
export function presentedBadge(headers: IncomingHttpHeaders): PresentedBadge | null {
  const auth = headerValue(headers.authorization);
  if (auth) {
    const [scheme, ...rest] = auth.split(" ");
    if (scheme?.toLowerCase() === "bearer") {
      const parsed = parseBadgeToken(rest.join(" ").trim());
      if (parsed) return { ...parsed, carrier: "bearer" };
    }
  }
  const cookie = parseBadgeToken(readCookie(headerValue(headers.cookie), BADGE_COOKIE));
  return cookie ? { ...cookie, carrier: "cookie" } : null;
}

/** The badge behind a presented token, or null if the desk does not know it
 * or the secret does not match. */
export async function resolveBadge(
  desk: Desk,
  presented: PresentedBadge | null,
): Promise<BadgeRecord | null> {
  if (!presented) return null;
  const record = await desk.badge(presented.badgeId);
  if (!record) return null;
  return secretMatches(presented.secret, record.secretHash) ? record : null;
}

/**
 * One cookie name, hand-parsed. Fifteen lines against a dependency that costs
 * more here than it looks: the root `package.json` duplicates the CLI's
 * runtime deps so a git install resolves (#47), so a new server dependency is
 * two edits and a release-branch concern.
 */
export function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    const raw = part.slice(eq + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return null;
}

/**
 * The `Set-Cookie` value for a badge.
 *
 * `SameSite=Lax` and not `Strict`, decided by Scene 3: clicking a canvas link
 * from Slack is a cross-site top-level navigation, and `Strict` withholds the
 * cookie on it — so a returning person arrives looking badge-less, is minted
 * a SECOND badge, and loses her admissions and personas until she reloads.
 * That is the journey's central gesture. `Lax` still withholds the cookie on
 * cross-site POSTs and subresource loads, which is most of the CSRF surface,
 * with the Origin check as the belt.
 *
 * `Secure` only over TLS: the hosted home behind the load balancer gets it;
 * `http://127.0.0.1:4441` must keep working for every local daemon, and the
 * two are the same code. A `__Host-` prefix — which would force `Secure`,
 * `Path=/`, and no `Domain`, and make the cookie unspoofable by a sibling
 * host — is the hosted home's tightening in phase 5, for exactly that reason.
 */
export function badgeCookie(token: string, secure: boolean): string {
  return [
    `${BADGE_COOKIE}=${token}`,
    "Path=/", // both /api and the /ws upgrade need it
    "HttpOnly", // XSS containment is the whole point of the carrier
    "SameSite=Lax",
    "Max-Age=31536000", // "reconnects for months"
    ...(secure ? ["Secure"] : []),
    // Domain deliberately absent: host-only is the one-origin rule expressed
    // as a cookie.
  ].join("; ");
}

/** Did this request arrive over TLS? Behind the load balancer the hop to the
 * service is plain HTTP, and the LB says so in the header. */
export function isSecureRequest(headers: IncomingHttpHeaders, encrypted: boolean): boolean {
  const forwarded = headerValue(headers["x-forwarded-proto"]);
  if (forwarded) return forwarded.split(",")[0]!.trim() === "https";
  return encrypted;
}

// ---- the Origin rule ----

export interface OriginPolicy {
  /** The host:port the daemon is bound to, when that is loopback. */
  loopback: boolean;
}

/**
 * Whether a browser-driven request may ride this home's cookie.
 *
 * An ABSENT Origin is allowed: Node's fetch and the `ws` client send none,
 * and browsers always send one on a POST and on a WebSocket handshake — so
 * absent means "not a browser", and a non-browser has no ambient cookie to
 * be tricked into sending.
 *
 * The loopback clause is not a dev hack; it is mechanism 5's own line applied
 * to origins — "within a machine, localhost trust stands". A local daemon
 * that already believes every field it is handed from localhost is not made
 * safer by refusing a localhost `Origin`. The hosted home binds `0.0.0.0`,
 * does not take the clause, and enforces exactly its own origin (the load
 * balancer passes `Origin` through untouched). `ISOCAN_ALLOWED_ORIGINS`
 * names any others, comma-separated — and naming any at all turns the
 * loopback clause OFF, which is how a local daemon is driven in home posture.
 */
export function originAllowed(
  origin: string | undefined,
  self: { host: string | undefined; secure: boolean },
  policy: OriginPolicy,
): boolean {
  if (!origin || origin === "null") return true;
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  const allowlist = (process.env.ISOCAN_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (allowlist.includes(origin)) return true;
  if (self.host) {
    const own = `${self.secure ? "https" : "http"}://${self.host}`;
    if (origin === own) return true;
  }
  if (allowlist.length > 0) return false; // named origins mean strict mode
  if (!policy.loopback) return false;
  return (
    (url.protocol === "http:" || url.protocol === "https:") &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]" || url.hostname === "::1")
  );
}

function headerValue(raw: string | string[] | undefined): string | undefined {
  return Array.isArray(raw) ? raw[0] : raw;
}
