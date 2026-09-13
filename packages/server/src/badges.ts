import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";
import {
  BADGE_COOKIE,
  badgeEndNotice,
  ENDED,
  formatBadgeToken,
  newId,
  NOT_ADMITTED,
  parseBadgeToken,
  type BadgeEnd,
} from "@isocan/core";
import type { BadgeKind, BadgeRecord, Desk } from "./desk.ts";

/**
 * Everything the door does with `node:crypto`, in one file: mint, hash,
 * compare, read a carrier off a request, build the cookie, and judge an
 * Origin. Nothing here knows about Fastify or the engine.
 */

/** A minted badge, at the one moment the plaintext secret exists. */
interface MintedBadge {
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

interface PresentedBadge {
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
 * **The tombstone behind a presented token, when the secret matches**
 * (operator phase 4) — asked only after `resolveBadge` came back empty.
 *
 * The secret is checked against the tombstone exactly as it is against a
 * live record, and for the same reason the desk hashes it: a badge id is
 * visible to the badge's co-holders and to whoever read a `badges` listing,
 * and *this id was ended by the operator for harassment* is a sentence for
 * the holder, not for anybody who can spell the id. Nothing about the
 * tombstone is said to a caller that cannot present the secret.
 */
export async function resolveEnded(
  desk: Desk,
  presented: PresentedBadge | null,
): Promise<BadgeRecord | null> {
  if (!presented) return null;
  const record = await desk.endedBadge(presented.badgeId);
  if (!record) return null;
  return secretMatches(presented.secret, record.secretHash) ? record : null;
}

/** The notice for a tombstone — `killedAt` is set on every record this is
 * handed, by construction of `resolveEnded` and `endedBadge`. */
export function endOf(record: BadgeRecord): BadgeEnd {
  return badgeEndNotice(record.badgeId, record.killedAt ?? record.lastSeen, null);
}

/**
 * **A parked wait whose badge was ended while it was parked** (operator
 * phase 4; design, "End a badge": *a watch held by the dead badge is woken and
 * refused*).
 *
 * 403 and `not-admitted` with the reason `ended`, deliberately the shape
 * `withdrawn` and `taken-down` already have rather than the 401 every other
 * request from a dead badge meets. The 401 is the right answer to a request:
 * it sends the client to the door. It is the wrong answer to a PARK: the
 * client's one recovery per request would knock, replay the watch as a
 * stranger, and park again in silence — which is the *parked agent hearing
 * silence forever* failure the watch's refusals exist to prevent. A 403 with
 * a reason is what `isocan wait` prints and exits on, and the next command
 * that machine runs meets the 401 and its own remedy.
 */
export class BadgeEndedError extends Error {
  readonly code = NOT_ADMITTED;
  readonly reason = ENDED;
  readonly status = 403;
  constructor(readonly end: BadgeEnd) {
    super(end.sentence);
    this.name = "BadgeEndedError";
  }
}

/**
 * One cookie name, hand-parsed. Fifteen lines against a dependency that costs
 * more here than it looks: the root `package.json` duplicates the CLI's
 * runtime deps so a git install resolves (#47), so a new server dependency is
 * two edits and a release-branch concern.
 */
function readCookie(header: string | undefined, name: string): string | null {
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
 *
 * ---
 *
 * **`framed` is the embed's whole repair** (#220, phase 1).
 *
 * `Lax` was decided for a top-level navigation and an iframe is not one. A
 * canvas opened in an agent manager's pane — Jetski, an IDE webview, an MCP
 * App's frame — is a cross-site subresource, and its cookies live in a jar
 * keyed on the TOP-LEVEL site rather than on this one. Safari and Brave
 * refuse that jar outright; Firefox partitions it in ETP-Strict; Chrome still
 * allows it today, on a default its vendor already reversed once. Where the
 * jar is refused, the pane can neither read the badge it has nor keep the one
 * it is handed — and the app has no bearer path to fall back to, so it is a
 * stranger on every load, which is a MINT on every load, which is the door's
 * meter. A silent 401, from three lines that had never met.
 *
 * `SameSite=None; Secure; Partitioned` (CHIPS) is the sanctioned way to hold
 * a cookie in that jar, and what it buys is better than merely working: the
 * frame gets its OWN badge, per top-level site, which cannot be read by the
 * embedder's other frames and is not the person's own tab's badge either.
 * Isolation is the honest posture for a credential handed to a window
 * somebody else owns.
 *
 * **What a framed request over plain HTTP gets: `Lax`, and this comment.**
 * `Partitioned` requires `Secure`, and so does `SameSite=None` — a browser
 * handed `None` without `Secure` rejects the cookie entirely, which is
 * strictly worse than a `Lax` cookie that at least works wherever the
 * unpartitioned jar is still allowed. So `http://127.0.0.1:4441` framed in an
 * IDE webview keeps exactly the behaviour it has today. That is a real limit
 * of the local daemon rather than an oversight, and the way out is the
 * pass — see `isocan embed`.
 */
export function badgeCookie(token: string, secure: boolean, framed = false): string {
  // `Partitioned` without `Secure` is not a weaker cookie, it is no cookie.
  const partitioned = framed && secure;
  return [
    `${BADGE_COOKIE}=${token}`,
    "Path=/", // both /api and the /ws upgrade need it
    "HttpOnly", // XSS containment is the whole point of the carrier
    partitioned ? "SameSite=None" : "SameSite=Lax",
    "Max-Age=31536000", // "reconnects for months"
    ...(secure ? ["Secure"] : []),
    ...(partitioned ? ["Partitioned"] : []),
    // Domain deliberately absent: host-only is the one-origin rule expressed
    // as a cookie.
  ].join("; ");
}

/**
 * **Is this document request for a frame in somebody else's page?** (#220.)
 *
 * The page load has no body to state it in — `DoorRequest.framed` is how the
 * app says so afterwards — so this one IS sniffed, from the only headers that
 * carry the fact. Both halves are load-bearing:
 *
 * - `Sec-Fetch-Dest` names what the response will BE. `iframe` and `frame`
 *   are nested documents; `document` is the top-level navigation `Lax` was
 *   written for. Absent means a browser too old to say (or not a browser),
 *   and the honest answer there is no — an unpartitioned cookie is what every
 *   such client has always received.
 * - `Sec-Fetch-Site` names who is doing the framing, and only `cross-site`
 *   partitions. isocan framing its OWN pages — `ItemView`'s sandboxed blob is
 *   the one that matters — reports `same-origin`, shares the top-level site,
 *   and must keep the ordinary jar. Partitioning it would hand the canvas's
 *   own frames a second badge for no reason.
 */
export function framedRequest(headers: IncomingHttpHeaders): boolean {
  const dest = headerValue(headers["sec-fetch-dest"]);
  if (dest !== "iframe" && dest !== "frame") return false;
  return headerValue(headers["sec-fetch-site"]) === "cross-site";
}

/** Did this request arrive over TLS? Behind the load balancer the hop to the
 * service is plain HTTP, and the LB says so in the header. */
export function isSecureRequest(headers: IncomingHttpHeaders, encrypted: boolean): boolean {
  const forwarded = headerValue(headers["x-forwarded-proto"]);
  if (forwarded) return forwarded.split(",")[0]!.trim() === "https";
  return encrypted;
}

// ---- the Origin rule ----

interface OriginPolicy {
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
