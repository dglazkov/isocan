import {
  atLeast,
  attestationSatisfying,
  capabilityOf,
  claimsActor,
  GRANTED_BY_HOME,
  isLive,
  LINK,
  narrowed,
  newId,
  NOT_ADMITTED,
  ownerOf,
  RUNGS,
  VIEW_ONLY,
  WITHDRAWN,
} from "@isocan/core";
import type { Capability, Grant } from "@isocan/core";
import type { Admission, BadgeRecord, Desk, Provenance } from "./desk.ts";

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
  /**
   * `withdrawn` when this badge HAD been inside and a sweep put it out
   * (roles design, "Reaching an open socket"): the same code, because an
   * expelled badge is a badge that is not admitted, and a different
   * sentence, because the person was in and the difference is the whole
   * message. Absent for a badge that was never admitted.
   */
  constructor(
    readonly canvasId: string,
    readonly reason?: string,
  ) {
    super(
      reason === WITHDRAWN
        ? `your access to ${canvasId} was withdrawn — whoever owns it removed you; ask them ` +
            "if that was a mistake"
        : `this badge is not admitted to ${canvasId} — ask whoever shared it for the ` +
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
 *
 * **Since #88, capability outranks age**, and since the roles ladder the
 * comparator is the ladder itself: rows sort by rung, highest first, and by
 * age within a rung. An edit grant beats a view grant however young it is,
 * because "which row let you in" also decides what you may do — a person
 * invited by name to edit, entering a canvas whose link can only view, must
 * be rooted at her invitation and not at the link that would demote her.
 * Among grants of one rung the old ordering stands unchanged, which is every
 * canvas that predates the field.
 *
 * **The creator's floor** (roles design, "Who holds what"). The creator holds
 * `own` and cannot lose it, and that is not a row: it is `project.createdBy`
 * checked against the badge's claims, exactly as `heldRung` reads it.
 * It is applied HERE, at the door, and not only on owner routes, because
 * journey 1 step 2 says the creator stays when the link is turned off —
 * and until this the revoker of a link was expelled with everyone else who
 * came in on it, if their browser happened to enter by the link. Asked only
 * when no row answers, so its cost (one `claimsOf` read) stays off the
 * common path. A badge admitted by the floor is admitted with
 * `{root: "created"}`, the provenance the sweep already keeps without a door
 * test. `creator` is the canvas's `createdBy.id`; callers that do not hold
 * the snapshot pass null and get rows only.
 */
export interface DoorAnswer {
  /** The row that admits, or null when the creator's floor did. */
  grant: Grant | null;
  /** What the admission is written with: the row, or `created`. */
  provenance: Provenance;
  /** The rung the admission holds. */
  capability: Capability;
}

export async function admittingGrant(
  desk: Desk,
  canvasId: string,
  badge: BadgeRecord,
  creator: string | null = null,
): Promise<DoorAnswer | null> {
  const grants = await desk.grantsFor(canvasId);
  const rung = (grant: Grant) => RUNGS.indexOf(capabilityOf(grant));
  const live = grants
    .filter(isLive)
    .sort((a, b) => rung(b) - rung(a) || a.at.localeCompare(b.at));
  for (const grant of live) {
    const admits =
      grant.subject === LINK || attestationSatisfying(grant.subject, badge.attestations ?? []);
    if (admits) {
      return { grant, provenance: { root: "grant", grantId: grant.id }, capability: capabilityOf(grant) };
    }
    // Anything else falls through, and falling through is the correct answer
    // rather than a gap: a subject nobody has proved is a row that admits
    // nobody YET. The refusal a caller sees is the door's, and the remedy is
    // to go and prove the attribute — which is what the design means by "the
    // door offers the attesters".
  }
  if (creator !== null && claimsActor(await desk.claimsOf(badge.badgeId), creator)) {
    return { grant: null, provenance: { root: "created" }, capability: "own" };
  }
  return null;
}

/** The refusal when somebody below `own` tries to change who may enter a
 *  canvas — inviting, revoking, the link, its rung. Its own code, so a client
 *  can say the useful sentence rather than "no". */
export const NOT_OWNER = "not-owner";

/**
 * The refusal's sentence: the remedy, which is a person (roles design, "What
 * only an owner may do"). `owner` is the creator's name resolved the way the
 * Share dialog resolves `createdBy` — through the registry, so a rename
 * reaches it.
 */
export function notOwnerMessage(owner: string): string {
  return (
    `ask ${owner}, who owns this canvas — only an owner can change who may enter it ` +
    "or what the link allows"
  );
}

/**
 * The rung an admission holds, read off the admission.
 *
 * `created` is the creator's floor and reads as `own` whatever the field
 * says: a bootstrap admission (`project.create`) stores no rung and a floor
 * admission stores `own`, and both are the creator (roles phase 1's finding).
 * Every other root reads its field, absent meaning edit. This is what a
 * pass-derived admission adopts from its minter, at mint and at every sweep —
 * "agents hold what their person holds".
 */
export function rungOfAdmission(admission: Admission): Capability {
  if (admission.provenance.root === "created") return "own";
  return admission.capability ?? "edit";
}

/**
 * **What this badge holds HERE, for a route that asks `own`** (roles design,
 * "Who holds what"): the admission's rung, raised to `own` if the badge
 * claims the creator.
 *
 * Raised by CLAIMS and not by the stored rung, because the creator's own
 * admission is not a reliable record of the floor: a bootstrap admission
 * stores no rung at all, and only a floor admission written by the door
 * stores `own`. Ownership is `project.createdBy`, which every canvas has
 * carried since the first one, checked against who this badge may speak as —
 * a person is not a badge; the canvas may have been made from a terminal and
 * the Share dialog opened in a browser, which is exactly the shape that once
 * produced a report.
 *
 * `asActor` narrows the question to one person (`CreateGrantRequest.actorId`):
 * a badge that claims several — a browser with two personas, a daemon
 * relaying a whole machine — is raised only if THAT actor is the creator. The
 * caller has already checked the actor is among the badge's claims
 * (`engine.requireActor`); this reads the claims once more only to apply the
 * floor. One `claimsOf` read, only on routes that ask for `own`. This is what
 * `ownsThisCanvas` was, with a wider answer.
 */
export async function heldRung(
  desk: Desk,
  project: { id: string; createdBy: { id: string } },
  badge: BadgeRecord,
  asActor: string | null = null,
): Promise<Capability> {
  const held = capabilityIn(badge, project.id) ?? "edit";
  if (atLeast(held, "own")) return held;
  const owner = ownerOf(project);
  if (asActor !== null && asActor !== owner) return held;
  const claims = await desk.claimsOf(badge.badgeId);
  return claimsActor(claims, owner) ? "own" : held;
}

/**
 * A write met an admission below `edit` (#88, widened by the roles ladder to
 * `read`). 403 with its own code, for `NotAdmittedError`'s reason moved one
 * notch: this caller is badged AND admitted, so neither "go to the door" nor
 * "ask for the link" helps — the remedy is to be shared with for editing,
 * and only a distinguishable refusal lets a client say that.
 *
 * The code did not change when `read` arrived; the message did. Old clients
 * branch on the code and keep working.
 */
export class ViewOnlyError extends Error {
  readonly code = VIEW_ONLY;
  /** `owner` names the remedy — *ask Priya, who owns it* — when the caller
   * could resolve the creator cheaply (roles journey 1 step 5); the hook's
   * refusal without a snapshot says "whoever shared it". */
  constructor(
    readonly canvasId: string,
    owner?: string,
  ) {
    super(
      `you may read this canvas (${canvasId}) but not change it — ask ` +
        (owner ? `${owner}, who owns it,` : "whoever shared it") +
        " to share it for editing",
    );
    this.name = "ViewOnlyError";
  }
}

/**
 * What this badge's admission lets it do HERE, or null when it holds none.
 *
 * Read off the admission and never off the grants: the door test
 * short-circuits on `canvasId ∈ admissions`, so the admission is the record
 * that is actually consulted per request — which is exactly why the door
 * copies the capability onto it. Absent means edit, as everywhere.
 */
export function capabilityIn(badge: BadgeRecord, canvasId: string): Capability | null {
  const admission = badge.admissions.find((a) => a.canvasId === canvasId);
  if (!admission) return null;
  return admission.capability ?? "edit";
}

/**
 * The held capability, RE-ASKED when it is below `edit` — the upgrade path.
 *
 * An admitted badge is answered by its admission and the grants are never
 * consulted again, which is right for an editor and a trap for a viewer or a
 * reader: prove your email after entering by a view link and the invitation
 * that names you would never take effect, because the door stopped asking.
 * So an admission below `edit` re-runs the door test on every ask, and when
 * the door now gives a DIFFERENT rung the badge is re-rooted there — up to
 * whatever the door gives (an invitation at `read` raises a viewer to the
 * canvas; one at `edit` raises them to editing), the same motion the sweep
 * makes for a grant that changed. This exists for the one case the sweep
 * cannot see: a badge that changed, not a grant that changed. Costs one desk
 * read per request, for viewers and readers only; editors and owners stay
 * on the short-circuit.
 *
 * The in-memory record is updated too, so the rest of THIS request sees what
 * the desk now says.
 */
export async function heldCapability(
  desk: Desk,
  canvasId: string,
  badge: BadgeRecord,
  creator: string | null = null,
): Promise<Capability | null> {
  const held = capabilityIn(badge, canvasId);
  if (held === null || atLeast(held, "edit")) return held;
  const answer = await admittingGrant(desk, canvasId, badge, creator);
  if (!answer || answer.capability === held) return held;
  await desk.reroot(badge.badgeId, canvasId, answer.provenance, answer.capability);
  badge.admissions = badge.admissions.map((a) =>
    a.canvasId === canvasId
      ? {
          canvasId: a.canvasId,
          at: a.at,
          provenance: answer.provenance,
          ...(narrowed(answer.capability) ? { capability: answer.capability } : {}),
        }
      : a,
  );
  return answer.capability;
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
