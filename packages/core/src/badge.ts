/**
 * The badge: what the home hands out at the door, and what every surface
 * presents ever after (the identity desk's mechanism 1).
 *
 * This file is the WIRE half only — the names, the token format, the refusal
 * codes, and the claim rows that cross the wire through `/api/actors`.
 * Minting, hashing, and comparison are `node:crypto` and live server-side
 * (`server/badges.ts`); the `BadgeRecord` itself never crosses the wire and
 * lives behind the desk's seam (`server/desk.ts`). What is here is here for
 * exactly one reason: the browser and the CLI would otherwise hand-roll the
 * same token string in two places, and a mismatch there fails at runtime as a
 * 401 with no explanation.
 *
 * Deliberately policy-free. The door's policy is unchanged — the address
 * still admits — so getting a badge is free. What changes is that admission
 * now PRODUCES something the home can recognize later.
 */

// ---- carriers ----

/** The browser's carrier: one HTTP-only cookie at the one origin.
 *
 * A `__Host-` prefix would be strictly better — it forces `Secure`, `Path=/`,
 * and no `Domain`, so a sibling host cannot spoof it. It also REQUIRES
 * `Secure`, which `http://127.0.0.1:4441` cannot have, and the local daemon
 * and the hosted home are the same code. `__Host-isocan_badge` is the hosted
 * home's tightening, in phase 5, where the daemon knows it is HTTPS-only. */
export const BADGE_COOKIE = "isocan_badge";

/** Daemons and CLIs carry it as an ordinary bearer token. Bearer WINS over
 * cookie when both arrive: an explicit credential beats an ambient one, and a
 * request carrying a bearer is by construction not a cookie-driven request,
 * so it needs no Origin check. */
export const BADGE_SCHEME = "Bearer";

/** Which carrier a caller is asking the door for. Stated, never sniffed:
 * `Origin` presence and `Sec-Fetch-Mode` are guessable and wrong at the
 * edges, and one field in a body is honest and costs nothing. */
export type BadgeCarrier = "cookie" | "bearer";

// ---- the token on the wire ----

/**
 * `<badgeId>.<secret>` — one opaque string in both carriers.
 *
 * The dot is load-bearing: the home splits it, looks the record up by id in
 * O(1), and compares one secret, instead of hashing the presented string and
 * scanning the whole table. It also means a log line that leaked a badge id
 * leaked an identifier and not a credential.
 */
export interface BadgeToken {
  badgeId: string;
  secret: string;
}

export function formatBadgeToken(badgeId: string, secret: string): string {
  return `${badgeId}.${secret}`;
}

/** Split a presented token. Null for anything that is not one — a malformed
 * token is refused the same way a missing one is. */
export function parseBadgeToken(raw: string | undefined | null): BadgeToken | null {
  if (!raw) return null;
  const dot = raw.indexOf(".");
  if (dot <= 0 || dot === raw.length - 1) return null;
  const badgeId = raw.slice(0, dot);
  const secret = raw.slice(dot + 1);
  if (badgeId.includes(".")) return null;
  return { badgeId, secret };
}

// ---- the door ----

export interface DoorRequest {
  /** Default `bearer`. */
  carrier?: BadgeCarrier;
}

export interface DoorResponse {
  badgeId: string;
  /**
   * Handed over exactly once, and ONLY for the bearer carrier. The whole
   * value of an HTTP-only cookie is that page JavaScript cannot read the
   * credential; returning it in the JSON body hands it straight back.
   */
  secret?: string;
}

/** Where a caller with no badge goes to get one. */
export const DOOR_ROUTE = "/api/door";

// ---- refusal ----

/**
 * Why a request was refused, as `ApiError.code`. The distinction is not
 * decoration — it is the recovery branch. `no-badge` means "get one";
 * `bad-badge` means "throw away what you stored and get a new one" (a home
 * that was wiped, and in phase 9 a badge that was killed).
 */
export type BadgeRefusal = "no-badge" | "bad-badge" | "bad-origin";

/** A CLI from before the door, talking to a daemon that has one, gets 401 on
 * everything. That is an accepted break — the two ship as one build — but a
 * break that explains itself is a different thing from a break, so the body
 * names the fix the way the "predates actor.claim" error already does. */
export const BADGE_RESTART_HINT =
  "if this is an isocan CLI from before the door, `isocan restart` brings up this build's daemon";

/** WebSocket close codes, continuing ws.ts's 4400/4404/4500 convention. */
export const WS_NO_BADGE = 4401;
export const WS_BAD_ORIGIN = 4403;
/**
 * There is no canvas at that address — the socket half of a 404, and the one
 * close code a client must NOT retry its way out of.
 *
 * It was a bare `4404` in `ws.ts` and a bare `4404` in `home-link.ts`'s
 * stop-dialling branch; naming it is phase 7's tidy-up for the same reason
 * `address.ts` exists. A mistyped canvas id in a pasted share link arrives
 * here, and a tab that reconnects forever against it is exactly the silent
 * blank page the `/c/` finding was about.
 */
export const WS_NO_CANVAS = 4404;

// ---- the claims half of the registry (desk-private; see server/desk.ts) ----

/**
 * One row of the claims table: this badge may speak as this actor.
 *
 * The claims table used to key on `sessionKey` and now keys on badge ids —
 * the re-key mechanism 1 asks for. A badge holds SEVERAL claims and that is
 * the point: a browser wears a roster of personas under one cookie, and a
 * machine's badge vouches for its human and for each of its agents.
 *
 * This is the registry's PRIVATE half. It lives behind the desk and is never
 * replicated (the two-ledger rule); the public half — ids, names, colors —
 * lives in the store. It crosses the wire only as `ActorBindingRecord`, and
 * only to the badge that holds it.
 */
export interface ActorClaim {
  actorId: string;
  /** When this claim was made. Recency is the liveness proxy for the gap
   * between claiming a name and putting a face on a canvas — no longer
   * consulted for names, which have their own `at` in the public registry. */
  boundAt: string;
  /**
   * Which of THIS BADGE's claims this is — never trusted, only indexed.
   *
   * Demoted, deliberately: it used to be the key of the whole table, and it
   * is now a discriminator inside one badge's list. A harness resuming a
   * conversation, and a browser switching personas, both need to say which
   * of the badge's claims they mean; the home never believes the string, it
   * only looks it up under a badge it has already authenticated.
   */
  sessionKey?: string;
  /** The canvas of the directory the claim was made from, when it was bound
   * at claim time (#60). Informational — which project this agent is of. */
  projectId?: string;
}

/** badgeId → that badge's claims. */
export type ClaimTable = Record<string, ActorClaim[]>;

/**
 * The migration shelf's key in a `ClaimTable`: rows that belong to no badge
 * yet, left over from the sessionKey era and adoptable, once, by the first
 * badge that presents the matching `sessionKey`.
 *
 * It rides in the same table so that "is this name taken" and "was this actor
 * claimed just now" see a legacy row exactly as they saw it before the
 * re-key — unchanged semantics, no second code path. Badge ids are `bdg_…`,
 * so this can never collide with one.
 */
export const SHELF = "shelf";
