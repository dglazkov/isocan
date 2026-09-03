import { randomBytes } from "node:crypto";
import {
  formatPassToken,
  newId,
  parsePassToken,
  PASS_EXPIRED,
  PASS_SPENT,
  PASS_TTL_MS,
  PASS_UNKNOWN,
  passExpired,
  type PassRefusal,
} from "@isocan/core";
import { sha256, secretMatches } from "./badges.ts";
import { rungOfAdmission } from "./grants.ts";
import type { BadgeRecord, Desk, PassRecord } from "./desk.ts";

/**
 * The pass, server-side: minting it, and the policy that spends it (identity
 * desk, mechanism 1's collapse of 7 and 8; phase 8).
 *
 * One file, so that the HTTP route is a body-parse and a call — the same
 * arrangement `grants.ts` has, and for the same reason. Where the door's test
 * lives in one place so the HTTP hook and the WS upgrade cannot drift, the
 * pass's test lives in one place so that the day a second caller redeems one
 * (Scene 7's dispatch payload hands a pass to a cloud agent), it asks these
 * questions in this order rather than a similar-looking set in a similar-
 * looking order.
 */

/** A minted pass, at the one moment the plaintext secret exists. */
interface MintedPass {
  record: PassRecord;
  /** `<passId>.<secret>` — handed to the caller once and never again. */
  token: string;
}

/**
 * Mint one.
 *
 * 256 bits of CSPRNG, base64url, hashed before it reaches the desk — the
 * badge's numbers and the badge's posture, deliberately identical. A pass is
 * shorter-lived than a badge and no less powerful while it lives: it is worth
 * one admission and, usually, one identity. Giving it a weaker secret because
 * it expires would be trading a real property for a scheduling one.
 */
export function mintPass(input: {
  canvasId: string;
  mintedBy: string;
  actorId?: string;
  now?: string;
}): MintedPass {
  const createdAt = input.now ?? new Date().toISOString();
  const passId = newId("pss");
  const secret = randomBytes(32).toString("base64url");
  return {
    record: {
      id: passId,
      canvasId: input.canvasId,
      mintedBy: input.mintedBy,
      ...(input.actorId !== undefined ? { actorId: input.actorId } : {}),
      secretHash: sha256(secret),
      createdAt,
      expiresAt: new Date(Date.parse(createdAt) + PASS_TTL_MS).toISOString(),
    },
    token: formatPassToken(passId, secret),
  };
}

/**
 * A pass would not be redeemed, and this is why.
 *
 * Its own class and its own status per code, because the three refusals are
 * three different things for the person at the terminal to do:
 *
 * - **404 `unknown-pass`** — there is no such row. The string is wrong, or
 *   this is not the home that minted it. Not a 401: the caller's badge is
 *   fine, and sending it back to the door would mint credentials forever
 *   without getting anywhere (`NotAdmittedError` makes the same argument).
 * - **409 `pass-spent`** — it worked already, once, for somebody. 409 is this
 *   codebase's "do not retry" (see `OplogFencedError`), and a retry here is
 *   exactly what a caller must not do: the answer will never change.
 * - **410 `pass-expired`** — it existed and is gone. `Gone` is the honest
 *   status and it is not cleverness for its own sake: 404 would say "you
 *   mistyped it" about a string that was correct, and the remedy is different
 *   (go back to the tab and mint another).
 */
export class PassRefusedError extends Error {
  readonly status: number;
  constructor(
    readonly code: PassRefusal,
    message: string,
  ) {
    super(message);
    this.name = "PassRefusedError";
    this.status = code === PASS_SPENT ? 409 : code === PASS_EXPIRED ? 410 : 404;
  }
}

/**
 * **Redeem a pass: spend it, and admit the badge that presented it.**
 *
 * The order of the questions is the design, not a style:
 *
 *   parse → is there such a pass → does the secret match → has it expired →
 *   **spend it (atomically)** → write the admission
 *
 * Everything cheap and read-only happens before the one irreversible step, so
 * a mistyped token cannot burn a good pass, and the atomic spend is the last
 * gate rather than the first — which is what makes two racing redemptions
 * resolve to one winner instead of two.
 *
 * **Redemption endows the PRESENTING badge.** It does not mint a new one, and
 * this diverges from the design doc's diagram (`H-->>D: badge B₃`), so it is
 * argued rather than quietly taken:
 *
 * - The browser — the surface the dialog's own copy button serves — already
 *   holds a cookie badge by the time it can ask for anything, because the
 *   page load mints one. "Mint a second badge" there means re-setting the one
 *   cookie, which is not a second holder, it is the same holder with a new
 *   secret and its old admissions dropped on the floor.
 * - The door deliberately never returns a cookie's secret in a body (that is
 *   the entire point of `HttpOnly`), so a minted badge could not be handed to
 *   a browser as data at all.
 * - Every client in this codebase already knocks on the door the moment it is
 *   401'd, without being told to, so a surface that somehow has no badge has
 *   a well-trodden way to get one BEFORE it redeems. `badge-store.ts` is that
 *   path and it is one line at every call site.
 *
 * What the design's diagram is actually about survives untouched: **a badge
 * that arrived knowing nothing leaves knowing its person**, and it leaves
 * admitted. Only who did the minting moved — and mechanism 1 says badges
 * "differ only in dowry", which is exactly the property this preserves.
 *
 * The claim handoff is NOT here. It is a write to the claims registry, which
 * lives behind the engine's single-writer chain like every other claims write
 * (`Desk.setClaims`: "called from the engine's chain"), so the route does it
 * through `Engine.endowClaim` after this returns. What is here is the door's
 * half: spending the row, and the admission with its provenance.
 */
export async function redeemPass(
  desk: Desk,
  token: string,
  redeemer: BadgeRecord,
  now = new Date().toISOString(),
): Promise<PassRecord> {
  const parsed = parsePassToken(token);
  if (!parsed) throw unknownPass();
  const held = await desk.pass(parsed.passId);
  // One answer for "no such pass" and "that is not its secret" — see
  // `PASS_UNKNOWN`, which explains why the distinction is not worth the
  // guessing oracle it would be.
  if (!held || !secretMatches(parsed.secret, held.secretHash)) throw unknownPass();
  if (passExpired(held, now)) {
    throw new PassRefusedError(
      PASS_EXPIRED,
      `this pass expired at ${held.expiresAt} — passes are good for ${Math.round(
        PASS_TTL_MS / 60_000,
      )} minutes. Ask the surface that minted it for another`,
    );
  }
  const outcome = await desk.redeemPass(held.id, now, redeemer.badgeId);
  // Null here means the row vanished between the read above and this call,
  // which on a desk that never deletes a pass means a home that was wiped mid
  // request. `unknown-pass` is still the true answer.
  if (!outcome) throw unknownPass();
  if (!outcome.redeemed) {
    throw new PassRefusedError(
      PASS_SPENT,
      `this pass was already redeemed at ${outcome.pass.redeemedAt} — a pass is ` +
        "single-use, so the surface that used it is already enrolled. Mint another " +
        "if you need a second one",
    );
  }
  /**
   * **Provenance is `{root: "pass", badgeId}`, naming the MINTING badge, and
   * getting it wrong makes phase 9's sweep silently incomplete.**
   *
   * `desk.ts` says so where the type is declared: the sweep walks admissions
   * whose root names a revoked grant and re-runs the door test on each, and a
   * pass-derived admission is reached by following `badgeId` back to the badge
   * that vouched this one in — however many hops away. An admission mis-rooted
   * as `link` or `grant` here would be one no revocation could ever find, and
   * "Jordan's daemon kept working after her grant was revoked" is precisely
   * the failure the sweep exists to prevent.
   */
  /**
   * **At the minter's rung** (roles design, "Agents hold what their person
   * holds"). A pass-derived admission endows what its minter had, and until
   * the ladder it was written with none — which read as edit whatever the
   * minter held. The minter's admission is read now, at redemption, rather
   * than a rung stored on the pass row at mint: the row's shape is unchanged
   * and the answer is the minter's standing at the moment the badge arrives.
   * A minter that is gone or no longer on the canvas endows edit, and the
   * next sweep of the canvas resolves the chain the way it resolves any root
   * that does not stand.
   */
  const minter = await desk.badge(held.mintedBy);
  const minted = minter?.admissions.find((a) => a.canvasId === held.canvasId);
  await desk.admit(
    redeemer.badgeId,
    held.canvasId,
    { root: "pass", badgeId: held.mintedBy },
    minted ? rungOfAdmission(minted) : undefined,
  );
  return outcome.pass;
}

function unknownPass(): PassRefusedError {
  return new PassRefusedError(
    PASS_UNKNOWN,
    "no such pass — check the address you were given, or ask for a fresh one " +
      "(a pass is single-use and short-lived, so an old command will not do)",
  );
}
