import type { Actor } from "./model.ts";
import { formatDotToken, parseDotToken } from "./badge.ts";

/**
 * The pass: what an admitted session hands to a surface that is not admitted
 * yet (the identity desk's mechanism 1, collapsing mechanisms 7 and 8).
 *
 * Scene 5, in one object. Jordan is standing on the canvas in a tab the home
 * admitted; she wants her own machine in here too. Her tab mints a pass, the
 * pass rides out in a `#fragment` on a copied command, and the daemon that
 * redeems it comes away **admitted to that canvas** and, when the pass names
 * one, **holding the claim its minter already held** — she is the same
 * Jordan on both surfaces, because the session that already IS her handed it
 * over. That is the desk's rule in its sharpest form: credentials flow
 * OUTWARD from an admitted session, never inward at a door.
 *
 * This file is the WIRE half only — the row as the API hands it back, the
 * token format, the TTL, the routes, and the refusal codes. Minting, hashing
 * and the single-use consume are `node:crypto` and the desk, and they live
 * server-side (`server/passes.ts`, `server/desk.ts`), exactly as they do for
 * the badge. It is here for the same reason `badge.ts` and `grants.ts` are:
 * the browser, the CLI and a replica's home connection would otherwise
 * hand-roll the same token string and the same route shapes in three places.
 *
 * **The secret is never in this file's types twice.** A `Pass` is what a
 * caller may hold onto; the token is handed back ONCE, at mint, and the desk
 * keeps only its SHA-256 — the same posture, and the same reasoning, as a
 * badge secret.
 */

/**
 * How long a pass is worth anything: **fifteen minutes**.
 *
 * The number is set by what actually happens in Scene 5 — a human clicks
 * "Work from your terminal…", copies a command out of a dialog, switches
 * windows, finds a directory, maybe opens a new terminal tab, and pastes. That
 * is minutes, not hours, and not seconds. Shorter (a minute) would fail people
 * who get interrupted between the copy and the paste, and the failure would be
 * baffling because nothing about a copied string says it is ticking. Longer (a
 * day) would leave a live credential lying in a shell history and a Slack
 * paste, which is the one thing a single-use pass is supposed to make
 * uninteresting.
 *
 * It is judged at REDEMPTION against the row's own `expiresAt`, not by a
 * sweeper: a pass that nobody redeems is a dead row, and a dead row that is
 * still in the desk is not a security problem — it is a byte. (Collecting
 * them is GC's business, and it is deliberately not built here; see the GC
 * schedule in `docs/phases.md`'s Deliberately open.)
 */
export const PASS_TTL_MS = 15 * 60 * 1000;

/**
 * One pass, as the desk holds it and as the API hands it back — minus the
 * secret, which exists in plaintext for exactly one HTTP response.
 *
 * **One canvas per pass, and the design says "admissions" plural.** Mechanism
 * 1's diagram hands the redeemer `{admissions: [7f3a…], claims: [jordan]}`,
 * and a badge's admissions genuinely are a list — but a pass is minted from a
 * COMMAND that names one canvas ("work from your terminal" is a button on one
 * canvas; `isocan share` names one canvas), so there is exactly one canvas in
 * scope at the moment of minting and nothing to enumerate. A second machine
 * is a second pass, and a second canvas is a second pass. Making it a list
 * would mean inventing a UI that asks "which of your canvases should this
 * enrol?", which no scene asks for, and would let one leaked fragment carry
 * a whole household instead of one room. Plural stays available: the badge's
 * admission list is where several passes accumulate.
 */
export interface Pass {
  id: string;
  /** The one canvas this pass admits its redeemer to. */
  canvasId: string;
  /**
   * The badge that minted it — an admitted badge, by construction, because
   * the mint route is project-scoped and the door has already run.
   *
   * It is also what a redeemed admission's provenance names (`{root: "pass",
   * badgeId}`), so phase 9's sweep can walk from a revoked grant, through the
   * badge it admitted, to every badge that badge vouched in.
   */
  mintedBy: string;
  /**
   * The claim this pass hands over, if any — an actor the MINTING badge held
   * at mint time.
   *
   * **Optional, and both shapes are real.** With it, the redeeming surface
   * comes away being somebody: Scene 5's "the CLI arrives knowing who it
   * speaks for". Without it, the pass is admission only, which is Scene 6's
   * cloud agent (Sonia claims her OWN actor, never Inna's) and day-one
   * `isocan open`, before the human has an actor to resume at all.
   */
  actorId?: string;
  createdAt: string;
  /** `createdAt + PASS_TTL_MS`, stamped at mint. Stored rather than computed
   * at redemption so that changing the constant cannot retroactively extend
   * or kill passes that are already in the wild. */
  expiresAt: string;
  /** Single-use: set by the one redemption that won. A row rather than a
   * delete, for the same reason a revoked grant is a tombstone — "this pass
   * was already used, at 14:02, by that badge" is an answer an innkeeper is
   * asked for, and "there is no such pass" is a different sentence. */
  redeemedAt?: string;
  redeemedBy?: string;
}

// ---- the token on the wire ----

/**
 * `<passId>.<secret>` — the badge's dot idiom, reused rather than re-invented.
 *
 * ONE parser, in `badge.ts`, and this is the other end of the note there. The
 * two tokens are the same shape because they are the same kind of thing: an
 * opaque id the desk indexes on, plus 256 bits of CSPRNG the desk only ever
 * holds hashed. A second hand-rolled split here would be a second set of edge
 * cases, and when two spellings of one format disagree the symptom is a
 * refusal with no explanation.
 *
 * The wrapper exists anyway, rather than callers reaching for
 * `parseDotToken`, because a `passId` and a `badgeId` are different things
 * and code that could present one where the other is expected is code that
 * one day will.
 */
export interface PassToken {
  passId: string;
  secret: string;
}

export function formatPassToken(passId: string, secret: string): string {
  return formatDotToken(passId, secret);
}

/** Split a presented pass token. Null for anything that is not one — a
 * malformed token is refused exactly as an unknown one is (see
 * `PASS_UNKNOWN`). */
export function parsePassToken(raw: string | undefined | null): PassToken | null {
  const parsed = parseDotToken(raw);
  return parsed ? { passId: parsed.id, secret: parsed.secret } : null;
}

// ---- the two routes ----

/**
 * Mint one: `POST /api/projects/:id/passes`.
 *
 * **Project-scoped on purpose**, the same argument the grant routes are
 * written on: the `onRequest` hook already asks `projectId ∈ admissions` for
 * everything under `/api/projects/:id/`, so "only an admitted badge may mint
 * a pass for this canvas" costs nothing per-route and cannot be forgotten by
 * a later edit. It is also where the canvas comes from — a pass names one
 * canvas, and this way it is named by the ADDRESS rather than by a body field
 * a caller could get wrong.
 */
export const passesRoute = (projectId: string): string =>
  `/api/projects/${encodeURIComponent(projectId)}/passes`;

/**
 * Redeem one: `POST /api/passes/redeem` — flat, and it has to be.
 *
 * The redeemer is BY DEFINITION not admitted to the canvas yet; that is what
 * the pass is for. A project-scoped path would be refused by the door hook
 * before the handler could look at the pass at all — the door would answer
 * `not-admitted` to the one request whose entire purpose is to become
 * admitted. So redemption lives outside `/api/projects/`, and the canvas it
 * concerns comes from the pass row rather than from the URL.
 */
export const PASS_REDEEM_ROUTE = "/api/passes/redeem";

export interface MintPassRequest {
  /**
   * Which of the minting badge's claims to hand over. Omitted for an
   * admission-only pass — see `Pass.actorId`.
   *
   * Refused unless the minting badge holds it: a pass hands over an identity
   * its minter already IS, and "endow this pass with somebody else" is
   * impersonation with a wrapper on it. The design widens this by exactly one
   * hop — a badge may also endow an *agent's* actor that it SPONSORED into
   * existence — and that hop is deliberately not built here; it belongs with
   * the innkeeper's standing mint (mechanism 11, phase 9), where sponsorship
   * is a thing the desk records rather than a thing this route infers.
   */
  actorId?: string;
}

export interface MintPassResponse {
  pass: Pass;
  /**
   * `<passId>.<secret>`, handed over **once and never again** — there is no
   * route that reads a pass back out, and the desk holds only the hash. A
   * caller that loses it mints another; that is cheaper than any mechanism
   * for showing it twice, and it is the same posture as the door's.
   */
  token: string;
}

export interface RedeemPassRequest {
  token: string;
}

export interface RedeemPassResponse {
  /** The canvas the redeeming badge is now admitted to. */
  canvasId: string;
  /** Who it now speaks as — absent for an admission-only pass, where the
   * redeemer is expected to claim its own actor. The NAME is resolved at
   * redemption rather than frozen at mint, so a person who renamed herself in
   * between is handed the name she goes by now. */
  actor?: Actor;
}

// ---- refusal ----

/**
 * Why a redemption was refused, as `ApiError.code`, and each one is a
 * DIFFERENT recovery.
 *
 * This is phase 7's finding — "this system's default answer to a wrong
 * address is a cheerful one" — met head-on at the one gesture where the
 * caller is a person who just pasted a command into a terminal. "This pass
 * was already used" means somebody (probably you, on the other machine) has
 * already enrolled; "there is no such pass" means the string is wrong or the
 * home was wiped; "this pass has expired" means go back to the tab and click
 * the button again. One collapsed refusal would send all three to the same
 * useless place.
 */
export type PassRefusal = typeof PASS_UNKNOWN | typeof PASS_SPENT | typeof PASS_EXPIRED;

/**
 * No such pass — or the secret does not match one that exists.
 *
 * Deliberately the SAME answer for both. A distinct "that pass exists but
 * your secret is wrong" would be a guessing oracle over a 256-bit secret,
 * bought in exchange for a distinction nobody can act on: a caller with a
 * mangled token cannot tell which half they mangled either way, and the
 * remedy — get a fresh pass — is identical.
 */
export const PASS_UNKNOWN = "unknown-pass";

/** Redeemed already. Single-use is the point of a pass, so this is a real
 * answer and not an error condition: the honest reading is "that machine is
 * already enrolled". */
export const PASS_SPENT = "pass-spent";

/** Older than `PASS_TTL_MS`. Never redeemed, and never will be. */
export const PASS_EXPIRED = "pass-expired";

/**
 * **There is deliberately no fourth code for "that is not your claim."**
 *
 * Minting a pass for an actor the minting badge does not hold is refused by
 * the check that already exists — mechanism 5's `not-your-actor`, the same
 * sentence with the same remedy ("claim that actor first"), spoken by
 * `Engine.requireActor` at the one place the claims registry lives. Inventing
 * `not-your-claim` beside it would be two spellings of one refusal, and the
 * second one would drift.
 *
 * The refusal above is about REDEEMING. This note is here because the brief
 * for this work said "spent, expired, unknown, not-yours", and a reader
 * counting codes should find the fourth one accounted for rather than missing.
 */

/** Has this pass been redeemed? */
export function passSpent(pass: Pass): boolean {
  return pass.redeemedAt !== undefined;
}

/** Is it past its `expiresAt`? The clock is the caller's, as everywhere else
 * in core — this file stays pure. */
export function passExpired(pass: Pass, now: string): boolean {
  return Date.parse(now) >= Date.parse(pass.expiresAt);
}
