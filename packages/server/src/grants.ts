import {
  atLeast,
  attestationSatisfying,
  capabilityOf,
  claimsActor,
  GRANTED_BY_HOME,
  groupIdOf,
  highest,
  isBar,
  isGroupLive,
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
import type { Attestation, Capability, Grant, GrantSubject, Group, Space } from "@isocan/core";
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
 *
 * **The order, since roles phase 3:** gather the live rows; if a live BAR
 * names the badge, no row admits; otherwise the rows sorted by rung then
 * age, first match wins; then, only if a bar matched or no row did, the
 * floor. So a barred person is refused however they were invited, and the
 * creator is admitted however they were barred.
 */
export interface DoorAnswer {
  /** The row that admits, or null when the creator's floor did. */
  grant: Grant | null;
  /** What the admission is written with: the row, or `created`. */
  provenance: Provenance;
  /** The rung the admission holds. */
  capability: Capability;
}

/**
 * **Where the door reads the space from** — the desk, unless a caller that
 * runs many door tests at once hands it something memoized. The wide canvas
 * list (`GET /api/projects`) runs one test per canvas the badge has not been
 * in, and pays `spacesFor(badge)` once plus one `grantsForSpace` per visible
 * space through this, rather than one `spaceOf` per canvas (roles design,
 * "The door reads both").
 */
export interface DoorLookup {
  spaceOf(canvasId: string): Promise<Space | null>;
  grantsForSpace(spaceId: string): Promise<Grant[]>;
  /** The group behind a `group:` row (roles phase 5) — one document read per
   * group row per door test, memoized by the test itself. */
  group(groupId: string): Promise<Group | null>;
}

/**
 * **Does this subject admit this holder?** — the door's one question, for
 * every kind of subject (roles phase 5 made it a function because a third
 * kind arrived that needs the desk).
 *
 * - `link`: yes. Presenting the address is the proof, a fact about the
 *   request, which is why core's `attestationSatisfying` never answers it.
 * - `email:` / `repo:`: an attestation of the same attribute, core's test.
 * - `group:`: **membership, read at the door.** The group is fetched and the
 *   question is whether any attribute this badge has proved is in
 *   `members`. Nothing is copied anywhere, which is what makes removing a
 *   member one write followed by a sweep. A group that is gone — deleted, or
 *   never was — admits nobody: a row pointing at nothing is a row that says
 *   nothing, loudly, rather than one that helpfully admits everybody.
 *
 * `groupOf` is the caller's memo: `admittingGrant` builds one per door test
 * so a group named by a canvas row AND a space row costs one read.
 */
export async function subjectAdmits(
  subject: GrantSubject,
  attestations: readonly Attestation[],
  groupOf: (groupId: string) => Promise<Group | null>,
): Promise<boolean> {
  if (subject === LINK) return true;
  const groupId = groupIdOf(subject);
  if (groupId !== null) {
    const group = await groupOf(groupId);
    if (!group || !isGroupLive(group)) return false;
    return attestations.some((row) => group.members.includes(row.attribute));
  }
  return attestationSatisfying(subject, attestations) !== null;
}

/** One read per group per door test: the memo `subjectAdmits` is handed. */
function groupMemo(via: Pick<DoorLookup, "group">): (groupId: string) => Promise<Group | null> {
  const groups = new Map<string, Promise<Group | null>>();
  return (groupId) => {
    let found = groups.get(groupId);
    if (!found) {
      found = via.group(groupId);
      groups.set(groupId, found);
    }
    return found;
  };
}

export async function admittingGrant(
  desk: Desk,
  canvasId: string,
  badge: BadgeRecord,
  creator: string | null = null,
  via: DoorLookup = desk,
): Promise<DoorAnswer | null> {
  /**
   * **Both scopes** (roles design, "Who holds what"): the canvas's rows and
   * its space's, merged into one list before anything is decided, so a bar
   * on either refuses and the highest rung from either wins. One extra desk
   * read on every door test — `spaceOf` — because a canvas in no space
   * cannot be told apart without asking.
   */
  const space = await via.spaceOf(canvasId);
  const grants = [
    ...(await desk.grantsFor(canvasId)),
    ...(space ? await via.grantsForSpace(space.id) : []),
  ];
  const live = grants.filter(isLive);
  const attestations = badge.attestations ?? [];
  // The group memo for THIS door test (roles phase 5): a `group:` row is one
  // desk read, and the same group on the canvas and on its space is still
  // one.
  const groupOf = groupMemo(via);
  /**
   * **A bar wins over every rung** (roles design, "The bar"). Asked of the
   * live rows before any of them is allowed to admit: a bar is a row that
   * says no, and highest-wins over the rungs must never see it as a rung.
   * `link` is never a bar's subject and neither is a group
   * (`barSubjectRefusal`), so a bar matches only by attestation. When one
   * matches, no row admits; the only thing left to ask is the floor, because
   * the creator cannot be barred.
   */
  let barred = false;
  for (const grant of live) {
    if (isBar(grant) && (await subjectAdmits(grant.subject, attestations, groupOf))) {
      barred = true;
      break;
    }
  }
  if (!barred) {
    const rung = (grant: Grant) => RUNGS.indexOf(capabilityOf(grant));
    const rows = live
      .filter((grant) => !isBar(grant))
      .sort((a, b) => rung(b) - rung(a) || a.at.localeCompare(b.at));
    for (const grant of rows) {
      if (await subjectAdmits(grant.subject, attestations, groupOf)) {
        return { grant, provenance: { root: "grant", grantId: grant.id }, capability: capabilityOf(grant) };
      }
      // Anything else falls through, and falling through is the correct answer
      // rather than a gap: a subject nobody has proved is a row that admits
      // nobody YET. The refusal a caller sees is the door's, and the remedy is
      // to go and prove the attribute — which is what the design means by "the
      // door offers the attesters".
    }
  }
  // The floor, asked only when a bar matched or no row did: one `claimsOf`
  // read, off the common path where a row answers. A creator-claiming badge
  // is admitted here whatever the bars say — the creator cannot be barred.
  // The space's creator holds the same floor over every canvas in it (roles
  // phase 4), under a root of its own that every sweep re-asks, because a
  // canvas can leave a space and `created` is never re-asked.
  if (creator !== null || space !== null) {
    const claims = await desk.claimsOf(badge.badgeId);
    if (creator !== null && claimsActor(claims, creator)) {
      return { grant: null, provenance: { root: "created" }, capability: "own" };
    }
    if (space !== null && claimsActor(claims, space.createdBy)) {
      return { grant: null, provenance: { root: "space", spaceId: space.id }, capability: "own" };
    }
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
  const root = admission.provenance.root;
  // `space` is the space creator's floor (roles phase 4): `own`, like `created`.
  if (root === "created" || root === "space") return "own";
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
  const claims = await desk.claimsOf(badge.badgeId);
  if ((asActor === null || asActor === owner) && claimsActor(claims, owner)) return "own";
  /**
   * **The space's creator owns every canvas in it** (roles phase 4): the
   * same floor, one scope wider. Asked last and only here, so a canvas in no
   * space pays one `spaceOf` read on owner routes alone. A row at `own` on
   * the space reaches this function through the admission, which the door
   * wrote from the merged rows.
   */
  const space = await desk.spaceOf(project.id);
  if (space && (asActor === null || asActor === space.createdBy) && claimsActor(claims, space.createdBy)) {
    return "own";
  }
  return held;
}

/**
 * **What this badge holds over a SPACE** (roles phase 4), for the space
 * routes: the highest rung from the live rows on the space that its
 * attestations satisfy, raised to `own` if it claims the space's creator;
 * null when nothing admits it, or a bar names it — in which case the space
 * is not one it may see, and the route answers as if there were none.
 *
 * A space has no link row, so every row is answered by attestation, and the
 * admission is not consulted because a space is not entered: it is a fact
 * about a set of canvases, and a badge holds standing on it directly.
 */
export async function heldRungOnSpace(
  desk: Desk,
  space: Space,
  badge: BadgeRecord,
  asActor: string | null = null,
): Promise<Capability | null> {
  const rows = (await desk.grantsForSpace(space.id)).filter(isLive);
  const attestations = badge.attestations ?? [];
  // The same question the door asks, group rows included (roles phase 5),
  // with one read per group for this call.
  const groupOf = groupMemo(desk);
  let barred = false;
  for (const row of rows) {
    if (isBar(row) && (await subjectAdmits(row.subject, attestations, groupOf))) {
      barred = true;
      break;
    }
  }
  let held: Capability | null = null;
  if (!barred) {
    for (const row of rows) {
      if (isBar(row) || !(await subjectAdmits(row.subject, attestations, groupOf))) continue;
      held = held === null ? capabilityOf(row) : highest(held, capabilityOf(row));
    }
  }
  if (held !== null && atLeast(held, "own")) return held;
  if (asActor !== null && asActor !== space.createdBy) return held;
  const claims = await desk.claimsOf(badge.badgeId);
  return claimsActor(claims, space.createdBy) ? "own" : held;
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
