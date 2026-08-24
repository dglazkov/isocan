import {
  attestationSatisfying,
  GRANTED_BY_HOME,
  isLive,
  LINK,
  newId,
  NOT_ADMITTED,
} from "@isocan/core";
import type { Grant } from "@isocan/core";
import type { BadgeRecord, Desk } from "./desk.ts";

/**
 * The door's test over the desk's grant rows (identity desk, mechanisms 3 + 2).
 *
 * One file, so the HTTP hook and the WS upgrade ask the SAME question. Phase 3
 * left two marked policy lines waiting for this — `admit()` in `http.ts` and
 * `admitted()` in `ws.ts` — and the only way those two stay one policy is if
 * neither of them contains the policy.
 *
 * The design's flowchart, in order:
 *
 *   already admitted → creating the canvas (bootstrap) → a valid pass
 *   (phase 8) → an attestation satisfies a grant → refused
 *
 * Everything above is a call site's business except the last two, which are
 * here. The pass branch turned out not to be a branch at all: phase 8 spends a
 * pass at its own route, which writes the admission itself, so by the time a
 * pass-enrolled badge asks for anything it is answered by the first test.
 * `http.ts`'s `admit` carries that argument where somebody would look for it.
 */

/**
 * The door said no, and the badge is perfectly good.
 *
 * Deliberately NOT a 401: a caller told "bad badge" throws its credential
 * away and goes back to the door, and a caller that is simply not admitted
 * here would do that forever, minting a fresh badge per refusal and getting
 * nowhere. 403 with a code of its own is the answer a Share dialog can turn
 * into "ask for the link", and it is the shape `OplogFencedError` already
 * established in `http.ts`'s error handler: a refusal a client must not
 * blindly retry earns its own code.
 */
export class NotAdmittedError extends Error {
  readonly code = NOT_ADMITTED;
  constructor(readonly canvasId: string) {
    super(
      `this badge is not admitted to ${canvasId} — ask whoever shared it for the ` +
        "link, or have them grant you access",
    );
    this.name = "NotAdmittedError";
  }
}

/**
 * The grant that lets this badge in, or null.
 *
 * **All three subjects are checkable here, since phase 9.** `link` is
 * satisfied by presenting the address — a fact about the REQUEST, which is
 * why it is answered here and not in core — and `email:` / `repo:` are
 * satisfied by an ATTESTATION on the badge, a fact about the HOLDER, which is
 * `attestationSatisfying`'s question and belongs in core beside the subject
 * type it compares against.
 *
 * The badge was a parameter from phase 7 precisely so that this branch could
 * land here and nowhere else; the phase-7 comment said so, and it is what
 * kept the check from ending up in `http.ts` and `ws.ts` as two copies.
 *
 * **The order matters and it is not alphabetical.** Oldest first, so a
 * canvas's standing link grant is the row named in provenance when several
 * would do — the row a person recognizes when they later ask why somebody is
 * here. That ordering has a second consequence phase 9 makes real: a badge
 * that could enter by EITHER the link or her own email grant is rooted at the
 * link, so revoking the link sweeps her — and the sweep then re-runs this
 * function, finds the email grant, and RE-ROOTS her instead of expelling her.
 * Which is the design's whole sentence about not expelling the people who
 * were invited by name, arriving as a consequence of two lines rather than as
 * a special case.
 */
export async function admittingGrant(
  desk: Desk,
  canvasId: string,
  badge: BadgeRecord,
): Promise<Grant | null> {
  const grants = await desk.grantsFor(canvasId);
  const live = grants.filter(isLive).sort((a, b) => a.at.localeCompare(b.at));
  for (const grant of live) {
    if (grant.subject === LINK) return grant;
    if (attestationSatisfying(grant.subject, badge.attestations ?? [])) return grant;
    // Anything else falls through, and falling through is the correct answer
    // rather than a gap: a subject nobody has proved is a row that admits
    // nobody YET. The refusal a caller sees is the door's, and the remedy is
    // to go and prove the attribute — which is what the design means by "the
    // door offers the attesters".
  }
  return null;
}

/**
 * The standing link grant a canvas is born with — "the status quo demoted to
 * data".
 *
 * Every canvas gets one at creation, so that "the address is the secret"
 * stops being a regime and becomes one revocable row. Written only when the
 * canvas has NO grant rows at all: a revoked link is a tombstone (see
 * `Grant.revokedAt`), and an "ensure" that looked only for a live link row
 * would helpfully turn the link back on every time the canvas was touched.
 *
 * Returns the row it wrote, or null when the canvas already had one.
 */
export async function ensureLinkGrant(
  desk: Desk,
  canvasId: string,
  grantedBy: string,
): Promise<Grant | null> {
  const existing = await desk.grantsFor(canvasId);
  if (existing.length > 0) return null;
  const grant: Grant = {
    id: newId("gnt"),
    canvasId,
    subject: LINK,
    grantedBy,
    at: new Date().toISOString(),
  };
  await desk.putGrant(grant);
  return grant;
}

/**
 * The same standing grant, written by a REPLICA for a canvas that arrived
 * from its home.
 *
 * A grant is desk state, and the two-ledger rule means it does not travel: the
 * home's row is the authority over who may enter the canvas AT THE HOME, and
 * this row is a different sentence in a different ledger — who on THIS
 * machine may reach the local copy. Today that is "anyone this daemon serves",
 * which is exactly what a local daemon has always been ("a daemon that only
 * listens to one machine's people and agents"), and mechanism 5's line about
 * localhost trust standing within a machine.
 *
 * It is written rather than assumed for the reason `desk.ts` gives about
 * fallbacks: "a replica has no grants, so let everyone in" would be a second
 * door policy, living in a branch, silently disagreeing with the first.
 *
 * What it does NOT do is inherit revocation. Turning the link off at the home
 * stops new badges getting in there and, from phase 9, sweeps the ones that
 * did; it does not reach into a laptop's own ledger. What actually stops that
 * laptop is that its daemon's badge is expelled at the home and replication
 * stops — the local copy goes stale rather than staying live, which is the
 * same thing a stolen laptop's copy does and is phase 9's problem to state.
 */
export function ensureHomeLinkGrant(desk: Desk, canvasId: string): Promise<Grant | null> {
  return ensureLinkGrant(desk, canvasId, GRANTED_BY_HOME);
}
