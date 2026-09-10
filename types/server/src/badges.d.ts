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
export declare function badgeCookie(token: string, secure: boolean, framed?: boolean): string;
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
export declare function framedRequest(headers: IncomingHttpHeaders): boolean;
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
