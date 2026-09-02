import type { IncomingHttpHeaders } from "node:http";
import type { BadgeKind, BadgeRecord, Desk } from "./desk.js";
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
export declare function mintBadge(kind: BadgeKind, now?: string): MintedBadge;
export declare function sha256(value: string): string;
/** Constant-time over the two digests. Equal length by construction, so
 * there is no length to leak either. */
export declare function secretMatches(secret: string, expectedHash: string): boolean;
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
export declare function presentedBadge(headers: IncomingHttpHeaders): PresentedBadge | null;
/** The badge behind a presented token, or null if the desk does not know it
 * or the secret does not match. */
export declare function resolveBadge(desk: Desk, presented: PresentedBadge | null): Promise<BadgeRecord | null>;
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
export declare function badgeCookie(token: string, secure: boolean): string;
/** Did this request arrive over TLS? Behind the load balancer the hop to the
 * service is plain HTTP, and the LB says so in the header. */
export declare function isSecureRequest(headers: IncomingHttpHeaders, encrypted: boolean): boolean;
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
export declare function originAllowed(origin: string | undefined, self: {
    host: string | undefined;
    secure: boolean;
}, policy: OriginPolicy): boolean;
export {};
